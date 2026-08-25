'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Por favor, ingresa los nombres y apellidos completos.');
      return;
    }

    if (!user) {
      setError('Debes iniciar sesión para registrar un miembro.');
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
