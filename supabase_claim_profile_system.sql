-- ============================================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: SISTEMA DE RECLAMO DE PERFILES DE ESTUDIANTES
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. Agregar columnas de reclamo e identidad a la tabla 'students' (si no existen)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS claimed_by_uid TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS claimed_by_name TEXT;

-- 2. Agregar columnas de estudiante verificado a la tabla 'users' (si no existen)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS claimed_student_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified_student BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS knows_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fans_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS crushes_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dni VARCHAR(20);

-- 3. Índices para búsqueda ultra rápida y prevención de duplicados
CREATE INDEX IF NOT EXISTS idx_students_is_claimed ON public.students(is_claimed);
CREATE INDEX IF NOT EXISTS idx_students_claimed_by_uid ON public.students(claimed_by_uid);
CREATE INDEX IF NOT EXISTS idx_users_claimed_student_id ON public.users(claimed_student_id);

-- 4. Asegurar políticas RLS en la tabla 'students'
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de estudiantes" ON public.students;
CREATE POLICY "Lectura pública de estudiantes"
  ON public.students FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Actualización de estudiantes para reclamo y wiki" ON public.students;
CREATE POLICY "Actualización de estudiantes para reclamo y wiki"
  ON public.students FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Inserción de estudiantes" ON public.students;
CREATE POLICY "Inserción de estudiantes"
  ON public.students FOR INSERT
  WITH CHECK (true);

-- 5. Sincronizar perfiles existentes reclamados:
-- Si un usuario en 'users' ya tiene claimed_student_id, asegurar que 'students' tenga is_claimed = true
UPDATE public.students s
SET is_claimed = true,
    claimed_by_uid = u.id,
    claimed_by_name = u.display_name,
    claimed_at = COALESCE(s.claimed_at, NOW())
FROM public.users u
WHERE u.claimed_student_id = s.id;
