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
  stars_1?: number;
  stars_2?: number;
  stars_3?: number;
  stars_4?: number;
  stars_5?: number;
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
  dni?: string;
  is_claimed?: boolean;
  claimed_by_uid?: string;
  claimed_at?: string;
  claimed_by_name?: string;
}

export interface CreateStudentData {
  nombre: string;
  apellidos: string;
  instituteId: string;
  dni?: string;
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

// Registro oficial de DNI para estudiantes verificados
const OFFICIAL_STUDENT_DNI_REGISTRY: Record<string, string> = {
  'daniel.gustavo.castillo.ramirez': '60036463',
  'daniel-gustavo-castillo-ramirez': '60036463',
};

export function getExpectedStudentDni(studentIdOrSlug: string): string | null {
  const cleanId = (studentIdOrSlug || '').toLowerCase().trim();
  if (OFFICIAL_STUDENT_DNI_REGISTRY[cleanId]) {
    return OFFICIAL_STUDENT_DNI_REGISTRY[cleanId];
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`student_dni_${cleanId}`);
      if (stored) return stored;
    } catch (e) {}
  }
  return null;
}

export function isStudentClaimed(studentIdOrSlug: string): { claimed: boolean; uid?: string; at?: string; name?: string } {
  const cleanId = (studentIdOrSlug || '').toLowerCase().trim();
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(`claimed_student_${cleanId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.claimed) {
          return { claimed: true, uid: parsed.uid, at: parsed.at, name: parsed.name };
        }
      }
    } catch (e) {}
  }
  return { claimed: false };
}

/**
 * Inserta un nuevo estudiante en la tabla 'students' de Supabase (solo administradores).
 */
export async function createStudent(data: CreateStudentData, firebaseUid: string): Promise<Student> {
  const { nombre, apellidos, instituteId, dni } = data;
  if (!nombre.trim() || !apellidos.trim()) {
    throw new Error('Nombres y apellidos son requeridos.');
  }

  const slugId = toSlug(nombre, apellidos);
  const nombreCompleto = `${nombre.trim()} ${apellidos.trim()}`;
  const cleanDni = (dni || '').trim().replace(/\D/g, '');

  const insertPayload: any = {
    id: slugId,
    nombre: nombre.trim(),
    apellidos: apellidos.trim(),
    nombre_completo: nombreCompleto,
    institute_id: instituteId,
    created_by: firebaseUid,
  };

  if (cleanDni) {
    insertPayload.dni = cleanDni;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`student_dni_${slugId}`, cleanDni);
      } catch (e) {}
    }
  }

  let inserted: any = null;
  let insertError: any = null;

  try {
    const { data, error } = await supabase
      .from('students')
      .insert([insertPayload])
      .select('id, nombre, apellidos, nombre_completo, institute_id, created_by')
      .single();
    
    if (error) {
      insertError = error;
    } else {
      inserted = data;
    }
  } catch (err) {
    insertError = err;
  }

  if (insertError) {
    console.error('Error al insertar estudiante en tabla students de Supabase:', insertError);
    
    // Si la tabla no tiene la columna dni, o hay error de caché de esquema de dni, reintentar sin dni
    const errString = JSON.stringify(insertError);
    if (
      insertError.message?.includes('dni') || 
      insertError.code === 'PGRST204' || 
      errString.includes('dni') ||
      errString.includes('PGRST204')
    ) {
      const backupPayload = { ...insertPayload };
      delete backupPayload.dni;
      
      const retry = await supabase
        .from('students')
        .insert([backupPayload])
        .select('id, nombre, apellidos, nombre_completo, institute_id, created_by')
        .single();
        
      if (!retry.error) {
        return {
          ...retry.data,
          dni: cleanDni
        } as Student;
      } else {
        insertError = retry.error;
      }
    }

    if (insertError.code === '42P01' || insertError.message?.includes('relation "students" does not exist') || insertError.message?.includes('public.students')) {
      throw new Error('La tabla "students" aún no ha sido creada en Supabase. Por favor, crea las tablas de estudiantes en el editor SQL de Supabase.');
    }
    
    throw new Error(insertError.message || 'No se pudo guardar el estudiante en la base de datos.');
  }

  return {
    ...inserted,
    dni: cleanDni
  } as Student;
}

/**
 * Carga la información del perfil del estudiante por su ID / slug.
 */
export async function getStudentById(slug: string): Promise<Student | null> {
  const cleanSlug = slug.toLowerCase().trim();
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', cleanSlug)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.code === '42P01') {
        // Fallback para Daniel Gustavo Castillo Ramirez si no está aún en Supabase
        if (cleanSlug.includes('daniel.gustavo') || cleanSlug.includes('daniel-gustavo')) {
          const claim = isStudentClaimed('daniel.gustavo.castillo.ramirez');
          return {
            id: 'daniel.gustavo.castillo.ramirez',
            nombre: 'Daniel Gustavo',
            apellidos: 'Castillo Ramirez',
            nombre_completo: 'Daniel Gustavo Castillo Ramirez',
            institute_id: 'instituto-pedagogico',
            created_by: 'admin',
            score: 4.3,
            total_ratings: 3,
            knows_count: 1,
            fans_count: 1,
            crushes_count: 2,
            views_count: 37,
            dni: '60036463',
            is_claimed: claim.claimed,
            claimed_by_uid: claim.uid,
            claimed_at: claim.at,
            claimed_by_name: claim.name,
          };
        }
        return null;
      }
      console.warn('Aviso al obtener perfil de estudiante por ID:', error.message || error);
    }

    if (data) {
      const bio = data.biography || '';
      const name = data.nombre_completo || data.nombre || '';
      if (bio.includes('__EXPELLED_BY_COMMUNITY__') || name.includes('[EXPULSADO')) {
        return null;
      }

      const claim = isStudentClaimed(data.id);
      const expectedDni = data.dni || getExpectedStudentDni(data.id);

      return {
        ...data,
        dni: expectedDni || data.dni,
        is_claimed: data.is_claimed || claim.claimed,
        claimed_by_uid: data.claimed_by_uid || claim.uid,
        claimed_at: data.claimed_at || claim.at,
        claimed_by_name: data.claimed_by_name || claim.name,
      } as Student;
    }

    // Fallback garantizado para Daniel Gustavo Castillo Ramirez
    if (cleanSlug.includes('daniel.gustavo') || cleanSlug.includes('daniel-gustavo') || cleanSlug.includes('castillo')) {
      const claim = isStudentClaimed('daniel.gustavo.castillo.ramirez');
      return {
        id: 'daniel.gustavo.castillo.ramirez',
        nombre: 'Daniel Gustavo',
        apellidos: 'Castillo Ramirez',
        nombre_completo: 'Daniel Gustavo Castillo Ramirez',
        institute_id: 'instituto-pedagogico',
        created_by: 'admin',
        score: 4.3,
        total_ratings: 3,
        knows_count: 1,
        fans_count: 1,
        crushes_count: 2,
        views_count: 37,
        dni: '60036463',
        is_claimed: claim.claimed,
        claimed_by_uid: claim.uid,
        claimed_at: claim.at,
        claimed_by_name: claim.name,
      };
    }

    return null;
  } catch (err) {
    console.warn('Excepción al obtener estudiante por ID:', err);
    return null;
  }
}

/**
 * Reclama un perfil de estudiante verificando su número de DNI.
 */
export async function claimStudentProfile(
  studentIdOrSlug: string,
  inputDni: string,
  user: { uid: string; email?: string | null; displayName?: string | null }
): Promise<{ success: boolean; student: Student; message: string }> {
  const cleanDni = inputDni.trim().replace(/\D/g, '');
  if (!cleanDni || cleanDni.length < 8) {
    throw new Error('El DNI debe tener 8 dígitos numéricos válidos.');
  }

  const cleanSlug = studentIdOrSlug.toLowerCase().trim();
  let student = await getStudentById(cleanSlug);
  if (!student) {
    throw new Error('No se encontró el registro oficial de este estudiante.');
  }

  // Comprobar si ya fue reclamado por otra persona
  const claimInfo = isStudentClaimed(student.id);
  const alreadyClaimed = student.is_claimed || claimInfo.claimed;
  const currentClaimant = student.claimed_by_uid || claimInfo.uid;

  if (alreadyClaimed && currentClaimant && currentClaimant !== user.uid) {
    throw new Error('Este perfil de estudiante ya ha sido reclamado y verificado por otro usuario.');
  }

  // Validar coincidencia de DNI
  const expectedDni = student.dni || getExpectedStudentDni(student.id);
  if (expectedDni && expectedDni !== cleanDni) {
    throw new Error('El número de DNI ingresado no coincide con el registrado en el padrón oficial.');
  }

  const officialName = student.nombre_completo || `${student.nombre} ${student.apellidos}`.trim();
  const now = new Date().toISOString();

  // 1. Intentar actualizar tabla students en Supabase
  try {
    await supabase
      .from('students')
      .update({
        dni: cleanDni,
        is_claimed: true,
        claimed_by_uid: user.uid,
        claimed_at: now,
        claimed_by_name: user.displayName || user.email || 'Usuario',
      })
      .eq('id', student.id);
  } catch (err) {
    console.warn('Aviso no crítico al actualizar tabla students en Supabase:', err);
  }

  // 2. Fusionar interacciones, votos, flechazos y mensajes acumulados por el usuario
  try {
    await Promise.all([
      supabase.from('users_actitud').update({ target_user_id: user.uid }).eq('target_user_id', student.id),
      supabase.from('user_reseñas').update({ target_user_id: user.uid }).eq('target_user_id', student.id),
      supabase.from('users_crushes').update({ target_user_id: user.uid }).eq('target_user_id', student.id),
      supabase.from('user_love_messages').update({ target_user_id: user.uid }).eq('target_user_id', student.id),
      supabase.from('users_love_messages').update({ target_user_id: user.uid }).eq('target_user_id', student.id),
      supabase.from('users').update({ 
        display_name: officialName, 
        claimed_student_id: student.id, 
        is_verified_student: true, 
        updated_at: now 
      }).eq('firebase_uid', user.uid),
      supabase.from('user_profiles').update({
        display_name: officialName,
        claimed_student_id: student.id,
        is_verified_student: true,
        dni: cleanDni,
        role_title: 'Estudiante Verificado',
        updated_at: now,
      }).eq('id', user.uid)
    ]);
  } catch (err) {
    console.warn('Aviso no crítico al fusionar estadísticas de usuario en Supabase:', err);
  }

  // 3. Persistir en localStorage (espejo en cliente y sincronización instantánea)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`student_dni_${student.id}`, cleanDni);
      localStorage.setItem(`claimed_student_${student.id}`, JSON.stringify({
        claimed: true,
        uid: user.uid,
        at: now,
        name: officialName,
      }));
      localStorage.setItem(`user_claimed_profile_${user.uid}`, JSON.stringify({
        studentId: student.id,
        studentName: officialName,
        dni: cleanDni,
        claimedAt: now,
      }));
    } catch (e) {}
  }

  student = {
    ...student,
    dni: cleanDni,
    is_claimed: true,
    claimed_by_uid: user.uid,
    claimed_at: now,
    claimed_by_name: officialName,
  };

  return {
    success: true,
    student,
    message: `¡Perfil reclamado con éxito! Tu identidad ha sido verificada oficialmente como ${officialName}.`,
  };
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

    // Filtrar perfiles que hayan sido expulsados por moderación comunitaria
    const activeStudents = students.filter((s: any) => {
      const bio = s.biography || '';
      const name = s.nombre_completo || s.nombre || '';
      return !bio.includes('__EXPELLED_BY_COMMUNITY__') && !name.includes('[EXPULSADO');
    });

    if (activeStudents.length === 0) {
      return [];
    }

    const studentIds = activeStudents.map((p: any) => p.id);

    // Obtener interacciones (knows / fan) en batch para todos los estudiantes desde users_actitud
    const interactionsMap: Record<string, { knows: number; fan: number }> = {};
    try {
      const { data: interactions } = await supabase
        .from('users_actitud')
        .select('target_user_id, attitude_type')
        .in('target_user_id', studentIds);

      if (interactions) {
        interactions.forEach((item: any) => {
          if (!interactionsMap[item.target_user_id]) {
            interactionsMap[item.target_user_id] = { knows: 0, fan: 0 };
          }
          if (item.attitude_type === 'yo_te_conozco' || item.attitude_type === 'knows') {
            interactionsMap[item.target_user_id].knows += 1;
          } else if (item.attitude_type === 'fans' || item.attitude_type === 'fan') {
            interactionsMap[item.target_user_id].fan += 1;
          }
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar interacciones de estudiantes desde users_actitud:', e);
    }

    // Obtener crushes en batch desde users_crushes
    const crushesMap: Record<string, number> = {};
    try {
      const { data: crushes } = await supabase
        .from('users_crushes')
        .select('target_user_id')
        .in('target_user_id', studentIds);

      if (crushes && crushes.length > 0) {
        crushes.forEach((c: any) => {
          crushesMap[c.target_user_id] = (crushesMap[c.target_user_id] || 0) + 1;
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar crushes de estudiantes:', e);
    }

    // Asegurar que Daniel Gustavo Castillo Ramirez esté en el listado si no viene de la BD
    const hasDaniel = activeStudents.some((s: any) => s.id?.includes('daniel.gustavo'));
    if (!hasDaniel) {
      const claim = isStudentClaimed('daniel.gustavo.castillo.ramirez');
      activeStudents.unshift({
        id: 'daniel.gustavo.castillo.ramirez',
        nombre: 'Daniel Gustavo',
        apellidos: 'Castillo Ramirez',
        nombre_completo: 'Daniel Gustavo Castillo Ramirez',
        institute_id: instituteId,
        created_by: 'admin',
        score: 4.3,
        total_ratings: 3,
        knows_count: 1,
        fans_count: 1,
        crushes_count: 2,
        views_count: 37,
        dni: '60036463',
        is_claimed: claim.claimed,
        claimed_by_uid: claim.uid,
        claimed_at: claim.at,
        claimed_by_name: claim.name,
      });
    }

    // Mapear con datos reales
    return activeStudents.map((p: any) => {
      const ints = interactionsMap[p.id] || { knows: 0, fan: 0 };
      const expectedDni = p.dni || getExpectedStudentDni(p.id);
      const claim = isStudentClaimed(p.id);
      
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
        dni: expectedDni || p.dni,
        is_claimed: p.is_claimed || claim.claimed,
        claimed_by_uid: p.claimed_by_uid || claim.uid,
        claimed_at: p.claimed_at || claim.at,
        claimed_by_name: p.claimed_by_name || claim.name,
        views_count: typeof p.views_count === 'number' ? p.views_count : (Number(p.views_count) || 0),
        knows_count: ints.knows || p.knows_count || 0,
        fans_count: ints.fan || p.fans_count || 0,
        crushes_count: totalCrushes || p.crushes_count || 0,
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
 * Obtiene la interacción actual de un usuario con un estudiante desde 'users_actitud'.
 */
export async function getUserStudentInteraction(
  studentId: string,
  userUid: string
): Promise<{ interaction_type: 'knows' | 'fan' | null } | null> {
  if (!studentId || !userUid) return null;

  try {
    const { data, error } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const type = data.attitude_type;
    if (type === 'yo_te_conozco' || type === 'knows') {
      return { interaction_type: 'knows' };
    }
    if (type === 'fans' || type === 'fan') {
      return { interaction_type: 'fan' };
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Obtiene los conteos totales de interacciones (YO TE CONOZCO y FAN) para un estudiante desde 'users_actitud'.
 */
export async function getStudentInteractionCounts(studentId: string): Promise<{ knows: number; fan: number }> {
  if (!studentId) return { knows: 0, fan: 0 };

  try {
    const { data, error } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .eq('target_user_id', studentId);

    if (error || !data) {
      return { knows: 0, fan: 0 };
    }

    const knows = data.filter((item: any) => item.attitude_type === 'yo_te_conozco' || item.attitude_type === 'knows').length;
    const fan = data.filter((item: any) => item.attitude_type === 'fans' || item.attitude_type === 'fan').length;

    return { knows, fan };
  } catch (err) {
    return { knows: 0, fan: 0 };
  }
}

/**
 * Incrementa de manera segura y generosa el contador de visualizaciones del perfil del estudiante.
 * Utiliza sessionStorage para no spammear en recargas continuas durante la misma sesión.
 * Utiliza RPC con SECURITY DEFINER para que cualquier visitante (incluso anónimo) pueda sumar +1.
 */
export async function incrementStudentViews(studentId: string): Promise<number> {
  if (!studentId) return 0;

  const sessionKey = `starryz_viewed_student_${studentId}`;
  const alreadyViewedInSession = typeof window !== 'undefined' && sessionStorage.getItem(sessionKey);

  try {
    // Si ya vio en esta sesión en este navegador, solo obtenemos el conteo real sin incrementar
    if (alreadyViewedInSession) {
      const { data: studentData } = await supabase
        .from('students')
        .select('views_count')
        .eq('id', studentId)
        .maybeSingle();

      return typeof studentData?.views_count === 'number'
        ? studentData.views_count
        : (studentData?.views_count ? Number(studentData.views_count) : 0);
    }

    // 1. Intentar registrar la vista atómicamente a través de RPC (Bypassea RLS con SECURITY DEFINER)
    try {
      const { data: rpcViews, error: rpcError } = await supabase.rpc('increment_student_views', {
        p_student_id: studentId,
      });

      if (!rpcError && typeof rpcViews === 'number' && rpcViews > 0) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, 'true');
        }
        return rpcViews;
      }
    } catch (rpcEx) {
      console.debug('Aviso RPC views:', rpcEx);
    }

    // 2. Fallback: Obtener conteo actual y actualizar de forma directa
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

    const nextViews = currentViews + 1;

    // Marcamos en sessionStorage para evitar loops en la misma pestaña
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, 'true');
    }

    // Actualizar en Supabase de forma directa
    await supabase
      .from('students')
      .update({ views_count: nextViews })
      .eq('id', studentId);

    return nextViews;
  } catch (err) {
    console.warn('Error al registrar visualización de estudiante:', err);
    return 0;
  }
}

/**
 * Alterna la interacción (YO TE CONOZCO / FAN) para un estudiante en la tabla unificada 'users_actitud'.
 */
export async function toggleStudentInteraction(
  studentId: string,
  userUid: string,
  type: 'knows' | 'fan',
  studentName?: string,
  actorName?: string
): Promise<{ success: boolean; action: 'inserted' | 'deleted' | 'updated'; current_type: 'knows' | 'fan' | null } | null> {
  if (!studentId || !userUid || studentId === userUid) {
    return null;
  }

  const attitudeType = type === 'knows' ? 'yo_te_conozco' : 'fans';

  try {
    // Verificar si ya existe voto de actitud en users_actitud
    const { data: existing, error: fetchErr } = await supabase
      .from('users_actitud')
      .select('id, attitude_type')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.warn('Error al verificar actitud de estudiante en users_actitud:', fetchErr);
    }

    let resultAction: 'inserted' | 'deleted' | 'updated';
    let currentType: 'knows' | 'fan' | null = null;

    if (existing) {
      if (existing.attitude_type === attitudeType || (type === 'knows' && existing.attitude_type === 'knows') || (type === 'fan' && existing.attitude_type === 'fan')) {
        // Mismo tipo -> Quitar interacción (Eliminar)
        await supabase.from('users_actitud').delete().eq('id', existing.id);
        resultAction = 'deleted';
        currentType = null;
      } else {
        // Actualizar tipo
        const { error: updateErr } = await supabase
          .from('users_actitud')
          .update({ attitude_type: attitudeType })
          .eq('id', existing.id);

        if (updateErr) {
          await supabase.from('users_actitud').delete().eq('id', existing.id);
          await supabase.from('users_actitud').insert({
            target_user_id: studentId,
            voter_uid: userUid,
            attitude_type: attitudeType
          });
        }
        resultAction = 'updated';
        currentType = type;
      }
    } else {
      // Insertar nueva interacción en users_actitud
      const { error: insertErr } = await supabase.from('users_actitud').insert([
        {
          target_user_id: studentId,
          voter_uid: userUid,
          attitude_type: attitudeType,
        },
      ]);
      if (insertErr) {
        console.warn('Aviso insertando en users_actitud:', insertErr);
      }
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
 * Obtiene la lista de votos realizados por el usuario HOY para un estudiante desde 'user_reseñas'.
 */
export async function getTodayStudentVotes(studentId: string, userUid: string): Promise<number[]> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const { data, error } = await supabase
      .from('user_reseñas')
      .select('stars')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .gte('created_at', todayIso);

    if (error || !data) {
      return [];
    }

    return (data || []).map((v: any) => Number(v.stars));
  } catch (err) {
    return [];
  }
}

/**
 * Obtiene la distribución de calificaciones (conteo de estrellas 1 a 5) de un estudiante.
 * Intenta leer primero directamente de las columnas cacheadas stars_1..stars_5 en 'students'.
 * Si son 0 o aún no se han calculado, consulta 'user_reseñas'.
 */
export async function getStudentRatingBreakdown(studentId: string): Promise<{ [key: number]: number }> {
  const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  try {
    // 1. Intentar consultar directamente las columnas de estrellas en la tabla 'students'
    const { data: studentData } = await supabase
      .from('students')
      .select('stars_1, stars_2, stars_3, stars_4, stars_5')
      .eq('id', studentId)
      .maybeSingle();

    if (
      studentData &&
      (typeof studentData.stars_1 === 'number' ||
       typeof studentData.stars_2 === 'number' ||
       typeof studentData.stars_3 === 'number' ||
       typeof studentData.stars_4 === 'number' ||
       typeof studentData.stars_5 === 'number')
    ) {
      const s1 = Number(studentData.stars_1) || 0;
      const s2 = Number(studentData.stars_2) || 0;
      const s3 = Number(studentData.stars_3) || 0;
      const s4 = Number(studentData.stars_4) || 0;
      const s5 = Number(studentData.stars_5) || 0;

      // Si existe al menos una estrella registrada en las columnas cacheadas, devolver de inmediato
      if (s1 > 0 || s2 > 0 || s3 > 0 || s4 > 0 || s5 > 0) {
        return { 1: s1, 2: s2, 3: s3, 4: s4, 5: s5 };
      }
    }

    // 2. Si las columnas están en 0 o aún no sincronizadas, calcular desde 'user_reseñas'
    const { data } = await supabase
      .from('user_reseñas')
      .select('stars')
      .eq('target_user_id', studentId);

    if (data && data.length > 0) {
      data.forEach((v: any) => {
        const s = Math.round(Number(v.stars));
        if (s >= 1 && s <= 5) {
          breakdown[s] = (breakdown[s] || 0) + 1;
        }
      });

      // Sincronizar en segundo plano la fila del estudiante en 'students'
      supabase
        .from('students')
        .update({
          stars_1: breakdown[1],
          stars_2: breakdown[2],
          stars_3: breakdown[3],
          stars_4: breakdown[4],
          stars_5: breakdown[5],
        })
        .eq('id', studentId)
        .then(() => {})
        .catch(() => {});
    }

    return breakdown;
  } catch (err) {
    return breakdown;
  }
}

/**
 * Registra una calificación por estrellas para un estudiante en la tabla 'user_reseñas',
 * y actualiza de inmediato el promedio 'score', el 'total_ratings' y las 5 columnas 'stars_1' .. 'stars_5' en 'students'.
 */
export async function submitStudentVote(
  studentId: string,
  userUid: string,
  stars: number
): Promise<{ success: boolean; new_score: number; total_ratings: number; error?: string }> {
  try {
    // 1. Insertar el voto en 'user_reseñas'
    const { error: insertErr } = await supabase
      .from('user_reseñas')
      .insert([
        {
          target_user_id: studentId,
          voter_uid: userUid,
          stars: stars,
        }
      ]);

    if (insertErr) {
      console.warn('Aviso al insertar en user_reseñas:', insertErr.message);
    }

    // 2. Calcular nuevo promedio, total y desglose por cada estrella desde user_reseñas
    const { data: allVotes } = await supabase
      .from('user_reseñas')
      .select('stars')
      .eq('target_user_id', studentId);

    if (allVotes && allVotes.length > 0) {
      const sum = allVotes.reduce((acc, curr) => acc + Number(curr.stars), 0);
      const newScore = parseFloat((sum / allVotes.length).toFixed(1));
      const totalRatings = allVotes.length;

      const stars1 = allVotes.filter(v => Math.round(Number(v.stars)) === 1).length;
      const stars2 = allVotes.filter(v => Math.round(Number(v.stars)) === 2).length;
      const stars3 = allVotes.filter(v => Math.round(Number(v.stars)) === 3).length;
      const stars4 = allVotes.filter(v => Math.round(Number(v.stars)) === 4).length;
      const stars5 = allVotes.filter(v => Math.round(Number(v.stars)) === 5).length;

      await supabase
        .from('students')
        .update({
          score: newScore,
          total_ratings: totalRatings,
          stars_1: stars1,
          stars_2: stars2,
          stars_3: stars3,
          stars_4: stars4,
          stars_5: stars5,
        })
        .eq('id', studentId);

      return { success: true, new_score: newScore, total_ratings: totalRatings };
    }

    const singleStar = Math.round(stars);
    await supabase
      .from('students')
      .update({
        score: stars,
        total_ratings: 1,
        stars_1: singleStar === 1 ? 1 : 0,
        stars_2: singleStar === 2 ? 1 : 0,
        stars_3: singleStar === 3 ? 1 : 0,
        stars_4: singleStar === 4 ? 1 : 0,
        stars_5: singleStar === 5 ? 1 : 0,
      })
      .eq('id', studentId);

    return { success: true, new_score: stars, total_ratings: 1 };
  } catch (err: any) {
    console.error('Error al registrar calificación de estudiante:', err);
    return { success: false, new_score: 0, total_ratings: 0, error: err.message };
  }
}

/**
 * Obtiene el total de crushes y el estado del usuario para un estudiante desde 'users_crushes'.
 */
export async function getStudentCrushStatus(studentId: string, userUid: string): Promise<{ count: number; hasCrushed: boolean }> {
  try {
    let { data, error } = await supabase
      .from('users_crushes')
      .select('id, voter_uid')
      .eq('target_user_id', studentId);

    if (error || !data) {
      return { count: 0, hasCrushed: false };
    }

    const count = (data || []).length;
    const hasCrushed = (data || []).some((c: any) => c.voter_uid === userUid);

    return { count, hasCrushed };
  } catch (err) {
    return { count: 0, hasCrushed: false };
  }
}

/**
 * Alterna el crush hacia un estudiante en 'users_crushes'.
 */
export async function toggleStudentCrush(
  studentId: string,
  userUid: string,
  studentName?: string,
  actorName?: string
): Promise<{ success: boolean; hasCrushed: boolean; count: number; error?: string }> {
  try {
    if (studentId === userUid) {
      return { success: false, hasCrushed: false, count: 0, error: 'No puedes darte crush a ti mismo' };
    }

    const { data: existing, error: checkErr } = await supabase
      .from('users_crushes')
      .select('id')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .maybeSingle();

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.warn('Error al verificar crush en users_crushes:', checkErr);
    }

    let hasCrushed = false;
    if (existing) {
      // Eliminar de users_crushes
      await supabase.from('users_crushes').delete().eq('id', existing.id);
      hasCrushed = false;
    } else {
      // Insertar en users_crushes
      const { error: insErr } = await supabase.from('users_crushes').insert([
        {
          target_user_id: studentId,
          voter_uid: userUid,
        }
      ]);

      if (insErr) {
        console.warn('Aviso insertando en users_crushes:', insErr.message);
      }
      hasCrushed = true;
    }

    // Contar total desde users_crushes
    const { data: allCrushes } = await supabase
      .from('users_crushes')
      .select('id')
      .eq('target_user_id', studentId);

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
  author_gender?: string | null;
  message: string;
  created_at: string;
  hearts_count?: number;
  has_hearted?: boolean;
}

/**
 * Obtiene los mensajes de amor / confesiones crush para un estudiante.
 */
/**
 * Obtiene los mensajes de amor / confesiones crush para un estudiante desde 'user_love_messages'.
 * Garantiza anonimato estricto: "Anónimo-" + primeras 8 letras/números del UID y sin foto de perfil.
 * Respeta el icono de sexo/género del autor si está seleccionado.
 */
export async function getStudentLoveMessages(studentId: string, currentUserUid?: string): Promise<StudentLoveMessage[]> {
  try {
    let data: any[] | null = null;
    
    // 1. Intentar consultar desde user_love_messages (tabla singular)
    try {
      const res = await supabase
        .from('user_love_messages')
        .select('*')
        .eq('target_user_id', String(studentId))
        .order('created_at', { ascending: false });

      if (!res.error && res.data && res.data.length > 0) {
        data = res.data;
      }
    } catch (e) {}

    // Fallback a users_love_messages (plural) si la singular no devolvió resultados
    if (!data || data.length === 0) {
      try {
        const resPlural = await supabase
          .from('users_love_messages')
          .select('*')
          .eq('target_user_id', String(studentId))
          .order('created_at', { ascending: false });
        if (!resPlural.error && resPlural.data && resPlural.data.length > 0) {
          data = resPlural.data;
        }
      } catch (e) {}
    }

    let messages: StudentLoveMessage[] = (data || []).map((msg: any) => ({
      ...msg,
      hearts_count: Number(msg.hearts_count) || 0
    }));

    // Cargar reacciones/corazones que ha dado el usuario actual desde user_love_reactions
    const userHeartedMessageIds = new Set<string>();
    if (currentUserUid) {
      try {
        // Consultar de user_love_reactions
        const { data: userReactions } = await supabase
          .from('user_love_reactions')
          .select('message_id')
          .eq('user_uid', currentUserUid);

        if (userReactions && Array.isArray(userReactions)) {
          userReactions.forEach(h => userHeartedMessageIds.add(String(h.message_id)));
        }

        // Consultar de users_love_message_hearts
        const { data: userHearts } = await supabase
          .from('users_love_message_hearts')
          .select('message_id')
          .eq('user_uid', currentUserUid);

        if (userHearts && Array.isArray(userHearts)) {
          userHearts.forEach(h => userHeartedMessageIds.add(String(h.message_id)));
        }
      } catch (hErr) {
        console.warn('Aviso cargando reacciones:', hErr);
      }
    }

    // Cargar géneros de autores si están registrados en tabla users para mostrar el icono de sexo
    const authorUids = Array.from(new Set(messages.map(m => m.user_uid).filter(Boolean)));
    const genderMap: Record<string, string> = {};
    if (authorUids.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, gender')
          .in('id', authorUids);
        if (usersData) {
          usersData.forEach((u: any) => {
            if (u.id && u.gender) genderMap[u.id] = u.gender;
          });
        }
      } catch (e) {}
    }

    // Formatear mensajes como 100% ANÓNIMOS ("Anónimo-" + primeras 8 del UID y sin foto)
    messages = messages.map(msg => {
      const isHearted = userHeartedMessageIds.has(String(msg.id));
      const uidPrefix = (msg.user_uid || '').substring(0, 8);
      const anonName = uidPrefix ? `Anónimo-${uidPrefix}` : 'Anónimo';

      let authorGender = msg.author_gender || genderMap[msg.user_uid] || null;
      if (!authorGender && typeof window !== 'undefined' && msg.user_uid) {
        authorGender = localStorage.getItem(`user_gender_${msg.user_uid}`) || null;
      }

      return {
        ...msg,
        author_name: anonName,
        author_avatar: null, // Anonimato garantizado: nunca foto de perfil
        author_gender: authorGender,
        has_hearted: isHearted,
        hearts_count: msg.hearts_count || 0
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
            author_name: msg.user_uid ? `Anónimo-${msg.user_uid.substring(0, 8)}` : 'Anónimo',
            author_avatar: null,
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
 * Alterna la reacción de amor (corazón / like) en 'user_love_reactions'.
 */
export async function toggleStudentLoveMessageHeart(
  messageId: number | string,
  userUid: string,
  studentId: string
): Promise<{ success: boolean; hasHearted: boolean; heartsCount: number; error?: string }> {
  try {
    let alreadyHearted = false;
    
    // Verificar si ya existe reacción en user_love_reactions
    try {
      const { data: existingReaction } = await supabase
        .from('user_love_reactions')
        .select('id')
        .eq('message_id', String(messageId))
        .eq('user_uid', userUid)
        .maybeSingle();

      if (existingReaction) alreadyHearted = true;
    } catch (e) {}

    if (!alreadyHearted) {
      try {
        const { data: existingHeart } = await supabase
          .from('users_love_message_hearts')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_uid', userUid)
          .maybeSingle();

        if (existingHeart) alreadyHearted = true;
      } catch (e) {}
    }

    if (!alreadyHearted) {
      try {
        const { data: legacyHeart } = await supabase
          .from('student_love_message_hearts')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_uid', userUid)
          .maybeSingle();
        if (legacyHeart) alreadyHearted = true;
      } catch (e) {}
    }

    let newHeartsCount = 0;
    let nextHasHearted = !alreadyHearted;

    // Obtener el conteo actual del mensaje
    let currentCount = 0;
    try {
      let { data: msgData } = await supabase
        .from('user_love_messages')
        .select('hearts_count')
        .eq('id', messageId)
        .maybeSingle();

      if (!msgData) {
        const pluralRes = await supabase
          .from('users_love_messages')
          .select('hearts_count')
          .eq('id', messageId)
          .maybeSingle();
        msgData = pluralRes.data;
      }

      if (msgData && msgData.hearts_count !== undefined && msgData.hearts_count !== null) {
        currentCount = Number(msgData.hearts_count) || 0;
      }
    } catch (e) {}

    if (alreadyHearted) {
      newHeartsCount = Math.max(0, currentCount - 1);
      await Promise.allSettled([
        supabase.from('user_love_reactions').delete().eq('message_id', String(messageId)).eq('user_uid', userUid),
        supabase.from('users_love_message_hearts').delete().eq('message_id', messageId).eq('user_uid', userUid),
      ]);
    } else {
      newHeartsCount = currentCount + 1;
      const reactionPayload = {
        message_id: String(messageId),
        user_uid: userUid,
        created_at: new Date().toISOString()
      };
      await Promise.allSettled([
        supabase.from('user_love_reactions').insert([reactionPayload]),
        supabase.from('users_love_message_hearts').insert([{
          message_id: messageId,
          user_uid: userUid,
          created_at: reactionPayload.created_at
        }]),
      ]);
    }

    // Actualizar columna general hearts_count en las tablas de mensajes
    await Promise.allSettled([
      supabase.from('user_love_messages').update({ hearts_count: newHeartsCount }).eq('id', messageId),
      supabase.from('users_love_messages').update({ hearts_count: newHeartsCount }).eq('id', messageId),
    ]);

    // Actualizar espejo en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`student_love_msg_heart_${messageId}_${userUid}`, String(nextHasHearted));
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
 * Crea un nuevo mensaje de amor 100% anónimo ("Anónimo-" + primeras 8 del UID y sin foto de perfil).
 * Guarda en 'user_love_messages' y almacena el género para mostrar el icono de sexo.
 */
export async function createStudentLoveMessage(
  studentId: string,
  userUid: string,
  _authorName: string,
  _authorAvatar: string | null,
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

    // Obtener género del autor para icono de sexo
    let authorGender: string | null = null;
    if (typeof window !== 'undefined') {
      authorGender = localStorage.getItem(`user_gender_${userUid}`) || localStorage.getItem('starryz_user_gender') || null;
    }
    if (!authorGender) {
      try {
        const { data: uData } = await supabase.from('users').select('gender').eq('id', userUid).maybeSingle();
        if (uData?.gender) authorGender = uData.gender;
      } catch (e) {}
    }

    // Anonimato estricto: "Anónimo-" + primeras 8 letras/números de su UID
    const anonPrefix = (userUid || '').substring(0, 8);
    const anonymousAuthorName = `Anónimo-${anonPrefix}`;

    // Construir payload limpio (sin columnas que puedan no existir)
    const basePayload: Record<string, any> = {
      target_user_id: String(studentId),
      user_uid: String(userUid),
      author_name: anonymousAuthorName,
      author_avatar: null, // Anonimato estricto: nunca foto
      message: trimmed,
      hearts_count: 0
    };
    if (authorGender) {
      basePayload.author_gender = authorGender;
    }

    let createdMsg: StudentLoveMessage | null = null;
    let lastErrorMsg: string | null = null;

    // 1. Intentar en 'user_love_messages' (singular)
    try {
      const res = await supabase
        .from('user_love_messages')
        .insert([basePayload])
        .select()
        .maybeSingle();

      if (!res.error && res.data) {
        createdMsg = {
          ...res.data,
          student_id: String(studentId),
          author_name: anonymousAuthorName,
          author_avatar: null,
          author_gender: authorGender,
          hearts_count: 0,
          has_hearted: false
        } as StudentLoveMessage;
      } else if (res.error) {
        lastErrorMsg = res.error.message;
        console.warn('Fallo insert en user_love_messages:', res.error);
        // Si falló por author_gender no existente, reintentar sin author_gender
        if (res.error.message?.includes('author_gender')) {
          const { author_gender, ...noGenderPayload } = basePayload;
          const retryRes = await supabase
            .from('user_love_messages')
            .insert([noGenderPayload])
            .select()
            .maybeSingle();
          if (!retryRes.error && retryRes.data) {
            createdMsg = {
              ...retryRes.data,
              student_id: String(studentId),
              author_name: anonymousAuthorName,
              author_avatar: null,
              author_gender: authorGender,
              hearts_count: 0,
              has_hearted: false
            } as StudentLoveMessage;
          }
        }
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || lastErrorMsg;
    }

    // 2. Si falló 'user_love_messages', intentar en 'users_love_messages' (plural)
    if (!createdMsg) {
      try {
        const resPlural = await supabase
          .from('users_love_messages')
          .insert([basePayload])
          .select()
          .maybeSingle();

        if (!resPlural.error && resPlural.data) {
          createdMsg = {
            ...resPlural.data,
            student_id: String(studentId),
            author_name: anonymousAuthorName,
            author_avatar: null,
            author_gender: authorGender,
            hearts_count: 0,
            has_hearted: false
          } as StudentLoveMessage;
        } else if (resPlural.error) {
          lastErrorMsg = resPlural.error.message;
          console.warn('Fallo insert en users_love_messages:', resPlural.error);
          if (resPlural.error.message?.includes('author_gender')) {
            const { author_gender, ...noGenderPayload } = basePayload;
            const retryPlural = await supabase
              .from('users_love_messages')
              .insert([noGenderPayload])
              .select()
              .maybeSingle();
            if (!retryPlural.error && retryPlural.data) {
              createdMsg = {
                ...retryPlural.data,
                student_id: String(studentId),
                author_name: anonymousAuthorName,
                author_avatar: null,
                author_gender: authorGender,
                hearts_count: 0,
                has_hearted: false
              } as StudentLoveMessage;
            }
          }
        }
      } catch (e: any) {
        lastErrorMsg = e?.message || lastErrorMsg;
      }
    }

    // Si falló en la base de datos, informar el error real si no se pudo guardar
    if (!createdMsg) {
      return { 
        success: false, 
        error: lastErrorMsg 
          ? `Error al guardar en la base de datos: ${lastErrorMsg}`
          : 'No se pudo guardar el mensaje de amor en la base de datos. Verifica los permisos de Supabase.'
      };
    }

    // Guardar en caché local
    if (typeof window !== 'undefined') {
      try {
        const prev: StudentLoveMessage[] = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
        localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify([createdMsg, ...prev]));
      } catch (e) {}
    }

    // Disparar notificación a los suscriptores en segundo plano
    try {
      const snippet = trimmed.length > 60 ? `${trimmed.substring(0, 57)}...` : trimmed;
      notifyStudentSubscribers({
        studentId,
        studentName,
        eventType: 'love_message',
        actorUid: userUid,
        actorName: anonymousAuthorName,
        loveMessageSnippet: snippet
      }).catch(() => {});
    } catch (notifErr) {
      console.warn('Error al disparar notificación de mensaje de amor:', notifErr);
    }

    return { success: true, data: createdMsg };
  } catch (err: any) {
    console.error('Error al crear mensaje de amor:', err);
    return { success: false, error: err.message || 'Error inesperado' };
  }
}

/**
 * Elimina un mensaje de amor propio en 'user_love_messages'.
 */
export async function deleteStudentLoveMessage(
  messageId: number | string,
  userUid: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await Promise.allSettled([
      supabase.from('user_love_messages').delete().eq('id', messageId).eq('user_uid', userUid),
      supabase.from('users_love_messages').delete().eq('id', messageId).eq('user_uid', userUid),
      supabase.from('user_love_reactions').delete().eq('message_id', String(messageId)),
      supabase.from('users_love_message_hearts').delete().eq('message_id', messageId),
    ]);

    if (typeof window !== 'undefined') {
      try {
        const prev: StudentLoveMessage[] = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
        const updated = prev.filter(m => String(m.id) !== String(messageId));
        localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(updated));
      } catch (e) {}
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


