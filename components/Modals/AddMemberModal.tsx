'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createProfessor } from '@/src/lib/professors';
import { createStudent } from '@/src/lib/students';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  instituteId: string; // The slug/id of the current educational center
  defaultRole?: 'Alumno' | 'Profesor';
  mode?: 'professor' | 'student';
  onSuccess: () => void; // Refresh callback
}

export default function AddMemberModal({
  isOpen,
  onClose,
  instituteId,
  defaultRole = 'Profesor',
  mode,
  onSuccess,
}: AddMemberModalProps) {
  const { user, loginWithGoogle, linkWithGoogle } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isGoogleUser = user && !user.isAnonymous;

  // Determine if adding student or professor
  const isStudent = mode === 'student' || defaultRole === 'Alumno';

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setFirstName('');
      setLastName('');
    }
  }, [isOpen, isStudent]);

  if (!isOpen) return null;

  const handleGoogleConnect = async () => {
    try {
      setAuthLoading(true);
      setError(null);
      if (user?.isAnonymous) {
        await linkWithGoogle();
      } else {
        await loginWithGoogle();
      }
    } catch (err: any) {
      console.error('Error al iniciar sesión con Google:', err);
      setError('No se pudo completar el inicio de sesión con Google. Intenta nuevamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || user.isAnonymous) {
      setError('Solo los usuarios verificados con cuenta de Google pueden añadir perfiles.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Por favor, ingresa los nombres y apellidos completos.');
      return;
    }

    try {
      setSubmitting(true);
      
      if (isStudent) {
        // Guarda en la tabla 'students' de Supabase
        await createStudent({
          nombre: firstName.trim(),
          apellidos: lastName.trim(),
          instituteId,
        }, user.uid);
      } else {
        // Guarda en la tabla 'professors' de Supabase
        await createProfessor({
          nombre: firstName.trim(),
          apellidos: lastName.trim(),
          role: 'Profesor',
          instituteId,
        }, user.uid);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFirstName('');
        setLastName('');
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Error al registrar miembro:', err);
      setError(err.message || 'Error al conectar con la base de datos de Supabase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0a0a0a] border border-[#ffffff10] rounded-2xl p-6 space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón de cierre superior derecho */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#eab308] uppercase tracking-wide">
            {isStudent ? 'Añadir Estudiante' : 'Añadir Profesor'}
          </h2>
          <p className="text-xs text-zinc-400">
            {isStudent 
              ? 'Añade un nuevo estudiante a esta institución.' 
              : 'Añade un nuevo profesor a esta institución.'}
          </p>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              {isStudent ? '¡Estudiante añadido con éxito!' : '¡Profesor añadido con éxito!'}
            </p>
            <p className="text-xs text-zinc-400">
              {isStudent 
                ? 'Se guardó correctamente en la tabla de estudiantes.' 
                : 'Se guardó correctamente en la tabla de profesores.'}
            </p>
          </div>
        ) : !isGoogleUser ? (
          /* Pantalla de restricción para usuarios no Google */
          <div className="text-center space-y-5 py-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#eab308] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(234,179,8,0.15)]">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-white uppercase tracking-wide">
                Exclusivo para Usuarios con Google
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Para evitar perfiles falsos y mantener una base de datos real, solo los usuarios registrados con <strong>cuenta de Google</strong> pueden añadir perfiles de profesores o estudiantes.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2 text-left">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={authLoading}
                className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_20px_rgba(234,179,8,0.25)] cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{user?.isAnonymous ? 'Vincular Google y Continuar' : 'Iniciar con Google'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-zinc-800 bg-[#141414] hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Inputs Nombres y Apellidos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Nombres
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Juan"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Apellidos
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Pérez"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
              </div>
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer"
            >
              {submitting
                ? (isStudent ? 'Añadiendo Estudiante...' : 'Añadiendo Profesor...')
                : (isStudent ? 'Añadir Estudiante' : 'Añadir Profesor')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
