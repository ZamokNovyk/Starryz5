import { supabase } from './supabase';

export interface ProfileReport {
  id: string;
  target_id: string;
  target_type: 'student' | 'professor';
  target_name: string;
  institute_id: string;
  reported_by: string;
  reporter_name: string;
  reason: string;
  status: 'active' | 'expelled' | 'dismissed';
  votes_keep: number;
  votes_expel: number;
  threshold: number;
  created_at?: string;
  updated_at?: string;
}

export type ReportVoteType = 'keep' | 'expel';

// SQL para configurar la tabla en Supabase si el usuario desea correrla
export const PROFILE_REPORTS_SETUP_SQL = `-- 1. Tabla de reportes de moderación comunitaria (Estilo Left 4 Dead F1/F2)
CREATE TABLE IF NOT EXISTS public.profile_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('student', 'professor')),
    target_name TEXT NOT NULL,
    institute_id TEXT NOT NULL,
    reported_by TEXT NOT NULL,
    reporter_name TEXT NOT NULL DEFAULT 'Usuario',
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expelled', 'dismissed')),
    votes_keep INTEGER NOT NULL DEFAULT 0,
    votes_expel INTEGER NOT NULL DEFAULT 1,
    threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de votos individuales por usuario
CREATE TABLE IF NOT EXISTS public.profile_report_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.profile_reports(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('keep', 'expel')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(report_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_reports_target ON public.profile_reports(target_id, status);
CREATE INDEX IF NOT EXISTS idx_profile_report_votes_lookup ON public.profile_report_votes(report_id, user_id);

ALTER TABLE public.profile_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_report_votes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_reports' AND policyname = 'Permitir todo en profile_reports') THEN
        CREATE POLICY "Permitir todo en profile_reports" ON public.profile_reports FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_report_votes' AND policyname = 'Permitir todo en profile_report_votes') THEN
        CREATE POLICY "Permitir todo en profile_report_votes" ON public.profile_report_votes FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

const LOCAL_STORAGE_REPORTS_KEY = 'starryz_profile_reports';
const LOCAL_STORAGE_VOTES_KEY = 'starryz_profile_report_votes';

function getLocalReports(): ProfileReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: ProfileReport[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(reports));
  } catch {}
}

function getLocalVotes(): { report_id: string; user_id: string; vote_type: ReportVoteType }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalVotes(votes: { report_id: string; user_id: string; vote_type: ReportVoteType }[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_VOTES_KEY, JSON.stringify(votes));
  } catch {}
}

/**
 * Obtiene el reporte activo (si existe) para un estudiante o profesor
 */
export async function getActiveProfileReport(
  targetId: string,
  targetType: 'student' | 'professor'
): Promise<ProfileReport | null> {
  try {
    const { data, error } = await supabase
      .from('profile_reports')
      .select('*')
      .eq('target_id', targetId)
      .eq('target_type', targetType)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as ProfileReport;
    }
  } catch (err) {
    console.debug('Error consultando profile_reports en Supabase, utilizando fallback local:', err);
  }

  // Fallback a almacenamiento local si la tabla aún no existe en Supabase
  const local = getLocalReports();
  const found = local.find(
    r => r.target_id === targetId && r.target_type === targetType && r.status === 'active'
  );
  return found || null;
}

/**
 * Inicia un reporte y votación comunitaria
 */
export async function createProfileReport(params: {
  targetId: string;
  targetType: 'student' | 'professor';
  targetName: string;
  instituteId: string;
  reportedBy: string;
  reporterName: string;
  reason: string;
  threshold?: number;
}): Promise<ProfileReport> {
  const threshold = params.threshold || 5;

  const newReport: Partial<ProfileReport> = {
    target_id: params.targetId,
    target_type: params.targetType,
    target_name: params.targetName,
    institute_id: params.instituteId,
    reported_by: params.reportedBy,
    reporter_name: params.reporterName,
    reason: params.reason,
    status: 'active',
    votes_keep: 0,
    votes_expel: 1, // El creador del reporte vota automáticamente en contra
    threshold,
  };

  try {
    const { data, error } = await supabase
      .from('profile_reports')
      .insert([newReport])
      .select()
      .single();

    if (!error && data) {
      // Registrar el voto inicial del reportero
      try {
        await supabase.from('profile_report_votes').insert([
          {
            report_id: data.id,
            user_id: params.reportedBy,
            vote_type: 'expel',
          },
        ]);
      } catch (vErr) {
        console.debug('Error guardando voto inicial en Supabase:', vErr);
      }

      return data as ProfileReport;
    }
  } catch (err) {
    console.debug('Error creando reporte en Supabase:', err);
  }

  // Fallback local
  const reportObj: ProfileReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    target_id: params.targetId,
    target_type: params.targetType,
    target_name: params.targetName,
    institute_id: params.instituteId,
    reported_by: params.reportedBy,
    reporter_name: params.reporterName,
    reason: params.reason,
    status: 'active',
    votes_keep: 0,
    votes_expel: 1,
    threshold,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const localReports = getLocalReports();
  localReports.unshift(reportObj);
  saveLocalReports(localReports);

  const localVotes = getLocalVotes();
  localVotes.push({
    report_id: reportObj.id,
    user_id: params.reportedBy,
    vote_type: 'expel',
  });
  saveLocalVotes(localVotes);

  return reportObj;
}

/**
 * Obtiene el voto emitido por el usuario en un reporte
 */
export async function getUserVoteOnReport(
  reportId: string,
  userId: string
): Promise<ReportVoteType | null> {
  try {
    const { data, error } = await supabase
      .from('profile_report_votes')
      .select('vote_type')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return data.vote_type as ReportVoteType;
    }
  } catch (err) {
    console.debug('Error consultando voto en Supabase:', err);
  }

  const localVotes = getLocalVotes();
  const vote = localVotes.find(v => v.report_id === reportId && v.user_id === userId);
  return vote ? vote.vote_type : null;
}

/**
 * Emite un voto F1 (conservar) o F2 (expulsar) en el reporte
 */
export async function submitReportVote(params: {
  reportId: string;
  userId: string;
  voteType: ReportVoteType;
}): Promise<{ report: ProfileReport; outcome: 'voted' | 'expelled' | 'dismissed' }> {
  const { reportId, userId, voteType } = params;

  // 1. Obtener el reporte actual
  let currentReport: ProfileReport | null = null;
  try {
    const { data, error } = await supabase
      .from('profile_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (!error && data) {
      currentReport = data as ProfileReport;
    }
  } catch (err) {
    console.debug('Error recuperando reporte:', err);
  }

  if (!currentReport) {
    const localReports = getLocalReports();
    currentReport = localReports.find(r => r.id === reportId) || null;
  }

  if (!currentReport) {
    throw new Error('El reporte especificado no existe o ha expirado.');
  }

  if (currentReport.status !== 'active') {
    return { report: currentReport, outcome: currentReport.status };
  }

  // 2. Verificar si ya votó
  const previousVote = await getUserVoteOnReport(reportId, userId);

  let updatedVotesKeep = currentReport.votes_keep;
  let updatedVotesExpel = currentReport.votes_expel;

  if (previousVote === voteType) {
    // Ya había votado lo mismo
    return { report: currentReport, outcome: 'voted' };
  }

  if (previousVote) {
    // Cambió de opinión: revertir el voto anterior
    if (previousVote === 'keep') updatedVotesKeep = Math.max(0, updatedVotesKeep - 1);
    if (previousVote === 'expel') updatedVotesExpel = Math.max(0, updatedVotesExpel - 1);
  }

  // Sumar nuevo voto
  if (voteType === 'keep') updatedVotesKeep += 1;
  if (voteType === 'expel') updatedVotesExpel += 1;

  // 3. Evaluar resultado según umbral (default 5 votos)
  const threshold = currentReport.threshold || 5;
  let newStatus: 'active' | 'expelled' | 'dismissed' = 'active';
  let outcome: 'voted' | 'expelled' | 'dismissed' = 'voted';

  if (updatedVotesExpel >= threshold) {
    newStatus = 'expelled';
    outcome = 'expelled';
  } else if (updatedVotesKeep >= threshold) {
    newStatus = 'dismissed';
    outcome = 'dismissed';
  }

  // 4. Actualizar en Supabase
  try {
    await supabase.from('profile_report_votes').upsert(
      {
        report_id: reportId,
        user_id: userId,
        vote_type: voteType,
      },
      { onConflict: 'report_id,user_id' }
    );

    const { data: updatedData } = await supabase
      .from('profile_reports')
      .update({
        votes_keep: updatedVotesKeep,
        votes_expel: updatedVotesExpel,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (updatedData) {
      currentReport = updatedData as ProfileReport;
    } else {
      currentReport.votes_keep = updatedVotesKeep;
      currentReport.votes_expel = updatedVotesExpel;
      currentReport.status = newStatus;
    }
  } catch (err) {
    console.debug('Error actualizando voto en Supabase:', err);
    currentReport.votes_keep = updatedVotesKeep;
    currentReport.votes_expel = updatedVotesExpel;
    currentReport.status = newStatus;
  }

  // Actualizar fallback local
  const localReports = getLocalReports();
  const idx = localReports.findIndex(r => r.id === reportId);
  if (idx !== -1) {
    localReports[idx] = {
      ...localReports[idx],
      votes_keep: updatedVotesKeep,
      votes_expel: updatedVotesExpel,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    saveLocalReports(localReports);
  }

  const localVotes = getLocalVotes();
  const voteIdx = localVotes.findIndex(v => v.report_id === reportId && v.user_id === userId);
  if (voteIdx !== -1) {
    localVotes[voteIdx].vote_type = voteType;
  } else {
    localVotes.push({ report_id: reportId, user_id: userId, vote_type: voteType });
  }
  saveLocalVotes(localVotes);

  // 5. Si la decisión fue EXPULSAR, ejecutar eliminación completa del perfil
  if (outcome === 'expelled') {
    if (currentReport.target_type === 'student') {
      await deleteStudentProfile(currentReport.target_id);
    } else if (currentReport.target_type === 'professor') {
      await deleteProfessorProfile(currentReport.target_id);
    }
  }

  return { report: currentReport, outcome };
}

/**
 * Elimina completamente a un estudiante y todos sus registros asociados
 */
export async function deleteStudentProfile(studentId: string): Promise<boolean> {
  try {
    // 1. Limpieza de tablas dependientes
    await Promise.allSettled([
      supabase.from('student_votes').delete().eq('student_id', studentId),
      supabase.from('student_interactions').delete().eq('student_id', studentId),
      supabase.from('student_crushes').delete().eq('student_id', studentId),
      supabase.from('student_daily_stats').delete().eq('student_id', studentId),
      supabase.from('student_love_messages').delete().eq('student_id', studentId),
      supabase.from('student_notification_subscriptions').delete().eq('student_id', studentId),
    ]);

    // 2. Eliminar de la tabla students
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) {
      console.warn('Error eliminando de students en Supabase:', error);
    }
    return true;
  } catch (err) {
    console.error('Error al ejecutar eliminación completa de estudiante:', err);
    return false;
  }
}

/**
 * Elimina completamente a un profesor y todos sus registros asociados
 */
export async function deleteProfessorProfile(professorId: string): Promise<boolean> {
  try {
    // 1. Limpieza de tablas dependientes
    await Promise.allSettled([
      supabase.from('professor_votes').delete().eq('professor_id', professorId),
      supabase.from('professor_interactions').delete().eq('professor_id', professorId),
      supabase.from('professor_crushes').delete().eq('professor_id', professorId),
      supabase.from('professor_notification_subscriptions').delete().eq('professor_id', professorId),
    ]);

    // 2. Eliminar de la tabla professors
    const { error } = await supabase.from('professors').delete().eq('id', professorId);
    if (error) {
      console.warn('Error eliminando de professors en Supabase:', error);
    }
    return true;
  } catch (err) {
    console.error('Error al ejecutar eliminación completa de profesor:', err);
    return false;
  }
}
