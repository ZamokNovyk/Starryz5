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
  const { data, error } = await supabase
    .from('professors')
    .select('*')
    .eq('id', slug.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    console.error('Error al obtener perfil de profesor por ID:', error);
    throw error;
  }

  return data as Professor | null;
}

/**
 * Obtiene los profesores asignados a un instituto / campus específico.
 */
export async function getProfessorsByInstitute(instituteId: string): Promise<Professor[]> {
  const { data, error } = await supabase
    .from('professors')
    .select('*')
    .eq('institute_id', instituteId);

  if (error) {
    // Si la tabla no existe, retornamos vacío amigablemente
    if (error.code === 'P0001' || error.message?.includes('does not exist')) {
      console.warn('La tabla professors no existe aún.');
      return [];
    }
    console.error('Error al obtener profesores por instituto:', error);
    throw error;
  }

  return data as Professor[] || [];
}

/**
 * Obtiene la interacción actual de un usuario con un profesor.
 */
export async function getUserProfessorInteraction(
  professorId: string,
  userUid: string
): Promise<{ interaction_type: 'knows' | 'fan' | null } | null> {
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
    console.error('Error al obtener la interacción del usuario:', error);
    return null;
  }

  return data as { interaction_type: 'knows' | 'fan' | null } | null;
}

/**
 * Obtiene los conteos totales de interacciones (YO TE CONOZCO y FAN) para un profesor.
 */
export async function getProfessorInteractionCounts(professorId: string): Promise<{ knows: number; fan: number }> {
  const { data, error } = await supabase
    .from('professor_interactions')
    .select('interaction_type')
    .eq('professor_id', professorId);

  if (error) {
    console.warn('Error u omisión de la tabla professor_interactions:', error.message);
    return { knows: 0, fan: 0 };
  }

  const knows = data.filter((item: any) => item.interaction_type === 'knows').length;
  const fan = data.filter((item: any) => item.interaction_type === 'fan').length;

  return { knows, fan };
}

/**
 * Alterna la interacción (YO TE CONOZCO / FAN) usando RPC en Supabase.
 */
export async function toggleProfessorInteraction(
  professorId: string,
  userUid: string,
  type: 'knows' | 'fan'
): Promise<{ success: boolean; action: 'inserted' | 'deleted' | 'updated'; current_type: 'knows' | 'fan' | null } | null> {
  const { data, error } = await supabase.rpc('toggle_professor_interaction', {
    p_professor_id: professorId,
    p_user_uid: userUid,
    p_target_type: type
  });

  if (error) {
    console.error('Error al ejecutar RPC toggle_professor_interaction:', error);
    throw error;
  }

  return data as any;
}

/**
 * Obtiene la lista de votos realizados por el usuario HOY para un profesor específico.
 */
export async function getTodayProfessorVotes(professorId: string, userUid: string): Promise<number[]> {
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
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      return [];
    }
    console.error('Error al obtener los votos de hoy:', error);
    return [];
  }

  return (data || []).map((v: any) => Number(v.stars));
}

/**
 * Obtiene la distribución de calificaciones (conteo de estrellas 1 a 5) de un profesor.
 */
export async function getProfessorRatingBreakdown(professorId: string): Promise<{ [key: number]: number }> {
  const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  const { data, error } = await supabase
    .from('professor_votes')
    .select('stars')
    .eq('professor_id', professorId);

  if (error) {
    if (error.message?.includes('does not exist')) {
      return breakdown;
    }
    console.error('Error al obtener distribución de calificaciones:', error);
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
    console.error('Error al actualizar la Wiki del profesor:', error);
    throw error;
  }

  return { success: true };
}

