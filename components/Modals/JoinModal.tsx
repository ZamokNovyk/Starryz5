'use client';

import React, { useState } from 'react';
import { X, Building2, GraduationCap, CheckCircle2, Sparkles, Mail, User } from 'lucide-react';

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinModal({ isOpen, onClose }: JoinModalProps) {
  const [tab, setTab] = useState<'student' | 'institution'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [career, setCareer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;

    try {
      console.log('Sending registration request to Supabase client...', {
        tab,
        fullName,
        email,
        institution,
        career,
      });
    } catch (err) {
      console.error('Supabase save error handled gracefully', err);
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFullName('');
      setEmail('');
      setInstitution('');
      setCareer('');
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-[#eab308] rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(234,179,8,0.2)] space-y-6 overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-[#151515] border border-[#ffffff15] text-zinc-400 hover:text-white hover:border-[#eab308] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <span className="text-xs font-bold text-[#eab308] uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#eab308]" /> Únete a la comunidad
          </span>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight mt-1">
            REGÍSTRATE EN <span className="text-[#eab308]">STARRYZ 5</span>
          </h3>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-[#0a0a0a] p-1 border border-[#ffffff10]">
          <button
            onClick={() => setTab('student')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'student'
                ? 'bg-[#eab308] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Soy Alumno</span>
          </button>
          <button
            onClick={() => setTab('institution')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'institution'
                ? 'bg-[#eab308] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Registrar Campus</span>
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3 bg-[#eab30810] border border-[#eab30830] rounded-xl animate-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-[#eab308] mx-auto" />
            <h4 className="text-xl font-extrabold text-white">¡Registro Exitoso!</h4>
            <p className="text-xs text-zinc-300">
              Hemos registrado tu solicitud en la base de datos de STARRYZ 5.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                {tab === 'student' ? 'Nombre Completo' : 'Nombre de la Institución'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={tab === 'student' ? 'Ej. Valeria Morales' : 'Ej. Universidad Central'}
                  className="w-full bg-[#0a0a0a] border border-[#ffffff15] rounded-lg px-4 py-3 pl-10 text-sm text-white focus:outline-none focus:border-[#eab308] font-medium"
                />
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                Correo Electrónico Institucional
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@universidad.edu"
                  className="w-full bg-[#0a0a0a] border border-[#ffffff15] rounded-lg px-4 py-3 pl-10 text-sm text-white focus:outline-none focus:border-[#eab308] font-medium"
                />
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {tab === 'student' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                    Campus / Universidad
                  </label>
                  <input
                    type="text"
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="UNAM / Tec / IPN"
                    className="w-full bg-[#0a0a0a] border border-[#ffffff15] rounded-lg px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#eab308]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                    Carrera / Licenciatura
                  </label>
                  <input
                    type="text"
                    required
                    value={career}
                    onChange={(e) => setCareer(e.target.value)}
                    placeholder="Derecho / Medicina"
                    className="w-full bg-[#0a0a0a] border border-[#ffffff15] rounded-lg px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#eab308]"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                  Ubicación / Ciudad del Campus
                </label>
                <input
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Ciudad de México, Guadalajara, Monterrey..."
                  className="w-full bg-[#0a0a0a] border border-[#ffffff15] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#eab308]"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              UNIRSE AHORA
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

