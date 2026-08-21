import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration: initialize server-side Supabase client
const getSupabaseAdmin = (): SupabaseClient | null => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase client instance for server-side proxy
  const supabase = getSupabaseAdmin();

  // Helper middleware for database availability
  const checkDb = (req: Request, res: Response, next: () => void) => {
    if (!supabase) {
      return res.status(503).json({
        error: 'Database configuration missing on server. Check environment variables.',
      });
    }
    next();
  };

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasDbConfig: !!supabase,
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Sync User Profile from Firebase to Supabase (Zero MAU in Supabase Auth)
  app.post('/api/users/sync', checkDb, async (req: Request, res: Response) => {
    try {
      const { uid, email, displayName, photoURL, isAnonymous } = req.body;

      if (!uid) {
        return res.status(400).json({ error: 'UID is required' });
      }

      const { data, error } = await supabase!
        .from('users')
        .upsert(
          {
            firebase_uid: uid,
            email: email || null,
            display_name: displayName || (isAnonymous ? 'Usuario Anónimo' : 'Usuario'),
            photo_url: photoURL || null,
            is_anonymous: !!isAnonymous,
          },
          {
            onConflict: 'firebase_uid',
          }
        )
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  });

  // 2. Check Username Availability
  app.post('/api/users/check-username', checkDb, async (req: Request, res: Response) => {
    try {
      const { username, currentUserId, currentFirebaseUid } = req.body;
      const clean = (username || '').trim();

      if (!clean || clean.length < 2 || clean.length > 35) {
        return res.json({
          available: false,
          message: 'El nombre debe tener entre 2 y 35 caracteres.',
        });
      }

      // Try RPC first
      try {
        const { data: rpcData, error: rpcErr } = await supabase!.rpc('check_username_available', {
          p_username: clean,
          p_user_id: currentUserId || null,
          p_firebase_uid: currentFirebaseUid || null,
        });

        if (!rpcErr && typeof rpcData === 'boolean') {
          return res.json({
            available: rpcData,
            message: rpcData ? 'Nombre disponible' : 'Este nombre ya está en uso',
          });
        }
      } catch {}

      // Fallback query
      let query = supabase!.from('users').select('id, firebase_uid, display_name');
      if (currentFirebaseUid) {
        query = query.neq('firebase_uid', currentFirebaseUid);
      } else if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data: existing, error } = await query.ilike('display_name', clean);
      if (error) {
        return res.json({ available: true, message: 'Nombre disponible' });
      }

      const isTaken = !!(existing && existing.length > 0);
      res.json({
        available: !isTaken,
        message: !isTaken ? 'Nombre disponible' : 'Este nombre ya está en uso',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al validar nombre' });
    }
  });

  // 3. Get Confessions for a Center
  app.get('/api/confessions', checkDb, async (req: Request, res: Response) => {
    try {
      const centerId = req.query.centerId as string;
      const category = (req.query.category as string) || 'all';
      const sortBy = (req.query.sortBy as string) || 'recent';
      const userId = (req.query.userId as string) || '';

      if (!centerId) {
        return res.status(400).json({ error: 'centerId is required' });
      }

      let query = supabase!.from('center_confessions').select('*').eq('center_id', centerId);

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      query = query.order('created_at', { ascending: false });

      const { data: confessionsData, error } = await query;

      if (error) {
        const isMissing =
          error.message?.includes('schema cache') ||
          error.message?.includes('does not exist') ||
          error.code === 'PGRST204' ||
          error.code === '42P01';

        return res.json({ data: [], isTableMissing: isMissing });
      }

      if (!confessionsData || confessionsData.length === 0) {
        return res.json({ data: [], isTableMissing: false });
      }

      const confessionIds = confessionsData.map((c: any) => c.id);

      // Fetch reactions summary in batch
      const reactionsMap: Record<
        string,
        { heart: number; laugh: number; fire: number; cry: number; shock: number }
      > = {};
      const userReactionsMap: Record<
        string,
        { heart: boolean; laugh: boolean; fire: boolean; cry: boolean; shock: boolean }
      > = {};

      confessionIds.forEach((id) => {
        reactionsMap[id] = { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 };
        userReactionsMap[id] = { heart: false, laugh: false, fire: false, cry: false, shock: false };
      });

      try {
        const { data: reactionsData } = await supabase!
          .from('confession_reactions')
          .select('confession_id, reaction_type, user_id')
          .in('confession_id', confessionIds);

        if (reactionsData) {
          reactionsData.forEach((r: any) => {
            const type = r.reaction_type as 'heart' | 'laugh' | 'fire' | 'cry' | 'shock';
            if (reactionsMap[r.confession_id] && reactionsMap[r.confession_id][type] !== undefined) {
              reactionsMap[r.confession_id][type] += 1;
              if (r.user_id === userId) {
                userReactionsMap[r.confession_id][type] = true;
              }
            }
          });
        }
      } catch {}

      const result = confessionsData.map((c: any) => ({
        id: c.id,
        center_id: c.center_id,
        firebase_uid: c.firebase_uid,
        author_name: c.author_name || 'Anónimo',
        content: c.content,
        category: c.category || 'anecdotes',
        card_style: c.card_style || 'dark',
        is_anonymous: c.is_anonymous ?? true,
        comments_count: c.comments_count || 0,
        created_at: c.created_at || new Date().toISOString(),
        reactions: reactionsMap[c.id] || { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 },
        userReactions: userReactionsMap[c.id] || {
          heart: false,
          laugh: false,
          fire: false,
          cry: false,
          shock: false,
        },
      }));

      if (sortBy === 'popular') {
        result.sort((a: any, b: any) => {
          const totalA =
            a.reactions.heart +
            a.reactions.laugh +
            a.reactions.fire +
            a.reactions.cry +
            a.reactions.shock;
          const totalB =
            b.reactions.heart +
            b.reactions.laugh +
            b.reactions.fire +
            b.reactions.cry +
            b.reactions.shock;
          return totalB - totalA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      res.json({ data: result, isTableMissing: false });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al obtener confesiones' });
    }
  });

  // 4. Create Confession
  app.post('/api/confessions', checkDb, async (req: Request, res: Response) => {
    try {
      const {
        center_id,
        firebase_uid,
        author_name,
        content,
        category,
        card_style,
        is_anonymous,
      } = req.body;

      if (!center_id || !content) {
        return res.status(400).json({ error: 'center_id and content are required' });
      }

      const record = {
        center_id,
        firebase_uid: firebase_uid || null,
        author_name: author_name || 'Anónimo',
        content,
        category: category || 'anecdotes',
        card_style: card_style || 'dark',
        is_anonymous: is_anonymous ?? true,
        comments_count: 0,
      };

      const { data, error } = await supabase!
        .from('center_confessions')
        .insert([record])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({
        ...data,
        reactions: { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 },
        userReactions: { heart: false, laugh: false, fire: false, cry: false, shock: false },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al crear confesión' });
    }
  });

  // 5. Delete Confession
  app.delete('/api/confessions/:id', checkDb, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await supabase!.from('confession_reactions').delete().eq('confession_id', id);
      await supabase!.from('confession_comments').delete().eq('confession_id', id);

      const { error } = await supabase!.from('center_confessions').delete().eq('id', id);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error al eliminar' });
    }
  });

  // 6. Toggle Reaction
  app.post('/api/confessions/:id/reactions', checkDb, async (req: Request, res: Response) => {
    try {
      const { id: confessionId } = req.params;
      const { reactionType, userId, userName } = req.body;

      if (!reactionType || !userId) {
        return res.status(400).json({ error: 'reactionType and userId are required' });
      }

      const { data: existingReactions } = await supabase!
        .from('confession_reactions')
        .select('id, reaction_type')
        .eq('confession_id', confessionId)
        .eq('user_id', userId);

      const sameTypeReaction = existingReactions?.find((r) => r.reaction_type === reactionType);
      const otherTypeReactions = existingReactions?.filter((r) => r.reaction_type !== reactionType) || [];

      if (sameTypeReaction) {
        await supabase!.from('confession_reactions').delete().eq('id', sameTypeReaction.id);
        return res.json({ added: false });
      }

      if (otherTypeReactions.length > 0) {
        const otherIds = otherTypeReactions.map((r) => r.id);
        await supabase!.from('confession_reactions').delete().in('id', otherIds);
      }

      await supabase!.from('confession_reactions').insert([
        {
          confession_id: confessionId,
          reaction_type: reactionType,
          user_id: userId,
        },
      ]);

      // Handle notification if not self-reaction
      try {
        const { data: confession } = await supabase!
          .from('center_confessions')
          .select('firebase_uid, center_id')
          .eq('id', confessionId)
          .single();

        if (confession && confession.firebase_uid && confession.firebase_uid !== userId) {
          let centerName = '';
          if (confession.center_id) {
            const { data: centerData } = await supabase!
              .from('educational_centers')
              .select('name')
              .eq('id', confession.center_id)
              .maybeSingle();
            if (centerData?.name) centerName = centerData.name;
          }

          const emoji =
            reactionType === 'heart'
              ? '❤️'
              : reactionType === 'laugh'
              ? '😂'
              : reactionType === 'fire'
              ? '🔥'
              : reactionType === 'cry'
              ? '😭'
              : '🤯';

          const senderName = userName || 'Alguien';
          const centerSuffix = centerName ? ` en ${centerName}` : '';
          const bodyText = `[${senderName}] ha reaccionado con ${emoji} a tu confesión${centerSuffix}`;
          const notifLinkUrl = `/?show_confession=${confessionId}`;

          const { error: notiError } = await supabase!.from('notifications').insert([
            {
              user_uid: confession.firebase_uid,
              title: senderName,
              body: bodyText,
              link_url: notifLinkUrl,
              is_read: false,
            },
          ]);

          if (!notiError) {
            try {
              supabase!.functions.invoke('rapid-processor', {
                body: {
                  user_uid: confession.firebase_uid,
                  title: senderName,
                  body: bodyText,
                  link_url: notifLinkUrl,
                  confession_id: confessionId,
                },
              });
            } catch {}
          }
        }
      } catch {}

      res.json({ added: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al reaccionar' });
    }
  });

  // 7. Get Comments
  app.get('/api/confessions/:id/comments', checkDb, async (req: Request, res: Response) => {
    try {
      const { id: confessionId } = req.params;

      const { data, error } = await supabase!
        .from('confession_comments')
        .select('*')
        .eq('confession_id', confessionId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return res.json([]);
      }
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  // 8. Create Comment
  app.post('/api/confessions/:id/comments', checkDb, async (req: Request, res: Response) => {
    try {
      const { id: confessionId } = req.params;
      const { firebase_uid, author_name, content, is_anonymous } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      const record = {
        confession_id: confessionId,
        firebase_uid: firebase_uid || null,
        author_name: author_name || 'Anónimo',
        content,
        is_anonymous: is_anonymous ?? true,
      };

      const { data, error } = await supabase!
        .from('confession_comments')
        .insert([record])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Update comments_count & fire notification
      try {
        const { data: conf } = await supabase!
          .from('center_confessions')
          .select('comments_count, firebase_uid, center_id')
          .eq('id', confessionId)
          .single();

        if (conf) {
          const newCount = (conf.comments_count || 0) + 1;
          await supabase!
            .from('center_confessions')
            .update({ comments_count: newCount })
            .eq('id', confessionId);

          if (conf.firebase_uid && conf.firebase_uid !== firebase_uid) {
            let centerName = '';
            if (conf.center_id) {
              const { data: centerData } = await supabase!
                .from('educational_centers')
                .select('name')
                .eq('id', conf.center_id)
                .maybeSingle();
              if (centerData?.name) centerName = centerData.name;
            }

            const senderName = author_name || 'Alguien';
            const centerSuffix = centerName ? ` en ${centerName}` : '';
            const bodyText = `[${senderName}] ha respondido a tu confesión${centerSuffix}: "${content.substring(
              0,
              45
            )}${content.length > 45 ? '...' : ''}"`;
            const notifLinkUrl = `/?show_confession=${confessionId}&comment_id=${data.id}`;

            const { error: notiError } = await supabase!.from('notifications').insert([
              {
                user_uid: conf.firebase_uid,
                title: senderName,
                body: bodyText,
                link_url: notifLinkUrl,
                is_read: false,
              },
            ]);

            if (!notiError) {
              try {
                supabase!.functions.invoke('rapid-processor', {
                  body: {
                    user_uid: conf.firebase_uid,
                    title: senderName,
                    body: bodyText,
                    link_url: notifLinkUrl,
                    confession_id: confessionId,
                    comment_id: data.id,
                  },
                });
              } catch {}
            }
          }
        }
      } catch {}

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al comentar' });
    }
  });

  // 9. Delete Comment
  app.delete(
    '/api/confessions/:confessionId/comments/:commentId',
    checkDb,
    async (req: Request, res: Response) => {
      try {
        const { confessionId, commentId } = req.params;

        const { error: deleteErr } = await supabase!
          .from('confession_comments')
          .delete()
          .eq('id', commentId);

        if (deleteErr) {
          return res.status(500).json({ success: false, error: deleteErr.message });
        }

        try {
          const { data: conf } = await supabase!
            .from('center_confessions')
            .select('comments_count')
            .eq('id', confessionId)
            .single();

          if (conf) {
            const newCount = Math.max(0, (conf.comments_count || 0) - 1);
            await supabase!
              .from('center_confessions')
              .update({ comments_count: newCount })
              .eq('id', confessionId);
          }
        } catch {}

        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message || 'Error al eliminar' });
      }
    }
  );

  // 10. Educational Centers
  app.get('/api/educational-centers', checkDb, async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabase!
        .from('educational_centers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al cargar centros' });
    }
  });

  app.post('/api/educational-centers', checkDb, async (req: Request, res: Response) => {
    try {
      const { name, type, photoUrl, firebaseUid } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del centro educativo es requerido.' });
      }

      const { data: inserted, error } = await supabase!
        .from('educational_centers')
        .insert([
          {
            name: name.trim(),
            type,
            profile_photo_url: photoUrl?.trim() || null,
            created_by: firebaseUid || 'anon',
          },
        ])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json(inserted);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al crear centro' });
    }
  });

  // 11. Notifications
  app.get('/api/notifications', checkDb, async (req: Request, res: Response) => {
    try {
      const userUid = req.query.userUid as string;
      if (!userUid) return res.json([]);

      const { data, error } = await supabase!
        .from('notifications')
        .select('*')
        .eq('user_uid', userUid)
        .order('created_at', { ascending: false });

      if (error || !data) return res.json([]);
      res.json(data);
    } catch {
      res.json([]);
    }
  });

  app.patch('/api/notifications/read', checkDb, async (req: Request, res: Response) => {
    try {
      const { userUid, notificationId } = req.body;
      if (!userUid) return res.status(400).json({ error: 'userUid required' });

      let query = supabase!.from('notifications').update({ is_read: true }).eq('user_uid', userUid);

      if (notificationId) {
        query = query.eq('id', notificationId);
      }

      const { error } = await query;
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al marcar leído' });
    }
  });

  // 12. Save FCM Token
  app.post('/api/fcm/token', checkDb, async (req: Request, res: Response) => {
    try {
      const { user_uid, fcm_token } = req.body;
      if (!user_uid || !fcm_token) {
        return res.status(400).json({ error: 'user_uid and fcm_token are required' });
      }

      const { error } = await supabase!
        .from('user_fcm_tokens')
        .upsert(
          {
            user_uid,
            fcm_token,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_uid',
          }
        );

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al registrar token FCM' });
    }
  });

  // --- VITE MIDDLEWARE / STATIC ASSETS ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Starryz Server] Backend API running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
