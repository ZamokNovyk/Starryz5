'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { auth } from '@/src/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database,
  ArrowLeft,
  Sparkles,
  Heart
} from 'lucide-react';

interface SupabaseUser {
  id: string;
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  created_at: string;
  is_anonymous: boolean;
  linked_google_at: string | null;
}

interface MyProfileProps {
  uid?: string;
  onBackToHome: () => void;
}

export default function MyProfile({ uid, onBackToHome }: MyProfileProps) {
  const { user, linkWithGoogle } = useAuth();
  const [dbUser, setDbUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'info' | 'followed'>('info');

  const isOwnProfile = !uid || (user && user.uid === uid);

  const handleLinkWithGoogleClick = async () => {
    if (!user) return;
    setLinkingGoogle(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await linkWithGoogle();
      
      // Consultar de nuevo los datos de Supabase para obtener el registro actualizado
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', user.uid)
        .single();

      if (error) throw error;

      if (data) {
        setDbUser(data as SupabaseUser);
        setDisplayNameInput(data.display_name || '');
      }

      setSuccessMsg('¡Excelente! Tu cuenta ha sido vinculada con Google de forma segura. Se ha conservado tu nombre de usuario anterior.');
    } catch (err: any) {
      console.error('Error al vincular con Google:', err);
      setErrorMsg(err?.message || 'Error al vincular tu cuenta con Google. Por favor, vuelve a intentarlo.');
    } finally {
      setLinkingGoogle(false);
    }
  };

  useEffect(() => {
    async function fetchUserData() {
      const targetUid = uid || user?.uid;
      if (!targetUid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg(null);

        // Consultar los datos de la base de datos según el UID de Firebase
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', targetUid)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setDbUser(data as SupabaseUser);
          setDisplayNameInput(data.display_name || '');
        }
      } catch (err: any) {
        console.error('Error al obtener datos de Supabase:', err);
        setErrorMsg('No se pudieron obtener los datos de la base de datos de Supabase. El perfil podría no existir.');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user, uid]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dbUser || !isOwnProfile) return;

    if (!displayNameInput.trim()) {
      setErrorMsg('El nombre de usuario no puede estar vacío.');
      return;
    }

    if (displayNameInput.length < 2 || displayNameInput.length > 35) {
      setErrorMsg('El nombre de usuario debe tener entre 2 y 35 caracteres.');
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // 1. Actualizar en Supabase
      const { error: dbError } = await supabase
        .from('users')
        .update({ display_name: displayNameInput.trim() })
        .eq('firebase_uid', user.uid);

      if (dbError) throw dbError;

      // 2. Actualizar en Firebase Auth si el usuario de Firebase está disponible
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayNameInput.trim()
        });
      }

      // Actualizar estado local
      setDbUser(prev => prev ? { ...prev, display_name: displayNameInput.trim() } : null);
      
      setSuccessMsg('¡Perfil actualizado con éxito en Supabase y Firebase!');
      
      // Auto-ocultar el mensaje de éxito después de 4 segundos
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);

    } catch (err: any) {
      console.error('Error al guardar los cambios:', err);
      setErrorMsg(err?.message || 'Error al guardar los cambios en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  if (!user && isOwnProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[#eab308]">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Acceso Restringido</h2>
        <p className="text-zinc-400 max-w-md mx-auto text-sm">
          Por favor inicia sesión con Google o como usuario Anónimo para poder consultar y editar tu perfil en la base de datos.
        </p>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-lg bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs tracking-wider uppercase transition-colors cursor-pointer"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
      
      {/* Botón de retorno */}
      <button
        onClick={onBackToHome}
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#eab308] transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        VOLVER A LA PÁGINA PRINCIPAL
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LADO IZQUIERDO: Tarjeta Resumen */}
        <div className="md:col-span-1 bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl p-6 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#eab3080c] to-transparent"></div>
          
          <div className="relative pt-4">
            {dbUser?.photo_url ? (
              <img
                src={dbUser.photo_url}
                alt={dbUser.display_name || 'Usuario'}
                className="w-24 h-24 rounded-full object-cover ring-3 ring-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#151515] border border-[#eab308]/40 flex items-center justify-center text-3xl font-black text-[#eab308] ring-3 ring-[#eab308]/20 shadow-lg">
                {(dbUser?.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            
            <span className={`absolute bottom-0 right-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
              dbUser?.is_anonymous 
                ? 'bg-[#151515] border border-[#eab308]/30 text-[#eab308]' 
                : 'bg-[#eab308] text-black'
            }`}>
              {dbUser?.is_anonymous ? 'Anónimo' : 'Google'}
            </span>
          </div>

          <div className="space-y-1 w-full">
            <h3 className="text-lg font-black text-white truncate max-w-full">
              {dbUser?.display_name || 'Cargando...'}
            </h3>
            {isOwnProfile && (
              <p className="text-xs text-zinc-400 truncate max-w-full">
                {dbUser?.email || 'Sesión Local Sin Correo'}
              </p>
            )}
          </div>

          <div className="w-full border-t border-[#ffffff10] pt-4 space-y-3 text-left">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 font-medium">Proveedor Auth</span>
              <span className="font-bold text-zinc-300 uppercase font-mono">
                {dbUser?.is_anonymous ? 'Firebase Anon' : 'Google OAuth'}
              </span>
            </div>
            
            {isOwnProfile && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 font-medium">ID en Supabase</span>
                <span className="font-mono text-zinc-400 text-[10px] bg-[#141414] px-1.5 py-0.5 rounded border border-[#ffffff05] truncate max-w-[110px]" title={dbUser?.id}>
                  {dbUser?.id ? `${dbUser.id.substring(0, 8)}...` : '...'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 font-medium">Sincronización</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Database className="w-3 h-3" /> Activa
              </span>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Formulario y Consulta Base de Datos */}
        <div className="md:col-span-2 bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl p-6 sm:p-8 space-y-6">
          
          {/* Tabs Navigation */}
          <div className="flex items-center gap-1.5 bg-[#050505] p-1.5 rounded-xl border border-zinc-800/40 w-fit">
            <button
              type="button"
              onClick={() => setProfileTab('info')}
              className={`px-4.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                profileTab === 'info'
                  ? 'bg-[#eab308] text-black font-extrabold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Información</span>
            </button>

            <button
              type="button"
              onClick={() => setProfileTab('followed')}
              className={`px-4.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                profileTab === 'followed'
                  ? 'bg-[#eab308] text-black font-extrabold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Seguidos</span>
            </button>
          </div>

          {profileTab === 'info' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#eab308]" /> {isOwnProfile ? 'Datos del Alumno en la DB' : 'Datos Públicos del Alumno'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {isOwnProfile 
                    ? 'Consulta en tiempo real los campos guardados en Supabase asociados a tu credencial de Firebase. Puedes modificar tu nombre público a continuación.'
                    : 'Esta es la información comunitaria que el estudiante comparte públicamente en Starryz 5 de forma sincronizada con Supabase.'}
                </p>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#eab308] animate-spin" />
                  <p className="text-xs text-zinc-400 font-mono">Consultando base de datos PostgreSQL...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveChanges} className="space-y-6">
                  
                  {/* Avisos */}
                  {successMsg && (
                    <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Grid Formulario */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Nombre de Usuario */}
                    <div className="sm:col-span-2 space-y-2">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Nombre de Usuario / Apodo Público
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={displayNameInput}
                          onChange={(e) => setDisplayNameInput(e.target.value)}
                          disabled={!isOwnProfile}
                          placeholder="Ej. Valeria Morales"
                          className={`w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all ${
                            isOwnProfile 
                              ? 'bg-[#151515] border border-[#ffffff15] focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308]' 
                              : 'bg-[#121212] border border-[#ffffff0a] text-zinc-300 cursor-not-allowed font-semibold'
                          }`}
                        />
                      </div>
                      {isOwnProfile && (
                        <p className="text-[10px] text-zinc-500">
                          Este nombre es el que verán los demás alumnos en las votaciones y rankings del campus.
                        </p>
                      )}
                    </div>

                    {/* Email (Solo se muestra a uno mismo) */}
                    {isOwnProfile && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> Correo Asociado
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            value={dbUser?.email || 'Sin correo (Anónimo)'}
                            disabled
                            className="w-full bg-[#121212] border border-[#ffffff0a] text-zinc-500 rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {/* Creado el */}
                    <div className={isOwnProfile ? "space-y-2" : "sm:col-span-2 space-y-2"}>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Fecha de Registro
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={dbUser?.created_at ? new Date(dbUser.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          }) : 'Pendiente'}
                          disabled
                          className="w-full bg-[#121212] border border-[#ffffff0a] text-zinc-500 rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium"
                        />
                      </div>
                    </div>

                    {/* Fecha de Vinculación con Google (Solo se muestra a uno mismo) */}
                    {isOwnProfile && dbUser?.linked_google_at && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#eab308]" /> Vinculación con Google
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={new Date(dbUser.linked_google_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                            disabled
                            className="w-full bg-[#121212] border border-[#eab308]/20 text-[#eab308] rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium shadow-[0_0_10px_rgba(234,179,8,0.03)]"
                          />
                        </div>
                      </div>
                    )}

                    {/* UID de Firebase (Solo se muestra a uno mismo) */}
                    {isOwnProfile && (
                      <div className="sm:col-span-2 space-y-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> UID Único de Firebase
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={dbUser?.firebase_uid || ''}
                            disabled
                            className="w-full bg-[#121212] border border-[#ffffff0a] text-zinc-500 rounded-xl px-4 py-3 text-xs outline-none cursor-not-allowed font-mono"
                          />
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Opción de vinculación para usuarios anónimos (Solo para uno mismo) */}
                  {isOwnProfile && user?.isAnonymous && !dbUser?.linked_google_at && (
                    <div className="p-5 rounded-2xl bg-[#eab30805] border border-[#eab30820] space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-[#eab30810] text-[#eab308] flex-shrink-0">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">¿Deseas asegurar tu cuenta?</h4>
                          <p className="text-xs text-zinc-400 mt-1">
                            Vincula tu perfil anónimo con una cuenta de Google para no perder tus datos (como tu nombre de usuario, votos y historial de campus) al limpiar el navegador o cambiar de dispositivo.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-start">
                        <button
                          type="button"
                          disabled={linkingGoogle}
                          onClick={handleLinkWithGoogleClick}
                          className="px-5 py-3 rounded-xl border border-[#ffffff15] bg-[#141414] hover:bg-[#1a1a1a] hover:border-[#eab308]/60 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.336 0 3.327 2.682 1.386 6.573L5.266 9.765z" />
                            <path fill="#4285F4" d="M16.04 15.345c-1.077.737-2.43 1.146-4.04 1.146a7.067 7.067 0 0 1-6.734-4.855L1.386 14.81C3.327 18.72 7.336 21.4 12 21.4c3.136 0 5.927-1.036 7.91-2.827l-3.87-3.228z" />
                            <path fill="#FBBC05" d="M5.266 12a7.1 7.1 0 0 1 0-2.235L1.386 6.573A11.967 11.967 0 0 0 0 12c0 1.927.455 3.745 1.264 5.373l4.002-3.138A7.01 7.01 0 0 1 5.266 12z" />
                            <path fill="#34A853" d="M23.49 12.273c0-.818-.082-1.609-.227-2.364H12v4.51h6.445a5.51 5.51 0 0 1-2.39 3.618l3.873 3.227c2.264-2.09 3.564-5.173 3.564-8.99z" />
                          </svg>
                          <span>{linkingGoogle ? 'VINCULANDO...' : 'VINCULAR CON GOOGLE'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción (Solo si es tu propio perfil) */}
                  {isOwnProfile && (
                    <div className="pt-4 border-t border-[#ffffff10] flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-[0_4px_20px_rgba(234,179,8,0.25)] disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            <span>GUARDANDO...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 text-black" />
                            <span>GUARDAR CAMBIOS</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                </form>
              )}
            </div>
          ) : (
            // PESTAÑA SEGUIDOS
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500 fill-current" /> Miembros Seguidos
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Administra las cuentas de profesores, alumnos o centros educativos que sigues para estar al tanto de sus publicaciones.
                </p>
              </div>

              <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-3 bg-[#050505]">
                <div className="inline-flex p-3 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 mb-1">
                  <Heart className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Sin seguidos todavía</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  Aún no sigues a ningún miembro de la comunidad estudiantil. ¡Explora profesores o centros educativos y haz clic en "Seguir" para verlos aquí!
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
