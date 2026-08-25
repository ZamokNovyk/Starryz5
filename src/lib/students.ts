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
 * Alterna la interacción (YO TE CONOZCO / FAN) para un estudiante.
 */
export async function toggleStudentInteraction(
  studentId: string,
  userUid: string,
  type: 'knows' | 'fan'
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

    if (existing) {
      if (existing.interaction_type === type) {
        // Eliminar interacción
        await supabase.from('student_interactions').delete().eq('id', existing.id);
        return { success: true, action: 'deleted', current_type: null };
      } else {
        // Actualizar tipo
        await supabase
          .from('student_interactions')
          .update({ interaction_type: type })
          .eq('id', existing.id);
        return { success: true, action: 'updated', current_type: type };
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
      return { success: true, action: 'inserted', current_type: type };
    }
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
  userUid: string
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
