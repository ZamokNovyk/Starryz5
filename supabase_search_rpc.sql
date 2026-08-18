-- =======================================================================
-- MIGRACIÓN DE BÚSQUEDA AVANZADA CON TOLERANCIA A ERRORES (pg_trgm)
-- =======================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. Habilitar la extensión oficial de PostgreSQL para similitud trigramática
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índices GiST / GIN para acelerar las búsquedas difusas (Fuzzy Search)
CREATE INDEX IF NOT EXISTS idx_professors_nombre_completo_trgm 
ON public.professors USING gin (nombre_completo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_professors_nombre_trgm 
ON public.professors USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_professors_apellidos_trgm 
ON public.professors USING gin (apellidos gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_educational_centers_name_trgm 
ON public.educational_centers USING gin (name gin_trgm_ops);

-- 3. Función RPC: buscar_con_tolerancia
-- Recibe el término buscado y un umbral opcional (por defecto 0.25)
-- Devuelve los resultados de profesores, alumnos y centros educativos registrados en Supabase.
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
  -- Establecer el límite de similitud trigramática
  PERFORM set_limit(umbral::real);

  RETURN QUERY
  WITH matches AS (
    -- Búsqueda en Profesores y Alumnos (tabla 'professors')
    SELECT 
      p.id::text AS id,
      COALESCE(p.nombre_completo, TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellidos, '')), p.id)::text AS name,
      CASE 
        WHEN p.role = 'Alumno' THEN 'student'::text 
        ELSE 'professor'::text 
      END AS type,
      CASE 
        WHEN p.role = 'Alumno' THEN 'Estudiante de la comunidad'::text
        ELSE COALESCE(p.institute_id, 'Docente Académico')::text
      END AS subtitle,
      COALESCE(p.avatar_url, '')::text AS avatar_url,
      GREATEST(
        similarity(COALESCE(p.nombre_completo, TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellidos, ''))), busqueda),
        similarity(COALESCE(p.nombre, ''), busqueda),
        similarity(COALESCE(p.apellidos, ''), busqueda),
        similarity(COALESCE(p.id, ''), busqueda)
      )::double precision AS similarity_score
    FROM public.professors p
    WHERE 
      similarity(COALESCE(p.nombre_completo, TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellidos, ''))), busqueda) > umbral
      OR similarity(COALESCE(p.nombre, ''), busqueda) > umbral
      OR similarity(COALESCE(p.apellidos, ''), busqueda) > umbral
      OR similarity(COALESCE(p.id, ''), busqueda) > umbral
      OR COALESCE(p.nombre_completo, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(p.nombre, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(p.apellidos, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(p.id, '') ILIKE '%' || busqueda || '%'

    UNION ALL

    -- Búsqueda en Centros Educativos (tabla 'educational_centers')
    SELECT 
      c.id::text AS id,
      c.name::text AS name,
      'center'::text AS type,
      UPPER(COALESCE(c.type, 'Centro Educativo'))::text AS subtitle,
      COALESCE(c.profile_photo_url, '')::text AS avatar_url,
      similarity(c.name, busqueda)::double precision AS similarity_score
    FROM public.educational_centers c
    WHERE 
      similarity(c.name, busqueda) > umbral
      OR c.name ILIKE '%' || busqueda || '%'
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
