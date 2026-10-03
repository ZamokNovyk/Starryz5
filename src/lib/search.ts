import { supabase } from './supabase';

export function toSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.|\.$/g, ''); // trim dots from start/end
}

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'professor' | 'center' | 'student' | 'query';
  avatarUrl?: string;
  url: string;
  similarity?: number;
  isFuzzy?: boolean;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Consulta de autocompletado y búsqueda inteligente con tolerancia a errores tipográficos.
 * Búsqueda directa sobre 'users', 'students', 'professors' y 'educational_centers' en Supabase.
 */
export async function searchWithAutocomplete(
  rawQuery: string,
  threshold: number = 0.25
): Promise<SearchSuggestion[]> {
  const query = rawQuery.trim();
  if (!query || query.length < 1) return [];

  const normQuery = normalizeText(query);
  const tokens = normQuery.split(/\s+/).filter(Boolean);

  const results: SearchSuggestion[] = [];
  const seenIds = new Set<string>();

  const addResult = (item: SearchSuggestion) => {
    const key = `${item.type}-${item.id}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      results.push(item);
    }
  };

  // --------------------------------------------------------------------------
  // 1. Invocar la función RPC 'buscar_con_tolerancia' en Supabase (si existe)
  // --------------------------------------------------------------------------
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('buscar_con_tolerancia', {
      busqueda: query,
      umbral: threshold
    });

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      rpcData.forEach((item: any) => {
        const isFuzzy = Number(item.similarity_score || 1) < 0.85;
        const type: 'professor' | 'center' | 'student' = 
          item.type === 'professor' ? 'professor' : 
          item.type === 'student' ? 'student' : 'center';

        const url = type === 'professor' 
          ? `/profesores/${item.id}` 
          : type === 'student'
            ? `/perfil/${item.id}`
            : `/educational_centers/${toSlug(item.name)}`;

        addResult({
          id: String(item.id),
          title: item.name || 'Sin nombre',
          subtitle: item.subtitle || undefined,
          type,
          avatarUrl: item.avatar_url || undefined,
          url,
          similarity: Number(item.similarity_score || 1),
          isFuzzy
        });
      });
    }
  } catch (rpcErr) {
    console.warn('Aviso: RPC buscar_con_tolerancia no disponible o con latencia:', rpcErr);
  }

  // --------------------------------------------------------------------------
  // 2. BÚSQUEDA DIRECTA Y RESILIENTE EN LA TABLA 'users'
  // --------------------------------------------------------------------------
  try {
    let usersList: any[] = [];

    // Intento 1: Consulta .or(...) formateada con comillas dobles para PostgREST
    const buildIlike = (col: string, val: string) => `${col}.ilike."%${val.replace(/"/g, '')}%"`;
    const userOrPatterns: string[] = [
      buildIlike('display_name', query),
      buildIlike('nombres', query),
      buildIlike('apellido_paterno', query),
      buildIlike('apellido_materno', query),
      buildIlike('email', query)
    ];

    tokens.forEach(t => {
      if (t.length >= 2) {
        userOrPatterns.push(buildIlike('display_name', t));
        userOrPatterns.push(buildIlike('nombres', t));
        userOrPatterns.push(buildIlike('apellido_paterno', t));
        userOrPatterns.push(buildIlike('apellido_materno', t));
        userOrPatterns.push(buildIlike('email', t));
      }
    });

    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('id, firebase_uid, display_name, nombres, apellido_paterno, apellido_materno, email, photo_url, role, claimed_student_id')
      .or(userOrPatterns.join(','))
      .limit(30);

    if (!userErr && Array.isArray(userData) && userData.length > 0) {
      usersList = userData;
    } else {
      // Intento 2 (Fallback antibugs): si la sintaxis del .or() de PostgREST fallase, consultar los usuarios directamente
      const { data: fallbackUsers } = await supabase
        .from('users')
        .select('id, firebase_uid, display_name, nombres, apellido_paterno, apellido_materno, email, photo_url, role, claimed_student_id')
        .limit(100);

      if (fallbackUsers) {
        usersList = fallbackUsers;
      }
    }

    // Filtrar y procesar resultados de 'users' con comparación inteligente de tokens
    usersList.forEach((u: any) => {
      const fullStructured = [u.nombres, u.apellido_paterno, u.apellido_materno]
        .filter(Boolean)
        .join(' ')
        .trim();

      const dispName = u.display_name || '';
      const emailVal = u.email || '';
      const blob = normalizeText(`${fullStructured} ${dispName} ${emailVal}`);

      const isMatch = blob.includes(normQuery) || 
        (tokens.length > 0 && tokens.every(t => blob.includes(t)));

      if (isMatch) {
        const titleName = fullStructured || dispName || emailVal.split('@')[0] || 'Usuario';
        const isClaimed = !!u.claimed_student_id;
        const subtitle = isClaimed 
          ? 'Estudiante Verificado' 
          : (u.role === 'admin' ? 'Administrador' : 'Usuario de Starryz');

        addResult({
          id: u.firebase_uid || u.id,
          title: titleName,
          subtitle,
          type: 'student',
          avatarUrl: u.photo_url || undefined,
          url: `/perfil/${u.firebase_uid || u.id}`,
          isFuzzy: false,
          similarity: 1.0
        });
      }
    });
  } catch (uErr) {
    console.warn('Aviso en consulta directa de usuarios:', uErr);
  }

  // --------------------------------------------------------------------------
  // 3. Consulta Directa en 'students', 'professors' y 'educational_centers'
  // --------------------------------------------------------------------------
  try {
    const [studentResponse, profResponse, centerResponse] = await Promise.all([
      supabase
        .from('students')
        .select('id, nombre, apellidos, nombre_completo, avatar_url, institute_id')
        .or(`nombre_completo.ilike."%${query}%",nombre.ilike."%${query}%",apellidos.ilike."%${query}%",id.ilike."%${query}%"`)
        .limit(8),
      supabase
        .from('professors')
        .select('id, nombre, apellidos, nombre_completo, role, institute_id, avatar_url')
        .or(`nombre_completo.ilike."%${query}%",nombre.ilike."%${query}%",apellidos.ilike."%${query}%",id.ilike."%${query}%"`)
        .limit(8),
      supabase
        .from('educational_centers')
        .select('id, name, type, profile_photo_url')
        .ilike('name', `%${query}%`)
        .limit(8)
    ]);

    // Estudiantes del directorio oficial
    if (studentResponse.data && Array.isArray(studentResponse.data)) {
      studentResponse.data.forEach((s: any) => {
        const fullName = s.nombre_completo || `${s.nombre || ''} ${s.apellidos || ''}`.trim() || s.id;
        addResult({
          id: s.id,
          title: fullName,
          subtitle: s.institute_id || 'Estudiante del Instituto',
          type: 'student',
          avatarUrl: s.avatar_url || undefined,
          url: `/estudiantes/${s.id}`,
          isFuzzy: false,
          similarity: 1.0
        });
      });
    }

    // Profesores
    if (profResponse.data && Array.isArray(profResponse.data)) {
      profResponse.data.forEach((p: any) => {
        const isStudent = p.role === 'Alumno';
        const fullName = p.nombre_completo || `${p.nombre || ''} ${p.apellidos || ''}`.trim() || p.id;
        
        addResult({
          id: p.id,
          title: fullName,
          subtitle: isStudent ? 'Estudiante de la comunidad' : (p.institute_id || 'Docente Académico'),
          type: isStudent ? 'student' : 'professor',
          avatarUrl: p.avatar_url || undefined,
          url: `/profesores/${p.id}`,
          isFuzzy: false,
          similarity: 1.0
        });
      });
    }

    // Centros Educativos
    if (centerResponse.data && Array.isArray(centerResponse.data)) {
      centerResponse.data.forEach((c: any) => {
        const typeLabel = c.type ? (c.type.charAt(0).toUpperCase() + c.type.slice(1)) : 'Centro Educativo';
        addResult({
          id: c.id,
          title: c.name,
          subtitle: typeLabel,
          type: 'center',
          avatarUrl: c.profile_photo_url || undefined,
          url: `/educational_centers/${toSlug(c.name)}`,
          isFuzzy: false,
          similarity: 1.0
        });
      });
    }
  } catch (err) {
    console.warn('Aviso en consulta de directorio:', err);
  }

  return results.slice(0, 8);
}
