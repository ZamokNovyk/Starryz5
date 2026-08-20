import { supabase } from '@/src/lib/supabase';

export type ConfessionCategory = 'all' | 'crush' | 'professors' | 'exams' | 'anecdotes';
export type CardStyle = 'dark' | 'pink' | 'fire';
export type ReactionType = 'heart' | 'laugh' | 'fire' | 'cry' | 'shock';

export interface CenterConfession {
  id: string;
  center_id: string;
  firebase_uid: string | null;
  author_name: string;
  content: string;
  category: 'crush' | 'professors' | 'exams' | 'anecdotes';
  card_style: CardStyle;
  is_anonymous: boolean;
  comments_count: number;
  created_at: string;
  reactions: {
    heart: number;
    laugh: number;
    fire: number;
    cry: number;
    shock: number;
  };
  userReactions: {
    heart: boolean;
    laugh: boolean;
    fire: boolean;
    cry: boolean;
    shock: boolean;
  };
}

export interface ConfessionComment {
  id: string;
  confession_id: string;
  firebase_uid: string | null;
  author_name: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
}

export interface CreateConfessionPayload {
  center_id: string;
  firebase_uid: string | null;
  author_name: string;
  content: string;
  category: 'crush' | 'professors' | 'exams' | 'anecdotes';
  card_style: CardStyle;
  is_anonymous: boolean;
}

export const CONFESSIONS_SETUP_SQL = `-- 1. Tabla de confesiones por centro educativo
CREATE TABLE IF NOT EXISTS public.center_confessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id TEXT NOT NULL,
    firebase_uid TEXT,
    author_name TEXT NOT NULL DEFAULT 'Anónimo',
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('crush', 'professors', 'exams', 'anecdotes')),
    card_style TEXT NOT NULL DEFAULT 'dark' CHECK (card_style IN ('dark', 'pink', 'fire')),
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de reacciones a las confesiones (5 reacciones: heart, laugh, fire, cry, shock)
CREATE TABLE IF NOT EXISTS public.confession_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confession_id UUID NOT NULL REFERENCES public.center_confessions(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('heart', 'laugh', 'fire', 'cry', 'shock')),
    user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(confession_id, user_id, reaction_type)
);

-- 3. Tabla de comentarios y respuestas a confesiones
CREATE TABLE IF NOT EXISTS public.confession_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confession_id UUID NOT NULL REFERENCES public.center_confessions(id) ON DELETE CASCADE,
    firebase_uid TEXT,
    author_name TEXT NOT NULL DEFAULT 'Anónimo',
    content TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_center_confessions_center_id ON public.center_confessions(center_id);
CREATE INDEX IF NOT EXISTS idx_center_confessions_created_at ON public.center_confessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confession_reactions_confession ON public.confession_reactions(confession_id);
CREATE INDEX IF NOT EXISTS idx_confession_comments_confession ON public.confession_comments(confession_id);
CREATE INDEX IF NOT EXISTS idx_confession_comments_created_at ON public.confession_comments(created_at ASC);

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE public.center_confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_comments ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acceso público
CREATE POLICY "Permitir lectura publica de confesiones" 
ON public.center_confessions FOR SELECT USING (true);

CREATE POLICY "Permitir crear confesiones" 
ON public.center_confessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizar conteo de comentarios" 
ON public.center_confessions FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminar confesiones" 
ON public.center_confessions FOR DELETE USING (true);

CREATE POLICY "Permitir todas las acciones en reacciones" 
ON public.confession_reactions FOR ALL USING (true);

CREATE POLICY "Permitir todas las acciones en comentarios" 
ON public.confession_comments FOR ALL USING (true);

CREATE POLICY "Permitir lectura publica de reacciones" 
ON public.confession_reactions FOR SELECT USING (true);

CREATE POLICY "Permitir interactuar con reacciones" 
ON public.confession_reactions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir lectura publica de comentarios" 
ON public.confession_comments FOR SELECT USING (true);

CREATE POLICY "Permitir crear comentarios" 
ON public.confession_comments FOR INSERT WITH CHECK (true);`;

// Utility to get or create a persistent anonymous device client ID for reaction tracking
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'anon_device';
  let deviceId = localStorage.getItem('starryz_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('starryz_device_id', deviceId);
  }
  return deviceId;
}

export function getMyConfessionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
  } catch (e) {
    return [];
  }
}

// Format relative time in Spanish
export function formatTimeAgo(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffSeconds < 60) return 'Hace un momento';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    const diffMonths = Math.floor(diffDays / 30);
    return `Hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
  } catch (e) {
    return 'Reciente';
  }
}

/**
 * Obtiene ÚNICAMENTE las confesiones reales existentes en la base de datos Supabase
 */
export async function getCenterConfessions(
  centerId: string,
  category: ConfessionCategory = 'all',
  sortBy: 'recent' | 'popular' = 'recent',
  currentUserId?: string
): Promise<{ data: CenterConfession[]; isTableMissing: boolean }> {
  const effectiveUserId = currentUserId || getDeviceId();

  try {
    let query = supabase
      .from('center_confessions')
      .select('*')
      .eq('center_id', centerId);

    if (category !== 'all') {
      query = query.eq('category', category);
    }

    query = query.order('created_at', { ascending: false });

    const { data: confessionsData, error } = await query;

    if (error) {
      const isMissing = error.message?.includes('schema cache') || 
                        error.message?.includes('does not exist') || 
                        error.code === 'PGRST204' || 
                        error.code === '42P01';

      if (isMissing) {
        return { data: [], isTableMissing: true };
      }

      console.warn('Aviso al consultar confesiones en Supabase:', error.message || error);
      return { data: [], isTableMissing: false };
    }

    if (!confessionsData || confessionsData.length === 0) {
      return { data: [], isTableMissing: false };
    }

    const confessionIds = confessionsData.map((c: any) => c.id);

    // Map para las 5 reacciones reales
    const reactionsMap: Record<string, { heart: number; laugh: number; fire: number; cry: number; shock: number }> = {};
    const userReactionsMap: Record<string, { heart: boolean; laugh: boolean; fire: boolean; cry: boolean; shock: boolean }> = {};

    confessionIds.forEach((id) => {
      reactionsMap[id] = { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 };
      userReactionsMap[id] = { heart: false, laugh: false, fire: false, cry: false, shock: false };
    });

    try {
      const { data: reactionsData, error: reactErr } = await supabase
        .from('confession_reactions')
        .select('confession_id, reaction_type, user_id')
        .in('confession_id', confessionIds);

      if (!reactErr && reactionsData) {
        reactionsData.forEach((r: any) => {
          const type = r.reaction_type as ReactionType;
          if (reactionsMap[r.confession_id] && reactionsMap[r.confession_id][type] !== undefined) {
            reactionsMap[r.confession_id][type] += 1;
            if (r.user_id === effectiveUserId || (currentUserId && r.user_id === currentUserId)) {
              userReactionsMap[r.confession_id][type] = true;
            }
          }
        });
      }
    } catch (rErr) {
      // Ignorar si la tabla de reacciones aún se está creando
    }

    const result: CenterConfession[] = confessionsData.map((c: any) => {
      const reacts = reactionsMap[c.id] || { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 };
      const userReacts = userReactionsMap[c.id] || { heart: false, laugh: false, fire: false, cry: false, shock: false };

      return {
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
        reactions: reacts,
        userReactions: userReacts,
      };
    });

    if (sortBy === 'popular') {
      result.sort((a, b) => {
        const totalA = a.reactions.heart + a.reactions.laugh + a.reactions.fire + a.reactions.cry + a.reactions.shock;
        const totalB = b.reactions.heart + b.reactions.laugh + b.reactions.fire + b.reactions.cry + b.reactions.shock;
        return totalB - totalA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return { data: result, isTableMissing: false };
  } catch (err) {
    return { data: [], isTableMissing: false };
  }
}

/**
 * Publica una nueva confesión en 'center_confessions' de Supabase
 */
export async function createCenterConfession(payload: CreateConfessionPayload): Promise<CenterConfession> {
  const record = {
    center_id: payload.center_id,
    firebase_uid: payload.firebase_uid,
    author_name: payload.author_name || 'Anónimo',
    content: payload.content,
    category: payload.category,
    card_style: payload.card_style,
    is_anonymous: payload.is_anonymous,
    comments_count: 0,
  };

  const { data, error } = await supabase
    .from('center_confessions')
    .insert([record])
    .select()
    .single();

  if (error) {
    const isMissing = error.message?.includes('schema cache') || 
                      error.message?.includes('does not exist') || 
                      error.code === 'PGRST204' || 
                      error.code === '42P01';

    if (isMissing) {
      throw new Error("La tabla 'center_confessions' no existe aún en tu base de datos Supabase. Ejecuta el script SQL en el editor de Supabase.");
    }
    throw error;
  }

  // Guardar ID en localStorage para filtro 'Ver mis confesiones'
  if (typeof window !== 'undefined' && data?.id) {
    try {
      const myConfessions = JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
      if (!myConfessions.includes(data.id)) {
        myConfessions.push(data.id);
        localStorage.setItem('starryz_my_confessions', JSON.stringify(myConfessions));
      }
    } catch (e) {}
  }

  return {
    ...data,
    reactions: { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 },
    userReactions: { heart: false, laugh: false, fire: false, cry: false, shock: false },
  };
}

/**
 * Alterna una reacción (❤️, 😂, 🔥, 😭, 🤯) en la tabla 'confession_reactions' de Supabase
 */
export async function toggleConfessionReaction(
  confessionId: string,
  reactionType: ReactionType,
  currentUserId?: string,
  currentUserName?: string
): Promise<{ added: boolean }> {
  const effectiveUserId = currentUserId || getDeviceId();

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('confession_reactions')
      .select('id')
      .eq('confession_id', confessionId)
      .eq('reaction_type', reactionType)
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    if (selectErr) {
      const isMissing = selectErr.message?.includes('schema cache') || 
                        selectErr.message?.includes('does not exist');
      if (isMissing) {
        return { added: true };
      }
    }

    if (existing) {
      await supabase
         .from('confession_reactions')
         .delete()
         .eq('id', existing.id);

      return { added: false };
    } else {
      await supabase
        .from('confession_reactions')
        .insert([
          {
            confession_id: confessionId,
            reaction_type: reactionType,
            user_id: effectiveUserId,
          },
        ]);

      // Disparar notificación si el dueño es otro usuario
      try {
        const { data: confession } = await supabase
          .from('center_confessions')
          .select('firebase_uid, center_id')
          .eq('id', confessionId)
          .single();

        if (confession && confession.firebase_uid && confession.firebase_uid !== effectiveUserId) {
          let centerName = '';
          if (confession.center_id) {
            const { data: centerData } = await supabase
              .from('educational_centers')
              .select('name')
              .eq('id', confession.center_id)
              .maybeSingle();
            if (centerData?.name) centerName = centerData.name;
          }

          const emoji = reactionType === 'heart' ? '❤️' : 
                        reactionType === 'laugh' ? '😂' : 
                        reactionType === 'fire' ? '🔥' : 
                        reactionType === 'cry' ? '😭' : '🤯';
          
          const senderName = currentUserName || 'Alguien';
          const centerSuffix = centerName ? ` en ${centerName}` : '';
          const bodyText = `[${senderName}] ha reaccionado con ${emoji} a tu confesión${centerSuffix}`;
          
          const notifLinkUrl = `/?show_confession=${confessionId}`;
          
          const { error: notiError } = await supabase.from('notifications').insert([{
            user_uid: confession.firebase_uid,
            title: senderName,
            body: bodyText,
            link_url: notifLinkUrl,
            is_read: false
          }]);

          if (!notiError) {
            // Despachar Push Notification vía Edge Function rapid-processor
            supabase.functions.invoke('rapid-processor', {
              body: {
                user_uid: confession.firebase_uid,
                title: senderName,
                body: bodyText,
                link_url: notifLinkUrl,
                confession_id: confessionId
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('No se pudo enviar la notificación de reacción:', err);
      }

      return { added: true };
    }
  } catch (err) {
    return { added: true };
  }
}

/**
 * Elimina una confesión propia de Supabase y quita su ID de localStorage
 */
export async function deleteCenterConfession(confessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Eliminar reacciones asociadas
    await supabase
      .from('confession_reactions')
      .delete()
      .eq('confession_id', confessionId);

    // 2. Eliminar respuestas/comentarios asociados
    await supabase
      .from('confession_comments')
      .delete()
      .eq('confession_id', confessionId);

    // 3. Eliminar la confesión principal
    const { error } = await supabase
      .from('center_confessions')
      .delete()
      .eq('id', confessionId);

    if (error) {
      console.error('Error al eliminar confesión de Supabase:', error);
      return { success: false, error: error.message };
    }

    // 4. Remover de localStorage
    if (typeof window !== 'undefined') {
      try {
        const myConfessions = JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
        const updated = myConfessions.filter((id: string) => id !== confessionId);
        localStorage.setItem('starryz_my_confessions', JSON.stringify(updated));
      } catch (e) {}
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al eliminar confesión:', err);
    return { success: false, error: err?.message || 'Error al conectar con Supabase' };
  }
}

/**
 * Obtiene las respuestas / comentarios de una confesión
 */
export async function getConfessionComments(confessionId: string): Promise<ConfessionComment[]> {
  try {
    const { data, error } = await supabase
      .from('confession_comments')
      .select('*')
      .eq('confession_id', confessionId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data;
  } catch (err) {
    return [];
  }
}

/**
 * Agrega un nuevo comentario / respuesta a una confesión
 */
export async function createConfessionComment(payload: {
  confession_id: string;
  firebase_uid: string | null;
  author_name: string;
  content: string;
  is_anonymous: boolean;
}): Promise<ConfessionComment> {
  const record = {
    confession_id: payload.confession_id,
    firebase_uid: payload.firebase_uid,
    author_name: payload.author_name || 'Anónimo',
    content: payload.content,
    is_anonymous: payload.is_anonymous,
  };

  const { data, error } = await supabase
    .from('confession_comments')
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error('Error al insertar comentario:', error);
    throw error;
  }

  // Incrementar el conteo en center_confessions y disparar notificación
  try {
    const { data: conf } = await supabase
      .from('center_confessions')
      .select('comments_count, firebase_uid, center_id')
      .eq('id', payload.confession_id)
      .single();

    if (conf) {
      const newCount = (conf.comments_count || 0) + 1;

      await supabase
        .from('center_confessions')
        .update({ comments_count: newCount })
        .eq('id', payload.confession_id);

      // Disparar la notificación si el autor del comentario no es el mismo dueño de la confesión
      if (conf.firebase_uid && conf.firebase_uid !== payload.firebase_uid) {
        let centerName = '';
        if (conf.center_id) {
          const { data: centerData } = await supabase
            .from('educational_centers')
            .select('name')
            .eq('id', conf.center_id)
            .maybeSingle();
          if (centerData?.name) centerName = centerData.name;
        }

        const senderName = payload.author_name || 'Alguien';
        const centerSuffix = centerName ? ` en ${centerName}` : '';
        const bodyText = `[${senderName}] ha respondido a tu confesión${centerSuffix}: "${payload.content.substring(0, 45)}${payload.content.length > 45 ? '...' : ''}"`;

        const notifLinkUrl = `/?show_confession=${payload.confession_id}&comment_id=${data.id}`;

        const { error: notiError } = await supabase.from('notifications').insert([{
          user_uid: conf.firebase_uid,
          title: senderName,
          body: bodyText,
          link_url: notifLinkUrl,
          is_read: false
        }]);

        if (!notiError) {
          // Despachar Push Notification vía Edge Function rapid-processor
          supabase.functions.invoke('rapid-processor', {
            body: {
              user_uid: conf.firebase_uid,
              title: senderName,
              body: bodyText,
              link_url: notifLinkUrl,
              confession_id: payload.confession_id,
              comment_id: data.id
            }
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('Error al actualizar conteo de comentarios o disparar notificación:', e);
  }

  return data;
}
