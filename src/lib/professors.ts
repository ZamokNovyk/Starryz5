import { supabase } from './supabase';

export interface Professor {
  id: string; // generated slug e.g. "belinda.aguirre.ponte"
  nombre: string;
  apellidos: string;
  nombre_completo: string; // snake_case column
  nombreCompleto?: string;  // camelCase fallback column
  role: 'Alumno' | 'Profesor';
  institute_id: string;     // snake_case column
  instituteId?: string;      // camelCase fallback column
  created_by: string;
  created_at?: string;
  knows_count?: number;
  fans_count?: number;
  crushes_count?: number;
  score?: number;
  total_ratings?: number;
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

export interface CreateProfessorData {
  nombre: string;
  apellidos: string;
  role: 'Alumno' | 'Profesor';
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
 * Inserta un nuevo miembro (Profesor o Alumno) en la tabla 'professors' de Supabase.
 */
export async function createProfessor(data: CreateProfessorData, firebaseUid: string): Promise<Professor> {
  const { nombre, apellidos, role, instituteId } = data;
  if (!nombre.trim() || !apellidos.trim()) {
    throw new Error('Nombres y apellidos son requeridos.');
  }

  const slugId = toSlug(nombre, apellidos);
  const nombreCompleto = `${nombre.trim()} ${apellidos.trim()}`;

  // Usamos estrictamente el formato estándar snake_case de Postgres para evitar conflictos con la caché de PostgREST de Supabase
  const insertPayload = {
    id: slugId,
    nombre: nombre.trim(),
    apellidos: apellidos.trim(),
    nombre_completo: nombreCompleto,
    role: role,
    institute_id: instituteId,
    created_by: firebaseUid,
  };

  const { data: inserted, error } = await supabase
    .from('professors')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('Error al insertar profesor en Supabase:', error);
    throw new Error(error.message || 'No se pudo guardar el miembro en la base de datos.');
  }

  return inserted as Professor;
}

/**
 * Carga la información del perfil del profesor por su ID / slug.
 */
export async function getProfessorById(slug: string): Promise<Professor | null> {
  try {
    const { data, error } = await supabase
      .from('professors')
      .select('*')
      .eq('id', slug.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return null;
      }
      console.warn('Aviso al obtener perfil de profesor por ID:', error.message || error);
      return null;
    }

    return data as Professor | null;
  } catch (err) {
    console.warn('Excepción de red al obtener profesor por ID:', err);
    return null;
  }
}

/**
 * Obtiene los profesores asignados a un instituto / campus específico con sus conteos reales.
 */
export async function getProfessorsByInstitute(instituteId: string): Promise<Professor[]> {
  try {
    const { data: profs, error } = await supabase
      .from('professors')
      .select('*')
      .eq('institute_id', instituteId);

    if (error) {
      if (error.code === 'P0001' || error.message?.includes('does not exist')) {
        return [];
      }
      console.warn('Aviso al obtener profesores por instituto:', error.message || error);
      return [];
    }

    if (!profs || profs.length === 0) {
      return [];
    }

    const profIds = profs.map((p: any) => p.id);

    // Obtener interacciones (knows / fan) en batch para todos los profesores del instituto
    const interactionsMap: Record<string, { knows: number; fan: number }> = {};
    try {
      const { data: interactions } = await supabase
        .from('professor_interactions')
        .select('professor_id, interaction_type')
        .in('professor_id', profIds);

      if (interactions) {
        interactions.forEach((item: any) => {
          if (!interactionsMap[item.professor_id]) {
            interactionsMap[item.professor_id] = { knows: 0, fan: 0 };
          }
          if (item.interaction_type === 'knows') {
            interactionsMap[item.professor_id].knows += 1;
          } else if (item.interaction_type === 'fan') {
            interactionsMap[item.professor_id].fan += 1;
          }
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar interacciones de profesores:', e);
    }

    // Obtener crushes en batch
    const crushesMap: Record<string, number> = {};
    try {
      const { data: crushes } = await supabase
        .from('professor_crushes')
        .select('professor_id')
        .in('professor_id', profIds);

      if (crushes) {
        crushes.forEach((c: any) => {
          crushesMap[c.professor_id] = (crushesMap[c.professor_id] || 0) + 1;
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar crushes de profesores:', e);
    }

    // Mapear con datos reales
    return profs.map((p: any) => {
      const ints = interactionsMap[p.id] || { knows: 0, fan: 0 };
      
      // Fallback local storage crushes si aplica
      let localCrushCount = 0;
      if (typeof window !== 'undefined') {
        try {
          const localData = JSON.parse(localStorage.getItem(`crushes_${p.id}`) || '[]');
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
      } as Professor;
    });
  } catch (err) {
    console.warn('Excepción de red al obtener profesores por instituto:', err);
    return [];
  }
}

/**
 * Obtiene la interacción actual de un usuario con un profesor.
 */
export async function getUserProfessorInteraction(
  professorId: string,
  userUid: string
): Promise<{ interaction_type: 'knows' | 'fan' | null } | null> {
  try {
    const { data, error } = await supabase
      .from('professor_interactions')
      .select('interaction_type')
      .eq('professor_id', professorId)
      .eq('user_uid', userUid)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return null;
      }
      console.warn('Aviso al obtener la interacción del usuario:', error.message || error);
      return null;
    }

    return data as { interaction_type: 'knows' | 'fan' | null } | null;
  } catch (err) {
    console.warn('Excepción de red al consultar interacción:', err);
    return null;
  }
}

/**
 * Obtiene los conteos totales de interacciones (YO TE CONOZCO y FAN) para un profesor.
 */
export async function getProfessorInteractionCounts(professorId: string): Promise<{ knows: number; fan: number }> {
  try {
    const { data, error } = await supabase
      .from('professor_interactions')
      .select('interaction_type')
      .eq('professor_id', professorId);

    if (error) {
      return { knows: 0, fan: 0 };
    }

    const knows = (data || []).filter((item: any) => item.interaction_type === 'knows').length;
    const fan = (data || []).filter((item: any) => item.interaction_type === 'fan').length;

    return { knows, fan };
  } catch (err) {
    console.warn('Excepción de red al obtener conteo de interacciones:', err);
    return { knows: 0, fan: 0 };
  }
}

/**
 * Alterna la interacción (YO TE CONOZCO / FAN) usando RPC en Supabase.
 */
export async function toggleProfessorInteraction(
  professorId: string,
  userUid: string,
  type: 'knows' | 'fan'
): Promise<{ success: boolean; action: 'inserted' | 'deleted' | 'updated'; current_type: 'knows' | 'fan' | null } | null> {
  try {
    const { data, error } = await supabase.rpc('toggle_professor_interaction', {
      p_professor_id: professorId,
      p_user_uid: userUid,
      p_target_type: type
    });

    if (error) {
      console.warn('Aviso al ejecutar RPC toggle_professor_interaction:', error.message || error);
      return null;
    }

    return data as any;
  } catch (err) {
    console.warn('Excepción de red al alternar interacción:', err);
    return null;
  }
}

/**
 * Obtiene la lista de votos realizados por el usuario HOY para un profesor específico.
 */
export async function getTodayProfessorVotes(professorId: string, userUid: string): Promise<number[]> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayIso = todayStart.toISOString();

    const { data, error } = await supabase
      .from('professor_votes')
      .select('stars')
      .eq('professor_id', professorId)
      .eq('user_uid', userUid)
      .gte('created_at', todayIso);

    if (error) {
      return [];
    }

    return (data || []).map((v: any) => Number(v.stars));
  } catch (err) {
    console.warn('Excepción de red al obtener votos:', err);
    return [];
  }
}

/**
 * Obtiene la distribución de calificaciones (conteo de estrellas 1 a 5) de un profesor.
 */
export async function getProfessorRatingBreakdown(professorId: string): Promise<{ [key: number]: number }> {
  const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  try {
    const { data, error } = await supabase
      .from('professor_votes')
      .select('stars')
      .eq('professor_id', professorId);

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
    console.warn('Excepción de red al obtener breakdown:', err);
    return breakdown;
  }
}

/**
 * Registra una calificación por estrellas para un profesor específico.
 */
export async function submitProfessorVote(
  professorId: string, 
  userUid: string, 
  stars: number
): Promise<{ success: boolean; new_score: number; new_total: number } | null> {
  const { data, error } = await supabase.rpc('add_professor_vote', {
    p_professor_id: professorId,
    p_user_uid: userUid,
    p_stars: stars
  });

  if (error) {
    console.error('Error al registrar calificación (RPC add_professor_vote):', error);
    throw error;
  }

  return data as any;
}

/**
 * Actualiza la información Wiki de un profesor en Supabase.
 */
export async function updateProfessorWiki(
  professorId: string,
  wikiData: {
    avatar_url: string;
    height_cm: number | null;
    marital_status: string;
    gender: string;
    birth_date: string | null;
    instagram_url: string;
    youtube_url: string;
    facebook_url: string;
    twitter_url: string;
    biography: string;
  }
): Promise<{ success: boolean }> {
  try {
    const { error } = await supabase
      .from('professors')
      .update({
        avatar_url: wikiData.avatar_url || null,
        height_cm: wikiData.height_cm,
        marital_status: wikiData.marital_status || 'No especificado',
        gender: wikiData.gender || 'No especificado',
        birth_date: wikiData.birth_date,
        instagram_url: wikiData.instagram_url || null,
        youtube_url: wikiData.youtube_url || null,
        facebook_url: wikiData.facebook_url || null,
        twitter_url: wikiData.twitter_url || null,
        biography: wikiData.biography || null
      })
      .eq('id', professorId);

    if (error) {
      console.warn('Aviso al actualizar la Wiki del profesor:', error.message || error);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.warn('Excepción de red al actualizar wiki:', err);
    return { success: false };
  }
}

/**
 * Obtiene todos los profesores registrados en Supabase para búsquedas globales.
 */
export async function getAllProfessors(): Promise<Professor[]> {
  try {
    const { data, error } = await supabase
      .from('professors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'P0001' || error.message?.includes('does not exist')) {
        return [];
      }
      console.warn('Aviso al consultar profesores en Supabase:', error.message || error);
      return [];
    }

    return (data as Professor[]) || [];
  } catch (err) {
    console.warn('Excepción de red o conexión al obtener profesores:', err);
    return [];
  }
}

/**
 * Obtiene el estado inicial de flechazos (Crushes) para un profesor:
 * - Total de votos (count)
 * - Si el usuario actual (firebase_uid) ya dio crush
 */
export async function getProfessorCrushStatus(
  professorId: string,
  userUid?: string
): Promise<{ count: number; hasCrushed: boolean }> {
  try {
    // 1. Obtener conteo total
    const { count, error: countError } = await supabase
      .from('professor_crushes')
      .select('*', { count: 'exact', head: true })
      .eq('professor_id', professorId);

    if (countError) {
      // Fallback a almacenamiento local si la tabla aún no existe
      const localData = JSON.parse(localStorage.getItem(`crushes_${professorId}`) || '[]');
      return {
        count: Array.isArray(localData) ? localData.length : 0,
        hasCrushed: userUid && Array.isArray(localData) ? localData.includes(userUid) : false,
      };
    }

    // 2. Verificar si el usuario actual ya votó
    let hasCrushed = false;
    if (userUid) {
      const { data: userCrush, error: userError } = await supabase
        .from('professor_crushes')
        .select('id')
        .eq('professor_id', professorId)
        .eq('firebase_uid', userUid)
        .maybeSingle();

      if (!userError && userCrush) {
        hasCrushed = true;
      }
    }

    return {
      count: typeof count === 'number' ? count : 0,
      hasCrushed,
    };
  } catch (err) {
    console.warn('Excepción al consultar crushes del profesor:', err);
    const localData = JSON.parse(localStorage.getItem(`crushes_${professorId}`) || '[]');
    return {
      count: Array.isArray(localData) ? localData.length : 0,
      hasCrushed: userUid && Array.isArray(localData) ? localData.includes(userUid) : false,
    };
  }
}

/**
 * Alterna el voto de Crush para un profesor:
 * Si el usuario ya votó, elimina el voto. Si no ha votado, inserta la fila.
 */
export async function toggleProfessorCrush(
  professorId: string,
  userUid: string
): Promise<{ hasCrushed: boolean }> {
  try {
    // Verificar si ya existe el voto
    const { data: existing, error: checkError } = await supabase
      .from('professor_crushes')
      .select('id')
      .eq('professor_id', professorId)
      .eq('firebase_uid', userUid)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116' && !checkError.message?.includes('does not exist')) {
      throw checkError;
    }

    if (existing) {
      // Ya votó: Eliminar el voto
      const { error: deleteError } = await supabase
        .from('professor_crushes')
        .delete()
        .eq('professor_id', professorId)
        .eq('firebase_uid', userUid);

      if (deleteError) throw deleteError;

      // Actualizar fallback local
      const localData: string[] = JSON.parse(localStorage.getItem(`crushes_${professorId}`) || '[]');
      const filtered = localData.filter(uid => uid !== userUid);
      localStorage.setItem(`crushes_${professorId}`, JSON.stringify(filtered));

      return { hasCrushed: false };
    } else {
      // No ha votado: Insertar el nuevo crush
      const { error: insertError } = await supabase
        .from('professor_crushes')
        .insert([{ professor_id: professorId, firebase_uid: userUid }]);

      if (insertError) throw insertError;

      // Actualizar fallback local
      const localData: string[] = JSON.parse(localStorage.getItem(`crushes_${professorId}`) || '[]');
      if (!localData.includes(userUid)) {
        localData.push(userUid);
        localStorage.setItem(`crushes_${professorId}`, JSON.stringify(localData));
      }

      return { hasCrushed: true };
    }
  } catch (err: any) {
    console.warn('Fallback a almacenamiento local para alternar crush:', err?.message || err);
    // Fallback local
    const localData: string[] = JSON.parse(localStorage.getItem(`crushes_${professorId}`) || '[]');
    let nowCrushed = false;
    if (localData.includes(userUid)) {
      const filtered = localData.filter(uid => uid !== userUid);
      localStorage.setItem(`crushes_${professorId}`, JSON.stringify(filtered));
      nowCrushed = false;
    } else {
      localData.push(userUid);
      localStorage.setItem(`crushes_${professorId}`, JSON.stringify(localData));
      nowCrushed = true;
    }
    return { hasCrushed: nowCrushed };
  }
}

export interface UserInteractionItem {
  id: string;
  type: 'crush' | 'fan' | 'knows';
  typeLabel: 'CRUSH' | 'FAN' | 'YO TE CONOZCO';
  professorId: string;
  professorName: string;
  professorRole: string;
  professorAvatar?: string | null;
  createdAt?: string;
}

function formatSlugToName(slug: string): string {
  return slug
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Obtiene todas las interacciones realizadas por el usuario:
 * - Crushes (Flechazos en professor_crushes)
 * - Votos / Interacciones (Fan y Yo te conozco en professor_interactions)
 */
export async function getUserInteractions(userUid: string): Promise<UserInteractionItem[]> {
  const items: UserInteractionItem[] = [];
  const professorIds = new Set<string>();

  try {
    // 1. Obtener Crushes de Supabase
    try {
      const { data: crushes, error: crushErr } = await supabase
        .from('professor_crushes')
        .select('*')
        .eq('firebase_uid', userUid)
        .order('created_at', { ascending: false });

      if (!crushErr && crushes) {
        crushes.forEach((c: any) => {
          professorIds.add(c.professor_id);
          items.push({
            id: `crush_${c.professor_id}`,
            type: 'crush',
            typeLabel: 'CRUSH',
            professorId: c.professor_id,
            professorName: formatSlugToName(c.professor_id),
            professorRole: 'Profesor',
            createdAt: c.created_at,
          });
        });
      }
    } catch (e) {
      console.warn('Aviso al consultar crushes del usuario:', e);
    }

    // 2. Obtener Interacciones (Fan / Yo te conozco) de Supabase
    try {
      const { data: interactions, error: intErr } = await supabase
        .from('professor_interactions')
        .select('*')
        .eq('user_uid', userUid);

      if (!intErr && interactions) {
        interactions.forEach((i: any) => {
          professorIds.add(i.professor_id);
          const isFan = i.interaction_type === 'fan';
          items.push({
            id: `${i.interaction_type}_${i.professor_id}`,
            type: isFan ? 'fan' : 'knows',
            typeLabel: isFan ? 'FAN' : 'YO TE CONOZCO',
            professorId: i.professor_id,
            professorName: formatSlugToName(i.professor_id),
            professorRole: 'Profesor',
            createdAt: i.created_at,
          });
        });
      }
    } catch (e) {
      console.warn('Aviso al consultar interacciones del usuario:', e);
    }

    // 3. Fallback a LocalStorage para crushes locales
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('crushes_')) {
          const profId = key.replace('crushes_', '');
          const localCrushes: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          if (localCrushes.includes(userUid)) {
            if (!items.some(item => item.id === `crush_${profId}`)) {
              professorIds.add(profId);
              items.push({
                id: `crush_${profId}`,
                type: 'crush',
                typeLabel: 'CRUSH',
                professorId: profId,
                professorName: formatSlugToName(profId),
                professorRole: 'Profesor',
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error reading local storage interactions:', e);
    }

    // 4. Enriquecer con los nombres y fotos reales de la tabla 'professors'
    if (professorIds.size > 0) {
      try {
        const idsArray = Array.from(professorIds);
        const { data: profs, error: profsErr } = await supabase
          .from('professors')
          .select('id, nombre, apellidos, nombre_completo, avatar_url, role')
          .in('id', idsArray);

        if (!profsErr && profs) {
          const profMap = new Map<string, any>();
          profs.forEach((p: any) => profMap.set(p.id.toLowerCase(), p));

          items.forEach(item => {
            const p = profMap.get(item.professorId.toLowerCase());
            if (p) {
              item.professorName = p.nombre_completo || `${p.nombre} ${p.apellidos}`.trim() || item.professorName;
              item.professorRole = p.role || item.professorRole;
              item.professorAvatar = p.avatar_url || null;
            }
          });
        }
      } catch (e) {
        console.warn('Aviso al enriquecer datos de profesores:', e);
      }
    }

    return items;
  } catch (err) {
    console.error('Error al obtener interacciones completas del usuario:', err);
    return items;
  }
}

/**
 * Elimina una interacción (Crush, Fan o Yo te conozco) directamente desde el perfil
 */
export async function removeUserInteraction(
  userUid: string,
  professorId: string,
  type: 'crush' | 'fan' | 'knows'
): Promise<boolean> {
  try {
    if (type === 'crush') {
      // Eliminar de professor_crushes
      await supabase
        .from('professor_crushes')
        .delete()
        .eq('professor_id', professorId)
        .eq('firebase_uid', userUid);

      // Limpiar fallback local
      const localData: string[] = JSON.parse(localStorage.getItem(`crushes_${professorId}`) || '[]');
      const filtered = localData.filter(uid => uid !== userUid);
      localStorage.setItem(`crushes_${professorId}`, JSON.stringify(filtered));
      return true;
    } else {
      // Eliminar de professor_interactions
      await supabase
        .from('professor_interactions')
        .delete()
        .eq('professor_id', professorId)
        .eq('user_uid', userUid);

      return true;
    }
  } catch (err) {
    console.error('Error al eliminar interacción del usuario:', err);
    return false;
  }
}


