'use client';

import React, { useState } from 'react';
import { X, User, Award, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createProfessor } from '@/src/lib/professors';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  instituteId: string; // The slug/id of the current educational center
  onSuccess: () => void; // Refresh callback
}

export default function AddMemberModal({
  isOpen,
  onClose,
  instituteId,
  onSuccess,
}: AddMemberModalProps) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'Alumno' | 'Profesor'>('Profesor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      
      // Use our backend service
      await createProfessor({
        nombre: firstName.trim(),
        apellidos: lastName.trim(),
        role,
        instituteId,
      }, user.uid);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFirstName('');
        setLastName('');
        setRole('Profesor');
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
            Añadir Miembro
          </h2>
          <p className="text-xs text-zinc-400">
            Añade un nuevo estudiante o profesor a esta institución.
          </p>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">¡Miembro añadido con éxito!</p>
            <p className="text-xs text-zinc-400">Se generó el enlace permanente para su perfil.</p>
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

            {/* Selector de Rol */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Rol
              </label>
              <div className="flex items-center gap-6">
                {/* Alumno Radio */}
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="role"
                    checked={role === 'Alumno'}
                    onChange={() => setRole('Alumno')}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    role === 'Alumno' 
                      ? 'border-[#eab308]' 
                      : 'border-zinc-700 group-hover:border-zinc-500'
                  }`}>
                    {role === 'Alumno' && (
                      <div className="w-2 h-2 rounded-full bg-[#eab308]" />
                    )}
                  </div>
                  <span className="text-xs font-extrabold text-zinc-300 group-hover:text-white transition-colors">
                    Alumno
                  </span>
                </label>

                {/* Profesor Radio */}
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="role"
                    checked={role === 'Profesor'}
                    onChange={() => setRole('Profesor')}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    role === 'Profesor' 
                      ? 'border-[#eab308]' 
                      : 'border-zinc-700 group-hover:border-zinc-500'
                  }`}>
                    {role === 'Profesor' && (
                      <div className="w-2 h-2 rounded-full bg-[#eab308]" />
                    )}
                  </div>
                  <span className="text-xs font-extrabold text-zinc-300 group-hover:text-white transition-colors">
                    Profesor
                  </span>
                </label>
              </div>
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer"
            >
              {submitting ? 'Añadiendo Miembro...' : 'Añadir Miembro'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
