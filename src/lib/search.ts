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

/**
 * Consulta de autocompletado y búsqueda inteligente con tolerancia a errores tipográficos.
 * Depende al 100% de Supabase:
 * 1. Invoca la función RPC 'buscar_con_tolerancia' en Supabase.
 * 2. Si la RPC aún no estuviese creada en la base de datos, ejecuta consulta directa con .ilike() sobre las tablas de Supabase.
 * 3. NO contiene datos falsos ni arrays hardcodeados. Si no hay coincidencias, devuelve un array vacío [].
 */
export async function searchWithAutocomplete(
  rawQuery: string,
  threshold: number = 0.25
): Promise<SearchSuggestion[]> {
  const query = rawQuery.trim();
  if (!query || query.length < 1) return [];

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
  // 1. Invocar la función RPC 'buscar_con_tolerancia' en Supabase
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

      if (results.length > 0) {
        return results.slice(0, 8);
      }
    }
  } catch (rpcErr) {
    console.warn('Aviso: RPC buscar_con_tolerancia no disponible o con latencia:', rpcErr);
  }

  // --------------------------------------------------------------------------
  // 2. Consulta Directa a Supabase (.ilike) como respaldo si la RPC no devolvió datos
  // --------------------------------------------------------------------------
  try {
    const [userResponse, studentResponse, profResponse, centerResponse] = await Promise.all([
      supabase
        .from('users')
        .select('id, firebase_uid, display_name, email, photo_url, role, claimed_student_id')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(6),
      supabase
        .from('students')
        .select('id, nombre, apellidos, nombre_completo, avatar_url, institute_id')
        .or(`nombre_completo.ilike.%${query}%,nombre.ilike.%${query}%,apellidos.ilike.%${query}%,id.ilike.%${query}%`)
        .limit(6),
      supabase
        .from('professors')
        .select('id, nombre, apellidos, nombre_completo, role, institute_id, avatar_url')
        .or(`nombre_completo.ilike.%${query}%,nombre.ilike.%${query}%,apellidos.ilike.%${query}%,id.ilike.%${query}%`)
        .limit(6),
      supabase
        .from('educational_centers')
        .select('id, name, type, profile_photo_url')
        .ilike('name', `%${query}%`)
        .limit(6)
    ]);

    // 1. Usuarios registrados en la red social
    if (userResponse.data && Array.isArray(userResponse.data)) {
      userResponse.data.forEach((u: any) => {
        if (!u.display_name && !u.email) return;
        const displayName = u.display_name || u.email?.split('@')[0] || 'Usuario';
        const isClaimed = !!u.claimed_student_id;
        const subtitle = isClaimed 
          ? 'Estudiante Verificado' 
          : (u.role === 'admin' ? 'Administrador' : 'Usuario de Starryz');

        addResult({
          id: u.firebase_uid || u.id,
          title: displayName,
          subtitle,
          type: 'student',
          avatarUrl: u.photo_url || undefined,
          url: `/perfil/${u.firebase_uid || u.id}`,
          isFuzzy: false,
          similarity: 1.0
        });
      });
    }

    // 2. Estudiantes del directorio oficial
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

    // 3. Profesores
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

    // 4. Centros Educativos
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
    console.warn('Aviso en consulta directa a Supabase:', err);
  }

  // Retorna únicamente los resultados encontrados en Supabase (o [] si no hay)
  return results.slice(0, 8);
}
