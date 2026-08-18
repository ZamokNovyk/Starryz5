-- =======================================================================
-- MIGRACIÓN DE BÚSQUEDA AVANZADA CON TOLERANCIA A ERRORES (pg_trgm)
-- =======================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. Habilitar la extensión oficial de PostgreSQL para similitud trigramática
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índices GiST / GIN para acelerar las búsquedas difusas (Fuzzy Search)
CREATE INDEX IF NOT EXISTS idx_professors_name_trgm 
ON public.professors USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_professors_institute_trgm 
ON public.professors USING gin (institute_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_educational_centers_name_trgm 
ON public.educational_centers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_educational_centers_acronym_trgm 
ON public.educational_centers USING gin (acronym gin_trgm_ops);

-- 3. Función RPC: buscar_con_tolerancia
-- Recibe el término buscado y un umbral opcional (por defecto 0.25)
-- Devuelve los resultados de profesores y centros educativos más parecidos, ordenados por similitud.
CREATE OR REPLACE FUNCTION public.buscar_con_tolerancia(
  busqueda text,
  umbral double precision DEFAULT 0.25
)
RETURNS TABLE (
  id text,
  name text,
  type text,
  subtitle text,
  avatar_url text,
  similarity_score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Establecer el límite de similitud para la sesión actual
  PERFORM set_limit(umbral::real);

  RETURN QUERY
  WITH matches AS (
    -- Búsqueda difusa en Profesores
    SELECT 
      p.id::text AS id,
      p.name::text AS name,
      'professor'::text AS type,
      COALESCE(p.institute_name, 'Docente Académico')::text AS subtitle,
      p.avatar_url::text AS avatar_url,
      GREATEST(
        similarity(p.name, busqueda),
        similarity(COALESCE(p.institute_name, ''), busqueda)
      )::double precision AS similarity_score
    FROM public.professors p
    WHERE 
      similarity(p.name, busqueda) > umbral
      OR similarity(COALESCE(p.institute_name, ''), busqueda) > umbral
      OR p.name ILIKE '%' || busqueda || '%'
      OR p.institute_name ILIKE '%' || busqueda || '%'

    UNION ALL

    -- Búsqueda difusa en Centros Educativos
    SELECT 
      c.id::text AS id,
      c.name::text AS name,
      'center'::text AS type,
      COALESCE(c.city || ' • ' || c.category, c.category, 'Centro Educativo')::text AS subtitle,
      c.image::text AS avatar_url,
      GREATEST(
        similarity(c.name, busqueda),
        similarity(COALESCE(c.acronym, ''), busqueda)
      )::double precision AS similarity_score
    FROM public.educational_centers c
    WHERE 
      similarity(c.name, busqueda) > umbral
      OR similarity(COALESCE(c.acronym, ''), busqueda) > umbral
      OR c.name ILIKE '%' || busqueda || '%'
      OR c.acronym ILIKE '%' || busqueda || '%'
  )
  SELECT 
    m.id,
    m.name,
    m.type,
    m.subtitle,
    m.avatar_url,
    m.similarity_score
  FROM matches m
  ORDER BY m.similarity_score DESC
  LIMIT 10;
END;
$$;
