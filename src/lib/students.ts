import { supabase } from './supabase';

export interface Student {
  id: string; // generated slug e.g. "carlos.mendoza.ramirez"
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  institute_id: string;
  created_by: string;
  created_at?: string;
  knows_count?: number;
  fans_count?: number;
  crushes_count?: number;
  score?: number;
  total_ratings?: number;
  views_count?: number;
  avatar_url?: string;
  height_cm?: number;
  marital_status?: string;
  gender?: string;
  birth_date?: string;
  instagram_url?: string;
  youtube_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  biography?: string;
}

export interface CreateStudentData {
  nombre: string;
  apellidos: string;
  instituteId: string;
}

function toSlug(first: string, last: string): string {
  const combined = `${first.trim()} ${last.trim()}`;
  return combined
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.|\.$/g, ''); // trim dots from start/end
}

/**
 * Inserta un nuevo estudiante en la tabla 'students' de Supabase.
 */
export async function createStudent(data: CreateStudentData, firebaseUid: string): Promise<Student> {
  const { nombre, apellidos, instituteId } = data;
  if (!nombre.trim() || !apellidos.trim()) {
    throw new Error('Nombres y apellidos son requeridos.');
  }

  const slugId = toSlug(nombre, apellidos);
  const nombreCompleto = `${nombre.trim()} ${apellidos.trim()}`;

  const insertPayload = {
    id: slugId,
    nombre: nombre.trim(),
    apellidos: apellidos.trim(),
    nombre_completo: nombreCompleto,
    institute_id: instituteId,
    created_by: firebaseUid,
  };

  const { data: inserted, error } = await supabase
    .from('students')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('Error al insertar estudiante en tabla students de Supabase:', error);
    
    // Si la tabla students aún no existe en Supabase, dar un mensaje explicativo
    if (error.code === '42P01' || error.message?.includes('relation "students" does not exist') || error.message?.includes('public.students')) {
      throw new Error('La tabla "students" aún no ha sido creada en Supabase. Por favor, crea las tablas de estudiantes en el editor SQL de Supabase.');
    }
    
    throw new Error(error.message || 'No se pudo guardar el estudiante en la base de datos.');
  }

  return inserted as Student;
}

/**
 * Carga la información del perfil del estudiante por su ID / slug.
 */
export async function getStudentById(slug: string): Promise<Student | null> {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', slug.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.code === '42P01') {
        return null;
      }
      console.warn('Aviso al obtener perfil de estudiante por ID:', error.message || error);
      return null;
    }

    return data as Student | null;
  } catch (err) {
    console.warn('Excepción al obtener estudiante por ID:', err);
    return null;
  }
}

/**
 * Obtiene los estudiantes asignados a un instituto / campus específico con sus conteos reales.
 */
export async function getStudentsByInstitute(instituteId: string): Promise<Student[]> {
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('institute_id', instituteId);

    if (error) {
      if (error.code === 'P0001' || error.code === '42P01' || error.message?.includes('does not exist')) {
        return [];
      }
      console.warn('Aviso al obtener estudiantes por instituto:', error.message || error);
      return [];
    }

    if (!students || students.length === 0) {
      return [];
    }

    const studentIds = students.map((p: any) => p.id);

    // Obtener interacciones (knows / fan) en batch para todos los estudiantes
    const interactionsMap: Record<string, { knows: number; fan: number }> = {};
    try {
      const { data: interactions } = await supabase
        .from('student_interactions')
        .select('student_id, interaction_type')
        .in('student_id', studentIds);

      if (interactions) {
        interactions.forEach((item: any) => {
          if (!interactionsMap[item.student_id]) {
            interactionsMap[item.student_id] = { knows: 0, fan: 0 };
          }
          if (item.interaction_type === 'knows') {
            interactionsMap[item.student_id].knows += 1;
          } else if (item.interaction_type === 'fan') {
            interactionsMap[item.student_id].fan += 1;
          }
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar interacciones de estudiantes:', e);
    }

    // Obtener crushes en batch
    const crushesMap: Record<string, number> = {};
    try {
      const { data: crushes } = await supabase
        .from('student_crushes')
        .select('student_id')
        .in('student_id', studentIds);

      if (crushes) {
        crushes.forEach((c: any) => {
          crushesMap[c.student_id] = (crushesMap[c.student_id] || 0) + 1;
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar crushes de estudiantes:', e);
    }

    // Mapear con datos reales
    return students.map((p: any) => {
      const ints = interactionsMap[p.id] || { knows: 0, fan: 0 };
      
      let localCrushCount = 0;
      if (typeof window !== 'undefined') {
        try {
          const localData = JSON.parse(localStorage.getItem(`student_crushes_${p.id}`) || '[]');
          if (Array.isArray(localData)) localCrushCount = localData.length;
        } catch (e) {}
      }

      const totalCrushes = Math.max(crushesMap[p.id] || 0, localCrushCount);

      return {
        ...p,
        knows_count: ints.knows,
        fans_count: ints.fan,
        crushes_count: totalCrushes,
        score: typeof p.score === 'number' ? Number(p.score) : 0.0,
        total_ratings: typeof p.total_ratings === 'number' ? p.total_ratings : 0,
      } as Student;
    });
  } catch (err) {
    console.warn('Excepción al obtener estudiantes por instituto:', err);
    return [];
  }
}

/**
 * Obtiene la interacción actual de un usuario con un estudiante.
 */
export async function getUserStudentInteraction(
  studentId: string,
  userUid: string
): Promise<{ interaction_type: 'knows' | 'fan' | null } | null> {
  try {
    const { data, error } = await supabase
      .from('student_interactions')
      .select('interaction_type')
      .eq('student_id', studentId)
      .eq('user_uid', userUid)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
        return null;
      }
      return null;
    }

    return data as { interaction_type: 'knows' | 'fan' | null } | null;
  } catch (err) {
    return null;
  }
}

/**
 * Obtiene los conteos totales de interacciones (YO TE CONOZCO y FAN) para un estudiante.
 */
export async function getStudentInteractionCounts(studentId: string): Promise<{ knows: number; fan: number }> {
  try {
    const { data, error } = await supabase
      .from('student_interactions')
      .select('interaction_type')
      .eq('student_id', studentId);

    if (error) {
      return { knows: 0, fan: 0 };
    }

    const knows = (data || []).filter((item: any) => item.interaction_type === 'knows').length;
    const fan = (data || []).filter((item: any) => item.interaction_type === 'fan').length;

    return { knows, fan };
  } catch (err) {
    return { knows: 0, fan: 0 };
  }
}

/**
 * Incrementa de manera segura y generosa el contador de visualizaciones del perfil del estudiante.
 * Utiliza sessionStorage para no spammear en recargas continuas durante la misma sesión.
 */
export async function incrementStudentViews(studentId: string): Promise<number> {
  if (!studentId) return 0;

  const sessionKey = `starryz_viewed_student_${studentId}`;
  const alreadyViewedInSession = typeof window !== 'undefined' && sessionStorage.getItem(sessionKey);

  try {
    // 1. Obtener conteo actual
    const { data: studentData, error: fetchError } = await supabase
      .from('students')
      .select('views_count, knows_count, fans_count')
      .eq('id', studentId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Error fetching student views:', fetchError);
    }

    const currentViews = typeof studentData?.views_count === 'number' 
      ? studentData.views_count 
      : (studentData?.views_count ? Number(studentData.views_count) : 0);

    // Si ya vio en esta sesión, simplemente retornamos el conteo exacto de la BD
    if (alreadyViewedInSession) {
      return currentViews;
    }

    const nextViews = currentViews + 1;

    // Marcamos en sessionStorage para evitar loops en la misma pestaña
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, 'true');
    }

    // Actualizar en Supabase de forma directa
    supabase
      .from('students')
      .update({ views_count: nextViews })
      .eq('id', studentId)
      .then(({ error }) => {
        if (error) {
          console.debug('Nota al actualizar views_count:', error.message);
        }
      });

    return nextViews;
  } catch (err) {
    console.warn('Error al registrar visualización de estudiante:', err);
    return 0;
  }
}

/**
 * Alterna la interacción (YO TE CONOZCO / FAN) para un estudiante.
 */
export async function toggleStudentInteraction(
  studentId: string,
  userUid: string,
  type: 'knows' | 'fan',
  studentName?: string,
  actorName?: string
): Promise<{ success: boolean; action: 'inserted' | 'deleted' | 'updated'; current_type: 'knows' | 'fan' | null } | null> {
  try {
    // Verificar si ya existe interacción
    const { data: existing, error: fetchErr } = await supabase
      .from('student_interactions')
      .select('id, interaction_type')
      .eq('student_id', studentId)
      .eq('user_uid', userUid)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.warn('Error al verificar interacción de estudiante:', fetchErr);
    }

    let resultAction: 'inserted' | 'deleted' | 'updated';
    let currentType: 'knows' | 'fan' | null = null;

    if (existing) {
      if (existing.interaction_type === type) {
        // Eliminar interacción
        await supabase.from('student_interactions').delete().eq('id', existing.id);
        resultAction = 'deleted';
        currentType = null;
      } else {
        // Actualizar tipo
        await supabase
          .from('student_interactions')
          .update({ interaction_type: type })
          .eq('id', existing.id);
        resultAction = 'updated';
        currentType = type;
      }
    } else {
      // Insertar nueva
      await supabase.from('student_interactions').insert([
        {
          student_id: studentId,
          user_uid: userUid,
          interaction_type: type,
        },
      ]);
      resultAction = 'inserted';
      currentType = type;
    }

    // Disparar notificaciones a los suscriptores en segundo plano
    try {
      const counts = await getStudentInteractionCounts(studentId);
      if (type === 'knows' && resultAction === 'inserted') {
        notifyStudentSubscribers({
          studentId,
          studentName,
          eventType: 'known_added',
          actorUid: userUid,
          actorName: actorName || 'Un estudiante',
          totalCount: counts.knows
        }).catch(() => {});
      } else if (type === 'fan') {
        notifyStudentSubscribers({
          studentId,
          studentName,
          eventType: resultAction === 'inserted' ? 'fan_added' : 'fan_removed',
          actorUid: userUid,
          actorName: actorName || 'Un estudiante',
          totalCount: counts.fan
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.warn('Error disparando notificación de interacción de estudiante:', notifErr);
    }

    return { success: true, action: resultAction, current_type: currentType };
  } catch (err) {
    console.warn('Error al alternar interacción con estudiante:', err);
    return null;
  }
}

/**
 * Obtiene la lista de votos realizados por el usuario HOY para un estudiante.
 */
export async function getTodayStudentVotes(studentId: string, userUid: string): Promise<number[]> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const { data, error } = await supabase
      .from('student_votes')
      .select('stars')
      .eq('student_id', studentId)
      .eq('user_uid', userUid)
      .gte('created_at', todayIso);

    if (error) {
      return [];
    }

    return (data || []).map((v: any) => Number(v.stars));
  } catch (err) {
    return [];
  }
}

/**
 * Obtiene la distribución de calificaciones (conteo de estrellas 1 a 5) de un estudiante.
 */
export async function getStudentRatingBreakdown(studentId: string): Promise<{ [key: number]: number }> {
  const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  try {
    const { data, error } = await supabase
      .from('student_votes')
      .select('stars')
      .eq('student_id', studentId);

    if (error) {
      return breakdown;
    }

    if (data) {
      data.forEach((v: any) => {
        const s = Number(v.stars);
        if (s >= 1 && s <= 5) {
          breakdown[s] = (breakdown[s] || 0) + 1;
        }
      });
    }

    return breakdown;
  } catch (err) {
    return breakdown;
  }
}

/**
 * Registra una calificación por estrellas para un estudiante específico.
 */
export async function submitStudentVote(
  studentId: string,
  userUid: string,
  stars: number
): Promise<{ success: boolean; new_score: number; total_ratings: number; error?: string }> {
  try {
    // 1. Insertar el voto
    const { error: insertErr } = await supabase
      .from('student_votes')
      .insert([
        {
          student_id: studentId,
          user_uid: userUid,
          stars: stars,
        }
      ]);

    if (insertErr) {
      console.warn('Error al insertar voto de estudiante:', insertErr);
      return { success: false, new_score: 0, total_ratings: 0, error: insertErr.message };
    }

    // 2. Calcular nuevo promedio y total
    const { data: allVotes } = await supabase
      .from('student_votes')
      .select('stars')
      .eq('student_id', studentId);

    if (allVotes && allVotes.length > 0) {
      const sum = allVotes.reduce((acc, curr) => acc + Number(curr.stars), 0);
      const newScore = parseFloat((sum / allVotes.length).toFixed(1));
      const totalRatings = allVotes.length;

      await supabase
        .from('students')
        .update({ score: newScore, total_ratings: totalRatings })
        .eq('id', studentId);

      return { success: true, new_score: newScore, total_ratings: totalRatings };
    }

    return { success: true, new_score: stars, total_ratings: 1 };
  } catch (err: any) {
    console.error('Error al registrar calificación de estudiante:', err);
    return { success: false, new_score: 0, total_ratings: 0, error: err.message };
  }
}

/**
 * Obtiene el estado del Crush de un usuario hacia un estudiante.
 */
export async function getStudentCrushStatus(studentId: string, userUid: string): Promise<{ count: number; hasCrushed: boolean }> {
  try {
    const { data, error } = await supabase
      .from('student_crushes')
      .select('id, user_uid')
      .eq('student_id', studentId);

    if (error) {
      return { count: 0, hasCrushed: false };
    }

    const count = (data || []).length;
    const hasCrushed = (data || []).some((c: any) => c.user_uid === userUid);

    return { count, hasCrushed };
  } catch (err) {
    return { count: 0, hasCrushed: false };
  }
}

/**
 * Alterna el crush hacia un estudiante.
 */
export async function toggleStudentCrush(
  studentId: string,
  userUid: string,
  studentName?: string,
  actorName?: string
): Promise<{ success: boolean; hasCrushed: boolean; count: number; error?: string }> {
  try {
    const { data: existing, error: checkErr } = await supabase
      .from('student_crushes')
      .select('id')
      .eq('student_id', studentId)
      .eq('user_uid', userUid)
      .maybeSingle();

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.warn('Error al verificar crush de estudiante:', checkErr);
    }

    let hasCrushed = false;
    if (existing) {
      // Eliminar
      await supabase.from('student_crushes').delete().eq('id', existing.id);
      hasCrushed = false;
    } else {
      // Insertar
      await supabase.from('student_crushes').insert([
        {
          student_id: studentId,
          user_uid: userUid,
        }
      ]);
      hasCrushed = true;
    }

    // Contar total
    const { data: allCrushes } = await supabase
      .from('student_crushes')
      .select('id')
      .eq('student_id', studentId);

    const count = (allCrushes || []).length;

    // Disparar notificación a los suscriptores en segundo plano
    try {
      notifyStudentSubscribers({
        studentId,
        studentName,
        eventType: hasCrushed ? 'crush_added' : 'crush_removed',
        actorUid: userUid,
        actorName: actorName || 'Alguien anónimo',
        totalCount: count
      }).catch(() => {});
    } catch (notifErr) {
      console.warn('Error disparando notificación de crush:', notifErr);
    }

    return { success: true, hasCrushed, count };
  } catch (err: any) {
    return { success: false, hasCrushed: false, count: 0, error: err.message };
  }
}

/**
 * Actualiza la información Wiki de un estudiante.
 */
export async function updateStudentWiki(
  studentId: string,
  data: Partial<Student>
): Promise<{ success: boolean; data?: Student; error?: string }> {
  try {
    const { data: updated, error } = await supabase
      .from('students')
      .update(data)
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: updated as Student };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface StudentLoveMessage {
  id: number | string;
  student_id: string;
  user_uid: string;
  author_name: string;
  author_avatar?: string | null;
  message: string;
  created_at: string;
  hearts_count?: number;
  has_hearted?: boolean;
}

/**
 * Obtiene los mensajes de amor / confesiones crush para un estudiante.
 */
export async function getStudentLoveMessages(studentId: string, currentUserUid?: string): Promise<StudentLoveMessage[]> {
  try {
    const { data, error } = await supabase
      .from('student_love_messages')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    let messages: StudentLoveMessage[] = [];

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        // Fallback a localStorage si la tabla aún no se ha creado en Supabase
        if (typeof window !== 'undefined') {
          const local = localStorage.getItem(`student_love_messages_${studentId}`);
          if (local) {
            try {
              messages = JSON.parse(local);
            } catch (e) {}
          }
        }
      }
    } else if (data) {
      messages = data.map((msg: any) => ({
        ...msg,
        hearts_count: Number(msg.hearts_count) || 0
      })) as StudentLoveMessage[];
    }

    // Obtener los corazones que ha dado el usuario actual desde la tabla student_love_message_hearts
    let userHeartedMessageIds = new Set<string>();

    if (currentUserUid) {
      try {
        const { data: userHearts } = await supabase
          .from('student_love_message_hearts')
          .select('message_id')
          .eq('user_uid', currentUserUid);

        if (userHearts && Array.isArray(userHearts)) {
          userHearts.forEach(h => userHeartedMessageIds.add(String(h.message_id)));
        }
      } catch (hErr) {
        console.warn('Notice loading user hearts from Supabase:', hErr);
      }
    }

    // Sincronizar y enriquecer con localStorage si corresponde
    messages = messages.map(msg => {
      let isHearted = userHeartedMessageIds.has(String(msg.id));
      let heartsCount = msg.hearts_count || 0;

      if (typeof window !== 'undefined') {
        const localHearted = localStorage.getItem(`student_love_msg_heart_${msg.id}_${currentUserUid}`);
        if (localHearted === 'true') {
          isHearted = true;
        } else if (localHearted === 'false') {
          isHearted = false;
        }

        const localCount = localStorage.getItem(`student_love_msg_count_${msg.id}`);
        if (localCount !== null) {
          heartsCount = Math.max(heartsCount, parseInt(localCount, 10) || 0);
        }
      }

      return {
        ...msg,
        hearts_count: heartsCount,
        has_hearted: isHearted
      };
    });

    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(messages));
    }

    return messages;
  } catch (err) {
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem(`student_love_messages_${studentId}`);
      if (local) {
        try {
          const parsed: StudentLoveMessage[] = JSON.parse(local);
          return parsed.map(msg => ({
            ...msg,
            has_hearted: currentUserUid
              ? localStorage.getItem(`student_love_msg_heart_${msg.id}_${currentUserUid}`) === 'true'
              : false
          }));
        } catch (e) {}
      }
    }
    return [];
  }
}

/**
 * Alterna el corazón (like) a un mensaje de amor:
 * 1. Inserta o elimina en la tabla student_love_message_hearts (quién dio el corazón)
 * 2. Suma o resta en student_love_messages.hearts_count (contador general)
 */
export async function toggleStudentLoveMessageHeart(
  messageId: number | string,
  userUid: string,
  studentId: string
): Promise<{ success: boolean; hasHearted: boolean; heartsCount: number; error?: string }> {
  try {
    // 1. Consultar si el usuario ya dio corazón a este mensaje en Supabase
    let alreadyHearted = false;
    try {
      const { data: existingHeart } = await supabase
        .from('student_love_message_hearts')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_uid', userUid)
        .maybeSingle();

      alreadyHearted = !!existingHeart;
    } catch (e) {
      // Si la tabla no existe aún, chequear localStorage
      if (typeof window !== 'undefined') {
        alreadyHearted = localStorage.getItem(`student_love_msg_heart_${messageId}_${userUid}`) === 'true';
      }
    }

    let newHeartsCount = 0;
    let nextHasHearted = !alreadyHearted;

    // 2. Obtener el conteo actual del mensaje
    let currentCount = 0;
    try {
      const { data: msgData } = await supabase
        .from('student_love_messages')
        .select('hearts_count')
        .eq('id', messageId)
        .maybeSingle();

      if (msgData && msgData.hearts_count !== undefined && msgData.hearts_count !== null) {
        currentCount = Number(msgData.hearts_count) || 0;
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`student_love_msg_count_${messageId}`);
      if (cached !== null) {
        currentCount = Math.max(currentCount, parseInt(cached, 10) || 0);
      }
    }

    if (alreadyHearted) {
      // Quitar corazón: restar -1
      newHeartsCount = Math.max(0, currentCount - 1);

      // Eliminar de student_love_message_hearts
      await supabase
        .from('student_love_message_hearts')
        .delete()
        .eq('message_id', messageId)
        .eq('user_uid', userUid);
    } else {
      // Dar corazón: sumar +1
      newHeartsCount = currentCount + 1;

      // Insertar en student_love_message_hearts
      await supabase
        .from('student_love_message_hearts')
        .insert([{
          message_id: messageId,
          user_uid: userUid,
          created_at: new Date().toISOString()
        }]);
    }

    // 3. Actualizar la columna general hearts_count en student_love_messages
    try {
      await supabase
        .from('student_love_messages')
        .update({ hearts_count: newHeartsCount })
        .eq('id', messageId);
    } catch (upErr) {
      console.warn('Notice updating hearts_count on student_love_messages:', upErr);
    }

    // 4. Guardar en localStorage para respuesta instantánea local
    if (typeof window !== 'undefined') {
      localStorage.setItem(`student_love_msg_heart_${messageId}_${userUid}`, String(nextHasHearted));
      localStorage.setItem(`student_love_msg_count_${messageId}`, String(newHeartsCount));

      const localMsgsRaw = localStorage.getItem(`student_love_messages_${studentId}`);
      if (localMsgsRaw) {
        try {
          const msgs: StudentLoveMessage[] = JSON.parse(localMsgsRaw);
          const updated = msgs.map(m => {
            if (String(m.id) === String(messageId)) {
              return {
                ...m,
                hearts_count: newHeartsCount,
                has_hearted: nextHasHearted
              };
            }
            return m;
          });
          localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(updated));
        } catch (e) {}
      }
    }

    return {
      success: true,
      hasHearted: nextHasHearted,
      heartsCount: newHeartsCount
    };
  } catch (err: any) {
    console.error('Error toggling love message heart:', err);
    return {
      success: false,
      hasHearted: false,
      heartsCount: 0,
      error: err.message
    };
  }
}

/**
 * Crea un nuevo mensaje de amor para un estudiante (máximo 500 caracteres).
 */
export async function createStudentLoveMessage(
  studentId: string,
  userUid: string,
  authorName: string,
  authorAvatar: string | null,
  message: string,
  studentName?: string
): Promise<{ success: boolean; data?: StudentLoveMessage; error?: string }> {
  try {
    const trimmed = message.trim();
    if (!trimmed) {
      return { success: false, error: 'El mensaje no puede estar vacío.' };
    }
    if (trimmed.length > 500) {
      return { success: false, error: 'El mensaje no debe superar los 500 caracteres.' };
    }

    const payload = {
      student_id: studentId,
      user_uid: userUid,
      author_name: authorName || 'Anónimo',
      author_avatar: authorAvatar || null,
      message: trimmed,
      hearts_count: 0,
      created_at: new Date().toISOString()
    };

    let createdMsg: StudentLoveMessage | null = null;

    const { data, error } = await supabase
      .from('student_love_messages')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Aviso al insertar en Supabase student_love_messages:', error.message);
      // Fallback local
      if (typeof window !== 'undefined') {
        const localItem: StudentLoveMessage = {
          id: Date.now(),
          ...payload
        };
        const prev = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
        const updated = [localItem, ...prev];
        localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(updated));
        createdMsg = localItem;
      } else {
        return { success: false, error: error.message };
      }
    } else {
      createdMsg = { ...data, hearts_count: 0, has_hearted: false } as StudentLoveMessage;
    }

    // Disparar notificación a los suscriptores en segundo plano
    try {
      const snippet = trimmed.length > 60 ? `${trimmed.substring(0, 57)}...` : trimmed;
      notifyStudentSubscribers({
        studentId,
        studentName,
        eventType: 'love_message',
        actorUid: userUid,
        actorName: authorName || 'Alguien anónimo',
        loveMessageSnippet: snippet
      }).catch(() => {});
    } catch (notifErr) {
      console.warn('Error al disparar notificación de mensaje de amor:', notifErr);
    }

    return { success: true, data: createdMsg || undefined };
  } catch (err: any) {
    console.error('Error al crear mensaje de amor:', err);
    return { success: false, error: err.message || 'Error inesperado' };
  }
}

/**
 * Elimina un mensaje de amor propio.
 */
export async function deleteStudentLoveMessage(
  messageId: number | string,
  userUid: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('student_love_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_uid', userUid);

    if (typeof window !== 'undefined') {
      const prev: StudentLoveMessage[] = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
      const updated = prev.filter(m => String(m.id) !== String(messageId));
      localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(updated));
    }

    if (error) {
      console.warn('Error al borrar mensaje en Supabase:', error.message);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 🔔 SISTEMA DE SUSCRIPCIÓN Y NOTIFICACIONES DE PERFILES DE ESTUDIANTES
// ============================================================================

export interface StudentNotificationPreferences {
  notify_crush: boolean;
  notify_love_message: boolean;
  notify_known: boolean;
  notify_fan: boolean;
}

const DEFAULT_PREFERENCES: StudentNotificationPreferences = {
  notify_crush: true,
  notify_love_message: true,
  notify_known: true,
  notify_fan: true
};

/**
 * Obtiene las preferencias de notificación de un usuario para un estudiante específico.
 */
export async function getStudentNotificationPreferences(
  studentId: string,
  userUid: string
): Promise<StudentNotificationPreferences | null> {
  try {
    // 1. Intentar consultar en Supabase
    const { data, error } = await supabase
      .from('student_notification_subscriptions')
      .select('notify_crush, notify_love_message, notify_known, notify_fan')
      .eq('student_id', studentId)
      .eq('user_uid', userUid)
      .maybeSingle();

    if (!error && data) {
      const prefs: StudentNotificationPreferences = {
        notify_crush: data.notify_crush ?? true,
        notify_love_message: data.notify_love_message ?? true,
        notify_known: data.notify_known ?? true,
        notify_fan: data.notify_fan ?? true
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`student_notif_sub_${studentId}_${userUid}`, JSON.stringify(prefs));
      }
      return prefs;
    }

    // 2. Fallback de localStorage
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`student_notif_sub_${studentId}_${userUid}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    return null;
  } catch (err) {
    console.warn('Notice fetching student notification preferences:', err);
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`student_notif_sub_${studentId}_${userUid}`);
      if (cached) return JSON.parse(cached);
    }
    return null;
  }
}

/**
 * Guarda o actualiza las preferencias de suscripción para un perfil de estudiante.
 */
export async function saveStudentNotificationPreferences(
  studentId: string,
  userUid: string,
  prefs: StudentNotificationPreferences
): Promise<{ success: boolean; error?: string }> {
  try {
    // Guardar en localStorage inmediatamente
    if (typeof window !== 'undefined') {
      localStorage.setItem(`student_notif_sub_${studentId}_${userUid}`, JSON.stringify(prefs));
    }

    // Upsert en Supabase
    const { error } = await supabase
      .from('student_notification_subscriptions')
      .upsert(
        {
          student_id: studentId,
          user_uid: userUid,
          notify_crush: prefs.notify_crush,
          notify_love_message: prefs.notify_love_message,
          notify_known: prefs.notify_known,
          notify_fan: prefs.notify_fan,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'student_id,user_uid' }
      );

    if (error) {
      console.warn('Supabase notice on saving student subscription:', error.message);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al guardar preferencias de notificación de estudiante:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Desactiva y elimina la suscripción a un estudiante.
 */
export async function removeStudentNotificationSubscription(
  studentId: string,
  userUid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`student_notif_sub_${studentId}_${userUid}`);
    }

    const { error } = await supabase
      .from('student_notification_subscriptions')
      .delete()
      .eq('student_id', studentId)
      .eq('user_uid', userUid);

    if (error) {
      console.warn('Notice removing student notification subscription:', error.message);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Notifica a todos los usuarios suscritos a las novedades de un perfil de estudiante.
 */
export async function notifyStudentSubscribers(params: {
  studentId: string;
  studentName?: string;
  eventType: 'crush_added' | 'crush_removed' | 'love_message' | 'known_added' | 'fan_added' | 'fan_removed';
  actorUid?: string;
  actorName?: string;
  totalCount?: number;
  loveMessageSnippet?: string;
}): Promise<void> {
  const { studentId, studentName, eventType, actorUid, actorName, totalCount = 0, loveMessageSnippet } = params;

  try {
    // 1. Obtener nombre del estudiante si no viene provisto
    let displayName = studentName;
    let studentCreatorUid: string | null = null;

    if (!displayName) {
      try {
        const { data: st } = await supabase
          .from('students')
          .select('nombre, apellidos, nombre_completo, created_by')
          .eq('id', studentId)
          .maybeSingle();

        if (st) {
          displayName = st.nombre_completo || `${st.nombre} ${st.apellidos}`;
          studentCreatorUid = st.created_by || null;
        }
      } catch {}
    }

    const targetName = displayName || 'este perfil';

    // 2. Construir título, cuerpo y tipo según el evento
    let notifTitle = '';
    let notifBody = '';
    let notifCategory = 'general';
    let filterColumn: keyof StudentNotificationPreferences = 'notify_crush';

    switch (eventType) {
      case 'crush_added':
        notifTitle = '¡Nuevo Flechazo en el Campus! 💘';
        notifBody = `Alguien acaba de marcar como su Crush a ${targetName}. Total actual: ${totalCount} ${totalCount === 1 ? 'flechazo' : 'flechazos'}.`;
        notifCategory = 'crush_added';
        filterColumn = 'notify_crush';
        break;

      case 'crush_removed':
        notifTitle = 'Actualización de Crush 💔';
        notifBody = `Se ha retirado un flechazo en el perfil de ${targetName}. Total actual: ${totalCount} ${totalCount === 1 ? 'flechazo' : 'flechazos'}.`;
        notifCategory = 'crush_removed';
        filterColumn = 'notify_crush';
        break;

      case 'love_message':
        notifTitle = '¡Nueva Confesión de Amor! 💌';
        notifBody = `${actorName || 'Alguien'} ha dejado un mensaje de amor en el perfil de ${targetName}${loveMessageSnippet ? `: "${loveMessageSnippet}"` : ''}. ¡Entra a leerlo!`;
        notifCategory = 'love_message';
        filterColumn = 'notify_love_message';
        break;

      case 'known_added':
        notifTitle = '¡Alguien te reconoció! 👥';
        notifBody = `Un estudiante del campus ha indicado que conoce a ${targetName}. Total: ${totalCount} ${totalCount === 1 ? 'persona' : 'personas'}.`;
        notifCategory = 'known';
        filterColumn = 'notify_known';
        break;

      case 'fan_added':
        notifTitle = '¡Tienes un nuevo Fan! ⭐';
        notifBody = `Un usuario se ha sumado como fan del perfil de ${targetName}. Total: ${totalCount} ${totalCount === 1 ? 'fan' : 'fans'}.`;
        notifCategory = 'fan';
        filterColumn = 'notify_fan';
        break;

      case 'fan_removed':
        notifTitle = 'Actualización de Fans ⭐';
        notifBody = `Un usuario ha dejado de ser fan de ${targetName}. Total actual: ${totalCount} ${totalCount === 1 ? 'fan' : 'fans'}.`;
        notifCategory = 'fan';
        filterColumn = 'notify_fan';
        break;
    }

    const linkUrl = `/estudiantes/${studentId}`;

    // 3. Obtener suscriptores desde Supabase
    let subscriberUids = new Set<string>();

    try {
      const { data: subs, error } = await supabase
        .from('student_notification_subscriptions')
        .select('user_uid')
        .eq('student_id', studentId)
        .eq(filterColumn, true);

      if (!error && subs) {
        subs.forEach(s => {
          if (s.user_uid && s.user_uid !== actorUid) {
            subscriberUids.add(s.user_uid);
          }
        });
      }
    } catch (subErr) {
      console.warn('Aviso consultando suscriptores de estudiante:', subErr);
    }

    // 4. Si el creador del estudiante es conocido y no es el actor, incluirlo
    if (studentCreatorUid && studentCreatorUid !== actorUid) {
      subscriberUids.add(studentCreatorUid);
    }

    if (subscriberUids.size === 0) return;

    // 5. Insertar notificaciones en Supabase para cada suscriptor
    const insertPayloads = Array.from(subscriberUids).map(uid => ({
      user_uid: uid,
      title: notifTitle,
      body: notifBody,
      link_url: linkUrl,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    try {
      const { error: insertErr } = await supabase
        .from('notifications')
        .insert(insertPayloads);

      if (insertErr) {
        console.warn('Notice inserting student notifications:', insertErr.message);
      }
    } catch (err) {
      console.warn('Error inserting student notifications to database:', err);
    }

    // 6. Invocar Push Notifications vía Edge Function
    const soundFile = (eventType === 'crush_added' || eventType === 'love_message') ? 'iloveyou.mp3' : 'noti.mp3';

    for (const uid of subscriberUids) {
      try {
        supabase.functions.invoke('rapid-processor', {
          body: {
            user_uid: uid,
            title: notifTitle,
            body: notifBody,
            link_url: linkUrl,
            category: notifCategory,
            type: notifCategory,
            event_type: eventType,
            sound: soundFile
          }
        }).catch(() => {});
      } catch {}
    }
  } catch (err) {
    console.error('Error en notifyStudentSubscribers:', err);
  }
}

export interface UserStudentSubscriptionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentCareer: string;
  studentAvatar?: string | null;
  preferences: StudentNotificationPreferences;
  createdAt?: string;
}

/**
 * Obtiene todas las suscripciones a estudiantes realizadas por el usuario.
 */
export async function getUserStudentSubscriptions(userUid: string): Promise<UserStudentSubscriptionItem[]> {
  if (!userUid) return [];

  const items: UserStudentSubscriptionItem[] = [];
  const studentIds = new Set<string>();
  const prefsMap = new Map<string, { prefs: StudentNotificationPreferences; createdAt?: string }>();

  try {
    // 1. Consultar en Supabase
    try {
      const { data, error } = await supabase
        .from('student_notification_subscriptions')
        .select('*')
        .eq('user_uid', userUid)
        .order('created_at', { ascending: false });

      if (!error && data) {
        data.forEach((row: any) => {
          const sId = row.student_id;
          studentIds.add(sId);
          prefsMap.set(sId, {
            prefs: {
              notify_crush: row.notify_crush ?? true,
              notify_love_message: row.notify_love_message ?? true,
              notify_known: row.notify_known ?? true,
              notify_fan: row.notify_fan ?? true,
            },
            createdAt: row.created_at
          });
        });
      }
    } catch (e) {
      console.warn('Aviso consultando suscripciones de estudiantes en Supabase:', e);
    }

    // 2. Fallback con localStorage
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('student_notif_sub_') && key.endsWith(`_${userUid}`)) {
            const sId = key.replace('student_notif_sub_', '').replace(`_${userUid}`, '');
            if (!studentIds.has(sId)) {
              try {
                const cachedPrefs = JSON.parse(localStorage.getItem(key) || '{}');
                const hasActive = Object.values(cachedPrefs).some(Boolean);
                if (hasActive) {
                  studentIds.add(sId);
                  prefsMap.set(sId, {
                    prefs: {
                      notify_crush: cachedPrefs.notify_crush ?? true,
                      notify_love_message: cachedPrefs.notify_love_message ?? true,
                      notify_known: cachedPrefs.notify_known ?? true,
                      notify_fan: cachedPrefs.notify_fan ?? true,
                    }
                  });
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('Error leyendo localStorage de suscripciones de estudiantes:', e);
      }
    }

    if (studentIds.size === 0) return [];

    // 3. Enriquecer con datos de la tabla 'students'
    const studentsArray = Array.from(studentIds);
    const studentDataMap = new Map<string, any>();

    try {
      const { data: students, error: stErr } = await supabase
        .from('students')
        .select('id, nombre, apellidos, nombre_completo, avatar_url, carrera')
        .in('id', studentsArray);

      if (!stErr && students) {
        students.forEach((s: any) => studentDataMap.set(s.id.toLowerCase(), s));
      }
    } catch (e) {
      console.warn('Aviso enriqueciendo datos de estudiantes:', e);
    }

    studentsArray.forEach(id => {
      const s = studentDataMap.get(id.toLowerCase());
      const subInfo = prefsMap.get(id);
      items.push({
        id: `student_sub_${id}`,
        studentId: id,
        studentName: s?.nombre_completo || (s ? `${s.nombre} ${s.apellidos}`.trim() : id),
        studentCareer: s?.carrera || 'Estudiante',
        studentAvatar: s?.avatar_url || null,
        preferences: subInfo?.prefs || {
          notify_crush: true,
          notify_love_message: true,
          notify_known: true,
          notify_fan: true
        },
        createdAt: subInfo?.createdAt
      });
    });

    return items;
  } catch (err) {
    console.error('Error al obtener lista de suscripciones a estudiantes:', err);
    return [];
  }
}


