import { supabase } from './supabase';
import { MOCK_INSTITUTIONS, MOCK_STUDENTS } from '@/lib/mockData';

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
  isFuzzy?: boolean; // Indica si proviene de tolerancia a errores ("¿Quizás quisiste decir...?")
}

/**
 * Algoritmo de similitud trigramática en cliente para respaldo resiliente
 */
function calculateTrigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const getTrigrams = (str: string) => {
    const padded = `  ${str} `;
    const trigrams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.slice(i, i + 3));
    }
    return trigrams;
  };

  const trigrams1 = getTrigrams(s1);
  const trigrams2 = getTrigrams(s2);

  let intersection = 0;
  trigrams1.forEach((tg) => {
    if (trigrams2.has(tg)) intersection++;
  });

  const union = trigrams1.size + trigrams2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Consulta de autocompletado y búsqueda inteligente con tolerancia a errores tipográficos.
 * 1. Intenta búsqueda directa con .ilike()
 * 2. Si no hay suficientes resultados, ejecuta la RPC 'buscar_con_tolerancia' de Supabase
 * 3. Incorpora respaldo de similitud local para garantizar siempre resultados en milisegundos
 */
export async function searchWithAutocomplete(
  rawQuery: string,
  threshold: number = 0.25
): Promise<SearchSuggestion[]> {
  const query = rawQuery.trim();
  if (!query || query.length < 1) return [];

  const results: SearchSuggestion[] = [];
  const seenIds = new Set<string>();

  // Helper para agregar elementos sin duplicados
  const addResult = (item: SearchSuggestion) => {
    const key = `${item.type}-${item.id}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      results.push(item);
    }
  };

  // --------------------------------------------------------------------------
  // PASO 1: Búsqueda Directa con .ilike() en Supabase (Profesores y Centros)
  // --------------------------------------------------------------------------
  try {
    const [profResponse, centerResponse] = await Promise.all([
      supabase
        .from('professors')
        .select('id, name, institute_name, avatar_url')
        .or(`name.ilike.%${query}%,institute_name.ilike.%${query}%`)
        .limit(5),
      supabase
        .from('educational_centers')
        .select('id, name, acronym, category, city, image')
        .or(`name.ilike.%${query}%,acronym.ilike.%${query}%,city.ilike.%${query}%`)
        .limit(5)
    ]);

    if (profResponse.data) {
      profResponse.data.forEach((p: any) => {
        addResult({
          id: p.id,
          title: p.name,
          subtitle: p.institute_name || 'Docente Académico',
          type: 'professor',
          avatarUrl: p.avatar_url,
          url: `/profesores/${p.id}`,
          isFuzzy: false,
          similarity: 1.0
        });
      });
    }

    if (centerResponse.data) {
      centerResponse.data.forEach((c: any) => {
        addResult({
          id: c.id || toSlug(c.name),
          title: c.name,
          subtitle: `${c.city || ''} • ${c.category || 'Centro Educativo'}`,
          type: 'center',
          avatarUrl: c.image,
          url: `/educational_centers/${toSlug(c.name)}`,
          isFuzzy: false,
          similarity: 1.0
        });
      });
    }
  } catch (err) {
    console.warn('Aviso al ejecutar búsqueda directa .ilike():', err);
  }

  // Búsqueda directa en datos locales (Instituciones y Alumnos)
  MOCK_INSTITUTIONS.forEach((inst) => {
    if (
      inst.name.toLowerCase().includes(query.toLowerCase()) ||
      inst.acronym.toLowerCase().includes(query.toLowerCase()) ||
      inst.city.toLowerCase().includes(query.toLowerCase())
    ) {
      addResult({
        id: inst.id || toSlug(inst.name),
        title: inst.name,
        subtitle: `${inst.acronym} • ${inst.category} • ${inst.city}`,
        type: 'center',
        avatarUrl: inst.image,
        url: `/educational_centers/${toSlug(inst.name)}`,
        isFuzzy: false,
        similarity: 1.0
      });
    }
  });

  MOCK_STUDENTS.forEach((st) => {
    if (
      st.name.toLowerCase().includes(query.toLowerCase()) ||
      st.career.toLowerCase().includes(query.toLowerCase()) ||
      st.institution.toLowerCase().includes(query.toLowerCase())
    ) {
      addResult({
        id: st.id,
        title: st.name,
        subtitle: `${st.career} • ${st.institution}`,
        type: 'student',
        avatarUrl: st.avatar,
        url: `/search?q=${encodeURIComponent(st.name)}`,
        isFuzzy: false,
        similarity: 1.0
      });
    }
  });

  // --------------------------------------------------------------------------
  // PASO 2: Si hay pocos o ningún resultado directo, activar RPC 'buscar_con_tolerancia'
  // --------------------------------------------------------------------------
  if (results.length < 3) {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('buscar_con_tolerancia', {
        busqueda: query,
        umbral: threshold
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        rpcData.forEach((item: any) => {
          const isFuzzy = item.similarity_score < 0.9;
          const url = item.type === 'professor' 
            ? `/profesores/${item.id}` 
            : `/educational_centers/${toSlug(item.name)}`;

          addResult({
            id: item.id,
            title: item.name,
            subtitle: item.subtitle,
            type: item.type === 'professor' ? 'professor' : 'center',
            avatarUrl: item.avatar_url,
            url,
            similarity: item.similarity_score,
            isFuzzy
          });
        });
      }
    } catch (rpcErr) {
      console.warn('RPC buscar_con_tolerancia no disponible o con latencia:', rpcErr);
    }
  }

  // --------------------------------------------------------------------------
  // PASO 3: Respaldo Difuso en Cliente (Tolerancia a errores tipográficos offline/instantáneo)
  // --------------------------------------------------------------------------
  if (results.length < 3 && query.length >= 3) {
    const allLocalItems: SearchSuggestion[] = [
      ...MOCK_INSTITUTIONS.map(inst => ({
        id: inst.id || toSlug(inst.name),
        title: inst.name,
        subtitle: `${inst.acronym} • ${inst.category} • ${inst.city}`,
        type: 'center' as const,
        avatarUrl: inst.image,
        url: `/educational_centers/${toSlug(inst.name)}`,
      })),
      ...MOCK_STUDENTS.map(st => ({
        id: st.id,
        title: st.name,
        subtitle: `${st.career} • ${st.institution}`,
        type: 'student' as const,
        avatarUrl: st.avatar,
        url: `/search?q=${encodeURIComponent(st.name)}`,
      }))
    ];

    const fuzzyMatches = allLocalItems
      .map(item => {
        const scoreName = calculateTrigramSimilarity(item.title, query);
        const scoreSub = item.subtitle ? calculateTrigramSimilarity(item.subtitle, query) * 0.7 : 0;
        const bestScore = Math.max(scoreName, scoreSub);
        return { item, score: bestScore };
      })
      .filter(m => m.score >= 0.22)
      .sort((a, b) => b.score - a.score);

    fuzzyMatches.slice(0, 4).forEach(({ item, score }) => {
      addResult({
        ...item,
        isFuzzy: true,
        similarity: score
      });
    });
  }

  return results.slice(0, 8);
}
