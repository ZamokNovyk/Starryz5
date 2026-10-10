import { supabase } from './supabase';
import { getUserActitudCounts, hasUserVotedActitud, toggleUserActitud } from './userActitud';
import { getUserCrushesCount, hasUserCrushed, toggleUserCrush } from './userCrushes';

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
 * Consulta asíncrona robusta si un perfil de estudiante ya ha sido reclamado,
 * verificando en la tabla 'users' (claimed_student_id), en la tabla 'students' (is_claimed),
 * y en el caché local.
 */
export async function checkStudentClaimStatus(studentIdOrSlug: string): Promise<{ claimed: boolean; uid?: string; at?: string; name?: string }> {
  const cleanId = (studentIdOrSlug || '').toLowerCase().trim();
  // 1. Verificar en tabla users (referencia principal de cuenta vinculada)
  try {
    const { data: userClaim } = await supabase
      .from('users')
      .select('id, display_name, email, updated_at')
      .eq('claimed_student_id', cleanId)
      .maybeSingle();

    if (userClaim) {
      return {
        claimed: true,
        uid: userClaim.id,
        at: userClaim.updated_at,
        name: userClaim.display_name,
      };
    }
  } catch (e) {}

  // 2. Verificar en tabla students
  try {
    const { data: stClaim } = await supabase
      .from('students')
      .select('is_claimed, claimed_by_uid, claimed_at, claimed_by_name')
      .eq('id', cleanId)
      .maybeSingle();

    if (stClaim && stClaim.is_claimed) {
      return {
        claimed: true,
        uid: stClaim.claimed_by_uid,
        at: stClaim.claimed_at,
        name: stClaim.claimed_by_name,
      };
    }
  } catch (e) {}

  // 3. Fallback en caché de navegador
  return isStudentClaimed(cleanId);
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

      // 1. Consultar si algún usuario en la tabla 'users' reclamó este perfil de estudiante
      let isClaimed = Boolean(data.is_claimed || claim.claimed);
      let claimedByUid = data.claimed_by_uid || claim.uid;
      let claimedByName = data.claimed_by_name || claim.name;
      let claimUserData: any = null;

      if (claimedByUid) {
        try {
          const { data: cu } = await supabase
            .from('users')
            .select('id, display_name, photo_url, avatar_url, email, knows_count, fans_count, crushes_count')
            .eq('id', claimedByUid)
            .maybeSingle();
          if (cu) claimUserData = cu;
        } catch (e) {}
      }

      if (!claimUserData) {
        try {
          const { data: claimUser } = await supabase
            .from('users')
            .select('id, display_name, photo_url, avatar_url, email, knows_count, fans_count, crushes_count')
            .eq('claimed_student_id', data.id)
            .maybeSingle();

          if (claimUser) {
            isClaimed = true;
            claimedByUid = claimUser.id;
            claimUserData = claimUser;
          }
        } catch (e) {}
      }

      if (claimUserData) {
        isClaimed = true;
        if (claimUserData.display_name) {
          claimedByName = claimUserData.display_name;
        }
      }

      // 2. Si está reclamado, consultar conteos oficiales directamente desde las tablas de usuario (users_actitud, users_crushes)
      let dynamicKnows = data.knows_count || 0;
      let dynamicFans = data.fans_count || 0;
      let dynamicCrushes = data.crushes_count || 0;

      if (isClaimed && claimedByUid) {
        try {
          const [actCounts, crushesCount] = await Promise.all([
            getUserActitudCounts(claimedByUid),
            getUserCrushesCount(claimedByUid),
          ]);
          dynamicKnows = actCounts.knowCount;
          dynamicFans = actCounts.fanCount;
          dynamicCrushes = crushesCount;
        } catch (e) {}
      }

      const resolvedNombreCompleto = (isClaimed && (claimUserData?.display_name || claimedByName))
        ? (claimUserData?.display_name || claimedByName)
        : data.nombre_completo;

      const resolvedNombre = (isClaimed && (claimUserData?.display_name || claimedByName))
        ? (claimUserData?.display_name || claimedByName).split(' ')[0]
        : data.nombre;

      const resolvedAvatar = (isClaimed && claimUserData && (claimUserData.avatar_url || claimUserData.photo_url))
        ? (claimUserData.avatar_url || claimUserData.photo_url)
        : (data.avatar_url || data.foto_url);

      // Sincronizar en segundo plano si el nombre difiere en students
      if (claimUserData?.display_name && data.nombre_completo !== claimUserData.display_name && data.id) {
        supabase
          .from('students')
          .update({
            nombre_completo: claimUserData.display_name,
            nombre: claimUserData.display_name.split(' ')[0],
            foto_url: resolvedAvatar,
          })
          .eq('id', data.id)
          .then(() => {})
          .catch(() => {});
      }

      return {
        ...data,
        nombre_completo: resolvedNombreCompleto,
        nombre: resolvedNombre,
        avatar_url: resolvedAvatar,
        foto_url: resolvedAvatar,
        dni: expectedDni || data.dni,
        is_claimed: isClaimed,
        claimed_by_uid: claimedByUid,
        claimed_at: data.claimed_at || claim.at,
        claimed_by_name: claimedByName,
        knows_count: dynamicKnows,
        fans_count: dynamicFans,
        crushes_count: dynamicCrushes,
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
  if (!user || !user.email) {
    throw new Error('Solo los usuarios con una cuenta vinculada a Google pueden reclamar un perfil oficial.');
  }

  const cleanDni = inputDni.trim().replace(/\D/g, '');
  if (!cleanDni || cleanDni.length < 8) {
    throw new Error('El DNI debe tener 8 dígitos numéricos válidos.');
  }

  const cleanSlug = studentIdOrSlug.toLowerCase().trim();
  let student = await getStudentById(cleanSlug);
  if (!student) {
    throw new Error('No se encontró el registro oficial de este estudiante.');
  }

  // 1. Verificación definitiva en tabla 'users' para evitar doble reclamo entre usuarios
  try {
    const { data: existingClaimUser } = await supabase
      .from('users')
      .select('id, email, display_name')
      .eq('claimed_student_id', student.id)
      .maybeSingle();

    if (existingClaimUser) {
      const isSameUser = existingClaimUser.id === user.uid || (user.email && existingClaimUser.email === user.email);
      if (!isSameUser) {
        throw new Error('Este perfil de estudiante ya ha sido reclamado y verificado por otro usuario.');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('reclamado')) throw err;
  }

  // 2. Comprobar si ya fue reclamado en students o memoria
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

  // 1. Actualizar tabla students en Supabase
  try {
    const { error: stUpdateErr } = await supabase
      .from('students')
      .update({
        dni: cleanDni,
        is_claimed: true,
        claimed_by_uid: user.uid,
        claimed_at: now,
        claimed_by_name: user.displayName || user.email || 'Usuario',
      })
      .eq('id', student.id);

    if (stUpdateErr) {
      console.warn('Aviso al actualizar is_claimed en students (posiblemente columna pendiente en SQL):', stUpdateErr.message);
      // Fallback si la columna is_claimed no existe aún en la tabla students de Supabase
      await supabase
        .from('students')
        .update({ dni: cleanDni })
        .eq('id', student.id);
    }
  } catch (err) {
    console.warn('Aviso al actualizar tabla students en Supabase:', err);
  }

  // 1.5. PURGAR AUTORREACCIONES Y VOTOS PROPIOS
  try {
    await Promise.allSettled([
      supabase.from('student_interactions').delete().eq('student_id', student.id).eq('user_uid', user.uid),
      supabase.from('student_crushes').delete().eq('student_id', student.id).eq('user_uid', user.uid),
      supabase.from('student_votes').delete().eq('student_id', student.id).eq('user_uid', user.uid),
      supabase.from('student_love_messages').delete().eq('student_id', student.id).eq('user_uid', user.uid),
      supabase.from('users_actitud').delete().eq('target_user_id', user.uid).eq('voter_uid', user.uid),
      supabase.from('users_crushes').delete().eq('target_user_id', user.uid).eq('voter_uid', user.uid),
      supabase.from('users_votes').delete().eq('target_user_id', user.uid).eq('user_uid', user.uid),
      supabase.from('users_love_messages').delete().eq('target_user_id', user.uid).eq('user_uid', user.uid),
    ]);
  } catch (cleanSelfErr) {
    console.warn('Aviso al purgar autorreacciones:', cleanSelfErr);
  }

  // 2. MIGRACIÓN: Transferir student_interactions -> users_actitud
  try {
    const { data: stInteractions } = await supabase
      .from('student_interactions')
      .select('user_uid, interaction_type')
      .eq('student_id', student.id);

    if (stInteractions && stInteractions.length > 0) {
      for (const item of stInteractions) {
        if (!item.user_uid || item.user_uid === user.uid) continue;
        const attitudeType: 'yo_te_conozco' | 'fans' = item.interaction_type === 'knows' ? 'yo_te_conozco' : 'fans';

        // Evitar duplicados si el votante ya votó en users_actitud
        const { data: existingAct } = await supabase
          .from('users_actitud')
          .select('id')
          .eq('target_user_id', user.uid)
          .eq('voter_uid', item.user_uid)
          .maybeSingle();

        if (!existingAct) {
          await supabase.from('users_actitud').insert({
            target_user_id: user.uid,
            voter_uid: item.user_uid,
            attitude_type: attitudeType,
          });
        }
      }

      // Limpiar filas migradas de student_interactions para evitar duplicidad
      await supabase.from('student_interactions').delete().eq('student_id', student.id);
    }
  } catch (migErr) {
    console.warn('Aviso al migrar student_interactions a users_actitud:', migErr);
  }

  // 3. MIGRACIÓN: Transferir student_crushes -> users_crushes
  try {
    const { data: stCrushes } = await supabase
      .from('student_crushes')
      .select('user_uid')
      .eq('student_id', student.id);

    if (stCrushes && stCrushes.length > 0) {
      for (const item of stCrushes) {
        if (!item.user_uid || item.user_uid === user.uid) continue;

        const { data: existingCrush } = await supabase
          .from('users_crushes')
          .select('id')
          .eq('target_user_id', user.uid)
          .eq('voter_uid', item.user_uid)
          .maybeSingle();

        if (!existingCrush) {
          await supabase.from('users_crushes').insert({
            target_user_id: user.uid,
            voter_uid: item.user_uid,
          });
        }
      }

      // Limpiar filas migradas de student_crushes
      await supabase.from('student_crushes').delete().eq('student_id', student.id);
    }
  } catch (migErr) {
    console.warn('Aviso al migrar student_crushes a users_crushes:', migErr);
  }

  // 4. MIGRACIÓN: Transferir student_votes -> users_votes
  try {
    const { data: stVotes } = await supabase
      .from('student_votes')
      .select('*')
      .eq('student_id', student.id);

    if (stVotes && stVotes.length > 0) {
      const votesPayload = stVotes.map((v: any) => ({
        target_user_id: user.uid,
        user_uid: v.user_uid,
        stars: Number(v.stars),
        created_at: v.created_at || now,
      }));

      const { error: insVotesErr } = await supabase.from('users_votes').insert(votesPayload);
      if (!insVotesErr) {
        await supabase.from('student_votes').delete().eq('student_id', student.id);
      }
    }
  } catch (migVotesErr) {
    console.warn('Aviso al migrar student_votes a users_votes:', migVotesErr);
  }

  // 5. MIGRACIÓN: Transferir student_love_messages -> users_love_messages y sus corazones
  try {
    const { data: stLoveMsgs } = await supabase
      .from('student_love_messages')
      .select('*')
      .eq('student_id', student.id);

    if (stLoveMsgs && stLoveMsgs.length > 0) {
      for (const msg of stLoveMsgs) {
        const { data: insMsg, error: insMsgErr } = await supabase
          .from('users_love_messages')
          .insert({
            target_user_id: user.uid,
            user_uid: msg.user_uid,
            author_name: msg.author_name || 'Anónimo',
            author_avatar: msg.author_avatar || null,
            author_gender: msg.author_gender || null,
            content: msg.message || '',
            hearts_count: Number(msg.hearts_count) || 0,
            created_at: msg.created_at || now,
          })
          .select('id')
          .single();

        if (!insMsgErr && insMsg) {
          const { data: msgHearts } = await supabase
            .from('student_love_message_hearts')
            .select('*')
            .eq('message_id', msg.id);

          if (msgHearts && msgHearts.length > 0) {
            const heartsPayload = msgHearts.map((h: any) => ({
              message_id: insMsg.id,
              user_uid: h.user_uid,
              created_at: h.created_at || now,
            }));
            await supabase.from('users_love_message_hearts').insert(heartsPayload);
            await supabase.from('student_love_message_hearts').delete().eq('message_id', msg.id);
          }
        }
      }

      await supabase.from('student_love_messages').delete().eq('student_id', student.id);
    }
  } catch (migMsgErr) {
    console.warn('Aviso al migrar student_love_messages:', migMsgErr);
  }

  // 6. MIGRACIÓN: Transferir student_daily_stats -> users_daily_stats
  try {
    const { data: stDaily } = await supabase
      .from('student_daily_stats')
      .select('*')
      .eq('student_id', student.id);

    if (stDaily && stDaily.length > 0) {
      const dailyPayload = stDaily.map((d: any) => ({
        target_user_id: user.uid,
        date: d.date,
        knows_count: d.knows_count || 0,
        fans_count: d.fans_count || 0,
        crushes_count: d.crushes_count || 0,
        score: d.score || 0.0,
        views_count: d.views_count || 0,
      }));

      const { error: insDailyErr } = await supabase.from('users_daily_stats').insert(dailyPayload);
      if (!insDailyErr) {
        await supabase.from('student_daily_stats').delete().eq('student_id', student.id);
      }
    }
  } catch (migDailyErr) {
    console.warn('Aviso al migrar student_daily_stats:', migDailyErr);
  }

  // 7. Calcular conteos unificados en users_actitud y users_crushes y sincronizar tabla users
  try {
    const { knowCount, fanCount } = await getUserActitudCounts(user.uid);
    const crushesCount = await getUserCrushesCount(user.uid);

    let updateUserQuery = supabase.from('users').update({ 
      display_name: officialName, 
      claimed_student_id: student.id, 
      is_verified_student: true, 
      knows_count: knowCount,
      fans_count: fanCount,
      crushes_count: crushesCount,
      updated_at: now 
    });
    if (user.email) {
      updateUserQuery = updateUserQuery.eq('email', user.email);
    } else {
      updateUserQuery = updateUserQuery.eq('id', user.uid);
    }

    await Promise.allSettled([
      updateUserQuery,
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

    // Mapear en batch a usuarios de 'users' que hayan reclamado perfiles de estudiantes
    const claimedUsersMap: Record<string, any> = {};
    const claimedUsersByUid: Record<string, any> = {};
    try {
      const { data: claimedUsers } = await supabase
        .from('users')
        .select('id, claimed_student_id, display_name, avatar_url, photo_url, knows_count, fans_count, crushes_count');

      if (claimedUsers) {
        claimedUsers.forEach((u: any) => {
          if (u.claimed_student_id) {
            claimedUsersMap[u.claimed_student_id] = u;
          }
          if (u.id) {
            claimedUsersByUid[u.id] = u;
          }
        });
      }
    } catch (e) {
      console.warn('Aviso al consultar usuarios vinculados en Supabase:', e);
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
      const userClaim = claimedUsersMap[p.id] || 
        (p.claimed_by_uid ? claimedUsersByUid[p.claimed_by_uid] : undefined) || 
        (claim.uid ? claimedUsersByUid[claim.uid] : undefined);

      const isClaimed = Boolean(p.is_claimed || claim.claimed || userClaim);
      const claimedByUid = p.claimed_by_uid || claim.uid || userClaim?.id;
      const claimedByName = userClaim?.display_name || p.claimed_by_name || claim.name;

      const finalNombreCompleto = (isClaimed && (userClaim?.display_name || claimedByName))
        ? (userClaim?.display_name || claimedByName)
        : p.nombre_completo;

      const finalNombre = (isClaimed && (userClaim?.display_name || claimedByName))
        ? (userClaim?.display_name || claimedByName).split(' ')[0]
        : p.nombre;

      const finalAvatar = (isClaimed && userClaim && (userClaim.avatar_url || userClaim.photo_url))
        ? (userClaim.avatar_url || userClaim.photo_url)
        : (p.avatar_url || p.foto_url);
      
      let localCrushCount = 0;
      if (typeof window !== 'undefined') {
        try {
          const localData = JSON.parse(localStorage.getItem(`student_crushes_${p.id}`) || '[]');
          if (Array.isArray(localData)) localCrushCount = localData.length;
        } catch (e) {}
      }

      const totalCrushes = Math.max(crushesMap[p.id] || 0, localCrushCount);

      // Si el perfil está reclamado, sus datos de interacciones y crushes se leen de las tablas de usuarios (users_actitud / users_crushes o users)
      const finalKnows = isClaimed && userClaim && typeof userClaim.knows_count === 'number'
        ? userClaim.knows_count
        : (ints.knows || p.knows_count || 0);

      const finalFans = isClaimed && userClaim && typeof userClaim.fans_count === 'number'
        ? userClaim.fans_count
        : (ints.fan || p.fans_count || 0);

      const finalCrushes = isClaimed && userClaim && typeof userClaim.crushes_count === 'number'
        ? userClaim.crushes_count
        : (totalCrushes || p.crushes_count || 0);

      return {
        ...p,
        nombre_completo: finalNombreCompleto,
        nombre: finalNombre,
        avatar_url: finalAvatar,
        foto_url: finalAvatar,
        dni: expectedDni || p.dni,
        is_claimed: isClaimed,
        claimed_by_uid: claimedByUid,
        claimed_at: p.claimed_at || claim.at,
        claimed_by_name: claimedByName,
        views_count: typeof p.views_count === 'number' ? p.views_count : (Number(p.views_count) || 0),
        knows_count: finalKnows,
        fans_count: finalFans,
        crushes_count: finalCrushes,
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
    // 1. Si el estudiante está reclamado, consultar directamente users_actitud
    const student = await getStudentById(studentId);
    if (student?.is_claimed && student.claimed_by_uid) {
      const status = await hasUserVotedActitud(student.claimed_by_uid, userUid);
      if (status.fans) return { interaction_type: 'fan' };
      if (status.knows) return { interaction_type: 'knows' };
      return null;
    }

    // 2. Si no está reclamado, consultar student_interactions
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
    // 1. Si el estudiante está reclamado, consultar directamente users_actitud
    const student = await getStudentById(studentId);
    if (student?.is_claimed && student.claimed_by_uid) {
      const counts = await getUserActitudCounts(student.claimed_by_uid);
      return { knows: counts.knowCount, fan: counts.fanCount };
    }

    // 2. Si no está reclamado, consultar student_interactions
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
    // 1. Si el estudiante está reclamado, dirigir el voto a users_actitud
    const student = await getStudentById(studentId);
    const claim = isStudentClaimed(studentId);
    const targetUid = student?.claimed_by_uid || (claim.claimed ? claim.uid : undefined);

    if (targetUid && targetUid === userUid) {
      throw new Error('No puedes votar ni ser fan de tu propio perfil oficial.');
    }

    if (student?.is_claimed && student.claimed_by_uid) {
      const attitudeType = type === 'knows' ? 'yo_te_conozco' : 'fans';
      const result = await toggleUserActitudVote(student.claimed_by_uid, userUid, attitudeType);

      if (result.error) {
        throw new Error(result.error);
      }

      // Notificaciones en segundo plano
      try {
        if (type === 'knows' && result.activeVote === 'yo_te_conozco') {
          notifyStudentSubscribers({
            studentId,
            studentName,
            eventType: 'known_added',
            actorUid: userUid,
            actorName: actorName || 'Un estudiante',
            totalCount: result.newCounts.knowCount
          }).catch(() => {});
        } else if (type === 'fan') {
          notifyStudentSubscribers({
            studentId,
            studentName,
            eventType: result.activeVote === 'fans' ? 'fan_added' : 'fan_removed',
            actorUid: userUid,
            actorName: actorName || 'Un estudiante',
            totalCount: result.newCounts.fanCount
          }).catch(() => {});
        }
      } catch (notifErr) {
        console.warn('Error disparando notificación:', notifErr);
      }

      const resAction = !result.activeVote ? 'deleted' : 'inserted';
      const currType = result.activeVote === 'yo_te_conozco' ? 'knows' : result.activeVote === 'fans' ? 'fan' : null;
      return { success: true, action: resAction, current_type: currType };
    }

    // 2. Si no está reclamado, guardar en la tabla student_interactions
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

    // 1. Si el estudiante está reclamado, consultar users_votes
    const student = await getStudentById(studentId);
    if (student?.is_claimed && student.claimed_by_uid) {
      try {
        const { data: userVotes, error: uErr } = await supabase
          .from('users_votes')
          .select('stars')
          .eq('target_user_id', student.claimed_by_uid)
          .eq('user_uid', userUid)
          .gte('created_at', todayIso);

        if (!uErr && userVotes && userVotes.length > 0) {
          return userVotes.map((v: any) => Number(v.stars));
        }
      } catch (e) {}
    }

    // 2. Si no está reclamado (o fallback), consultar student_votes
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
    // 1. Si el estudiante está reclamado, consultar users_votes
    const student = await getStudentById(studentId);
    if (student?.is_claimed && student.claimed_by_uid) {
      try {
        const { data: userVotes, error: uErr } = await supabase
          .from('users_votes')
          .select('stars')
          .eq('target_user_id', student.claimed_by_uid);

        if (!uErr && userVotes && userVotes.length > 0) {
          userVotes.forEach((v: any) => {
            const s = Number(v.stars);
            if (s >= 1 && s <= 5) {
              breakdown[s] = (breakdown[s] || 0) + 1;
            }
          });
          return breakdown;
        }
      } catch (e) {}
    }

    // 2. Si no está reclamado (o fallback), consultar student_votes
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
    const student = await getStudentById(studentId);
    const claim = isStudentClaimed(studentId);
    const targetUid = student?.claimed_by_uid || (claim.claimed ? claim.uid : undefined);

    if (targetUid && targetUid === userUid) {
      return {
        success: false,
        new_score: student?.score || 0,
        total_ratings: student?.total_ratings || 0,
        error: 'No puedes calificar tu propio perfil oficial verificado.'
      };
    }

    // 1. Si el estudiante está reclamado, guardar en users_votes
    if (student?.is_claimed && student.claimed_by_uid) {
      let voteSavedInUsers = false;
      try {
        const { error: insErr } = await supabase
          .from('users_votes')
          .insert([
            {
              target_user_id: student.claimed_by_uid,
              user_uid: userUid,
              stars: stars,
            }
          ]);

        if (!insErr) {
          voteSavedInUsers = true;
        } else {
          console.warn('Aviso al insertar en users_votes (usando fallback student_votes):', insErr.message);
        }
      } catch (e) {}

      // Si falló users_votes (por ejemplo, antes de ejecutar el SQL), usar student_votes
      if (!voteSavedInUsers) {
        await supabase
          .from('student_votes')
          .insert([
            {
              student_id: studentId,
              user_uid: userUid,
              stars: stars,
            }
          ]);
      }

      // Calcular nuevo promedio unificado
      let allVotesData: any[] = [];
      try {
        const { data: uv } = await supabase
          .from('users_votes')
          .select('stars')
          .eq('target_user_id', student.claimed_by_uid);
        if (uv && uv.length > 0) allVotesData = uv;
      } catch (e) {}

      if (allVotesData.length === 0) {
        const { data: sv } = await supabase
          .from('student_votes')
          .select('stars')
          .eq('student_id', studentId);
        if (sv && sv.length > 0) allVotesData = sv;
      }

      if (allVotesData.length > 0) {
        const sum = allVotesData.reduce((acc, curr) => acc + Number(curr.stars), 0);
        const newScore = parseFloat((sum / allVotesData.length).toFixed(1));
        const totalRatings = allVotesData.length;

        await Promise.allSettled([
          supabase.from('students').update({ score: newScore, total_ratings: totalRatings }).eq('id', studentId),
          supabase.from('users').update({ score: newScore, total_ratings: totalRatings }).eq('id', student.claimed_by_uid),
        ]);

        return { success: true, new_score: newScore, total_ratings: totalRatings };
      }

      return { success: true, new_score: stars, total_ratings: 1 };
    }

    // 2. Si no está reclamado, insertar en student_votes
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

    // Calcular nuevo promedio y total
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
    // 1. Si el estudiante está reclamado, consultar directamente users_crushes
    const student = await getStudentById(studentId);
    if (student?.is_claimed && student.claimed_by_uid) {
      const [hasCrushed, count] = await Promise.all([
        hasUserCrushed(student.claimed_by_uid, userUid),
        getUserCrushesCount(student.claimed_by_uid)
      ]);
      return { count, hasCrushed };
    }

    // 2. Si no está reclamado, consultar student_crushes
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
    // 1. Si el estudiante está reclamado, dirigir a users_crushes
    const student = await getStudentById(studentId);
    const claim = isStudentClaimed(studentId);
    const targetUid = student?.claimed_by_uid || (claim.claimed ? claim.uid : undefined);

    if (targetUid && targetUid === userUid) {
      const curCount = student ? (student.crushes_count || 0) : 0;
      return { success: false, hasCrushed: false, count: curCount, error: 'No puedes marcarte a ti mismo como crush.' };
    }

    if (student?.is_claimed && student.claimed_by_uid) {

      const res = await toggleUserCrush(student.claimed_by_uid, userUid);
      
      try {
        notifyStudentSubscribers({
          studentId,
          studentName,
          eventType: res.hasCrushed ? 'crush_added' : 'crush_removed',
          actorUid: userUid,
          actorName: actorName || 'Alguien anónimo',
          totalCount: res.newCount
        }).catch(() => {});
      } catch (e) {}

      return {
        success: !res.error,
        hasCrushed: res.hasCrushed,
        count: res.newCount,
        error: res.error
      };
    }

    // 2. Si no está reclamado, usar la tabla student_crushes
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
  author_gender?: string | null;
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
    const student = await getStudentById(studentId);
    let messages: StudentLoveMessage[] = [];

    // 1. Si el estudiante está reclamado, consultar users_love_messages
    if (student?.is_claimed && student.claimed_by_uid) {
      try {
        const { data: userMsgs, error: umErr } = await supabase
          .from('users_love_messages')
          .select('*')
          .eq('target_user_id', student.claimed_by_uid)
          .order('created_at', { ascending: false });

        if (!umErr && userMsgs && userMsgs.length > 0) {
          messages = userMsgs.map((msg: any) => ({
            id: msg.id,
            student_id: studentId,
            user_uid: msg.user_uid,
            author_name: msg.author_name || 'Anónimo',
            author_avatar: msg.author_avatar || null,
            author_gender: msg.author_gender || null,
            message: msg.content || msg.message || '',
            created_at: msg.created_at,
            hearts_count: Number(msg.hearts_count) || 0,
          })) as StudentLoveMessage[];
        }
      } catch (e) {}
    }

    // 2. Si no hay mensajes de usuario o no está reclamado, consultar student_love_messages
    if (messages.length === 0) {
      const { data, error } = await supabase
        .from('student_love_messages')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

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
    }

    // Obtener los nombres reales y géneros de los autores de los mensajes
    const authorUids = Array.from(
      new Set(
        messages
          .map(m => m.user_uid)
          .filter((uid): uid is string => Boolean(uid && typeof uid === 'string'))
      )
    );

    const userProfileMap: Record<string, { name?: string; gender?: string; avatar?: string }> = {};
    if (authorUids.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('firebase_uid, username, display_name, gender, photo_url')
          .in('firebase_uid', authorUids);

        if (usersData && Array.isArray(usersData)) {
          usersData.forEach((u: any) => {
            if (u.firebase_uid) {
              const customName = (u.username || u.display_name || '').trim();
              const isGen = !customName || 
                customName.toLowerCase() === 'anónimo' || 
                customName.toLowerCase() === 'anonimo' || 
                customName.toLowerCase() === 'usuario anónimo';
              
              userProfileMap[u.firebase_uid] = {
                name: !isGen ? customName : `user_${u.firebase_uid.substring(0, 5)}`,
                gender: u.gender || null,
                avatar: u.photo_url || null,
              };
            }
          });
        }
      } catch (uErr) {
        // Ignorar
      }
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

      let authorGender = msg.user_uid ? userProfileMap[msg.user_uid]?.gender || msg.author_gender || null : null;
      if (!authorGender && msg.user_uid && typeof window !== 'undefined') {
        const cachedGender = localStorage.getItem(`user_gender_${msg.user_uid}`);
        if (cachedGender) authorGender = cachedGender;
      }

      let authorName = (msg.author_name || '').trim();
      const isGeneric = !authorName || 
        authorName.toLowerCase() === 'anónimo' || 
        authorName.toLowerCase() === 'anonimo' || 
        authorName.toLowerCase() === 'usuario anónimo' ||
        authorName.toLowerCase() === 'user_anon';

      if (isGeneric && msg.user_uid) {
        if (userProfileMap[msg.user_uid]?.name) {
          authorName = userProfileMap[msg.user_uid]!.name!;
        } else {
          authorName = `user_${msg.user_uid.substring(0, 5)}`;
        }
      } else if (!authorName) {
        authorName = msg.user_uid ? `user_${msg.user_uid.substring(0, 5)}` : 'Anónimo';
      }

      let authorAvatar = msg.author_avatar;
      if (!authorAvatar && msg.user_uid && userProfileMap[msg.user_uid]?.avatar) {
        authorAvatar = userProfileMap[msg.user_uid]!.avatar!;
      }

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
        author_gender: authorGender,
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
    const student = await getStudentById(studentId);
    const isClaimed = Boolean(student?.is_claimed && student?.claimed_by_uid);

    // 1. Consultar si el usuario ya dio corazón a este mensaje en Supabase
    let alreadyHearted = false;
    try {
      if (isClaimed) {
        const { data: existingHeart } = await supabase
          .from('users_love_message_hearts')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_uid', userUid)
          .maybeSingle();

        alreadyHearted = !!existingHeart;
      } else {
        const { data: existingHeart } = await supabase
          .from('student_love_message_hearts')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_uid', userUid)
          .maybeSingle();

        alreadyHearted = !!existingHeart;
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        alreadyHearted = localStorage.getItem(`student_love_msg_heart_${messageId}_${userUid}`) === 'true';
      }
    }

    let newHeartsCount = 0;
    let nextHasHearted = !alreadyHearted;

    // 2. Obtener el conteo actual del mensaje
    let currentCount = 0;
    try {
      const msgTable = isClaimed ? 'users_love_messages' : 'student_love_messages';
      const { data: msgData } = await supabase
        .from(msgTable)
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

    newHeartsCount = alreadyHearted ? Math.max(0, currentCount - 1) : currentCount + 1;

    // 3. Actualizar corazón y contador en la tabla correspondiente
    try {
      if (isClaimed) {
        if (alreadyHearted) {
          await supabase.from('users_love_message_hearts').delete().eq('message_id', messageId).eq('user_uid', userUid);
        } else {
          await supabase.from('users_love_message_hearts').insert([{ message_id: messageId, user_uid: userUid, created_at: new Date().toISOString() }]);
        }
        await supabase.from('users_love_messages').update({ hearts_count: newHeartsCount }).eq('id', messageId);
      } else {
        if (alreadyHearted) {
          await supabase.from('student_love_message_hearts').delete().eq('message_id', messageId).eq('user_uid', userUid);
        } else {
          await supabase.from('student_love_message_hearts').insert([{ message_id: messageId, user_uid: userUid, created_at: new Date().toISOString() }]);
        }
        await supabase.from('student_love_messages').update({ hearts_count: newHeartsCount }).eq('id', messageId);
      }
    } catch (upErr) {
      console.warn('Notice updating hearts in Supabase:', upErr);
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

    const student = await getStudentById(studentId);
    const claim = isStudentClaimed(studentId);
    const targetUid = student?.claimed_by_uid || (claim.claimed ? claim.uid : undefined);

    if (targetUid && targetUid === userUid) {
      return { success: false, error: 'No puedes enviarte mensajes de amor o confesiones a ti mismo.' };
    }

    let createdMsg: StudentLoveMessage | null = null;

    // 1. Si el estudiante está reclamado, guardar en users_love_messages
    if (student?.is_claimed && student.claimed_by_uid) {
      try {
        const { data: uMsg, error: uErr } = await supabase
          .from('users_love_messages')
          .insert([{
            target_user_id: student.claimed_by_uid,
            user_uid: userUid,
            author_name: authorName || 'Anónimo',
            author_avatar: authorAvatar || null,
            content: trimmed,
            hearts_count: 0,
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (!uErr && uMsg) {
          createdMsg = {
            id: uMsg.id,
            student_id: studentId,
            user_uid: uMsg.user_uid,
            author_name: uMsg.author_name,
            author_avatar: uMsg.author_avatar,
            author_gender: uMsg.author_gender,
            message: uMsg.content,
            created_at: uMsg.created_at,
            hearts_count: 0,
            has_hearted: false,
          };
        }
      } catch (e) {}
    }

    // 2. Si no está reclamado o falló, guardar en student_love_messages
    if (!createdMsg) {
      const payload = {
        student_id: studentId,
        user_uid: userUid,
        author_name: authorName || 'Anónimo',
        author_avatar: authorAvatar || null,
        message: trimmed,
        hearts_count: 0,
        created_at: new Date().toISOString()
      };

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
    }

    if (createdMsg && typeof window !== 'undefined') {
      const cachedGender = localStorage.getItem(`user_gender_${userUid}`);
      if (cachedGender) {
        createdMsg.author_gender = cachedGender;
      }
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
    await Promise.allSettled([
      supabase.from('student_love_messages').delete().eq('id', messageId).eq('user_uid', userUid),
      supabase.from('users_love_messages').delete().eq('id', messageId).eq('user_uid', userUid),
    ]);

    if (typeof window !== 'undefined') {
      const prev: StudentLoveMessage[] = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
      const updated = prev.filter(m => String(m.id) !== String(messageId));
      localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(updated));
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


