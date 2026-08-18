import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { getAdminDashboardMetrics, AdminDashboardData } from '@/src/lib/admin';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Building2,
  School,
  GraduationCap,
  Sparkles,
  Link2,
  UserX,
  UserCheck,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Layers,
  Award,
  AlertCircle
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export default function AdminDashboard({ onBack, onNavigate }: AdminDashboardProps) {
  const { user } = useAuth();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<AdminDashboardData | null>(null);

  // 1. Verificación estricta de seguridad y rol
  useEffect(() => {
    async function verifyAdminRole() {
      if (!user) {
        setIsAdmin(false);
        setCheckingRole(false);
        setLoadingMetrics(false);
        return;
      }

      try {
        setCheckingRole(true);
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('firebase_uid', user.uid)
          .single();

        if (!error && data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error al verificar permisos de administrador:', err);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    }

    verifyAdminRole();
  }, [user]);

  // 2. Cargar métricas en tiempo real si es Admin
  const loadMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const data = await getAdminDashboardMetrics();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error al cargar métricas:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadMetrics();
    }
  }, [isAdmin]);

  // Pantalla de comprobación de permisos
  if (checkingRole) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-12 h-12 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-black uppercase tracking-widest text-amber-400 font-mono">
          Verificando credenciales de Administrador...
        </p>
      </div>
    );
  }

  // Pantalla de Acceso Denegado (Seguridad y Protección)
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex p-4 rounded-3xl bg-red-950/40 border border-red-500/30 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Acceso Restringido (403)
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Esta sección es exclusiva para administradores de Starryz 5 con el rol <span className="text-amber-400 font-mono font-bold">admin</span> verificado en la base de datos de Supabase.
          </p>
        </div>

        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </button>
      </div>
    );
  }

  const userMetrics = metrics?.userMetrics || {
    totalUsers: 0,
    directGoogle: 0,
    activeAnonymous: 0,
    linkedAnonymous: 0,
    adminUsers: 0
  };

  const centerMetrics = metrics?.centerMetrics || {
    totalCenters: 0,
    colegios: 0,
    institutos: 0,
    universidades: 0
  };

  const totalUsers = userMetrics.totalUsers || 1;
  const directGooglePct = Math.round((userMetrics.directGoogle / totalUsers) * 100) || 0;
  const activeAnonPct = Math.round((userMetrics.activeAnonymous / totalUsers) * 100) || 0;
  const linkedAnonPct = Math.round((userMetrics.linkedAnonymous / totalUsers) * 100) || 0;

  const totalCenters = centerMetrics.totalCenters || 1;
  const colegiosPct = Math.round((centerMetrics.colegios / totalCenters) * 100) || 0;
  const institutosPct = Math.round((centerMetrics.institutos / totalCenters) * 100) || 0;
  const universidadesPct = Math.round((centerMetrics.universidades / totalCenters) * 100) || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Header del Panel de Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div className="space-y-1.5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer group mb-1"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>VOLVER AL PERFIL</span>
          </button>
          
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-amber-400 stroke-[2.5]" />
              <span>PANEL DE CONTROL ADMIN</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              ADMIN VERIFICADO
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Monitor de telemetría y métricas dinámicas de cuentas y centros educativos en Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMetrics}
            disabled={loadingMetrics}
            className="px-4 py-2.5 rounded-xl bg-[#141414] hover:bg-[#1a1a1a] border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-amber-500/60 active:scale-95 disabled:opacity-50"
            title="Recargar métricas en vivo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin text-amber-400' : ''}`} />
            <span>{loadingMetrics ? 'ACTUALIZANDO...' : 'RECARGAR'}</span>
          </button>
        </div>
      </div>

      {/* 2. MÓDULO DE USUARIOS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              Módulo de Usuarios y Proveedores Auth
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            Última sincronización: {lastRefreshed.toLocaleTimeString('es-ES')}
          </span>
        </div>

        {/* Grid de 4 Cards de Usuarios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Directo con Google */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-emerald-500/20 relative overflow-hidden shadow-lg group hover:border-emerald-500/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase">
                {directGooglePct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {userMetrics.directGoogle}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Directo con Google
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Registrados directamente vía Google OAuth sin etapa anónima previa.
              </p>
            </div>
          </div>

          {/* Card 2: Anónimos Activos (Solo Anónimos) */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-500/20 relative overflow-hidden shadow-lg group hover:border-amber-500/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <UserX className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase">
                {activeAnonPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {userMetrics.activeAnonymous}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Anónimos Activos
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Usuarios temporales que aún no han vinculado su cuenta a Google.
              </p>
            </div>
          </div>

          {/* Card 3: Anónimos Migrados a Google */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-blue-500/20 relative overflow-hidden shadow-lg group hover:border-blue-500/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Link2 className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase">
                {linkedAnonPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {userMetrics.linkedAnonymous}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Anónimos Vinculados
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Migraron de sesión anónima a Google conservando su historial y votos.
              </p>
            </div>
          </div>

          {/* Card 4: Total Global de Usuarios */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-400/40 relative overflow-hidden shadow-[0_0_25px_rgba(245,158,11,0.1)] group hover:border-amber-400 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/30">
                <Users className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase">
                GLOBAL
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-amber-300 tracking-tight font-mono">
                {userMetrics.totalUsers}
              </div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">
                Total de Usuarios
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Total de registros sincronizados en la tabla <code className="text-amber-300">users</code> de Supabase.
              </p>
            </div>
          </div>

        </div>

        {/* Barra de Distribución Visual de Usuarios */}
        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-300 uppercase tracking-wider">Distribución de Proveedores</span>
            <span className="text-zinc-500 font-mono">{userMetrics.totalUsers} cuentas totales</span>
          </div>

          <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden flex gap-1 p-0.5 border border-zinc-800">
            <div 
              style={{ width: `${directGooglePct}%` }} 
              className="bg-emerald-500 rounded-full transition-all duration-500" 
              title={`Directo con Google: ${userMetrics.directGoogle} (${directGooglePct}%)`}
            />
            <div 
              style={{ width: `${activeAnonPct}%` }} 
              className="bg-amber-500 rounded-full transition-all duration-500" 
              title={`Anónimos Activos: ${userMetrics.activeAnonymous} (${activeAnonPct}%)`}
            />
            <div 
              style={{ width: `${linkedAnonPct}%` }} 
              className="bg-blue-500 rounded-full transition-all duration-500" 
              title={`Anónimos Vinculados: ${userMetrics.linkedAnonymous} (${linkedAnonPct}%)`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">Directo Google: <strong className="text-white font-mono">{userMetrics.directGoogle}</strong> ({directGooglePct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-zinc-400">Anónimos Activos: <strong className="text-white font-mono">{userMetrics.activeAnonymous}</strong> ({activeAnonPct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-zinc-400">Anónimos Vinculados: <strong className="text-white font-mono">{userMetrics.linkedAnonymous}</strong> ({linkedAnonPct}%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MÓDULO DE CENTROS EDUCATIVOS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            Módulo de Centros Educativos
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Centros */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-400/40 shadow-md">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <School className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase">
                CAMPUS
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {centerMetrics.totalCenters}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Total de Centros
              </div>
              <p className="text-[11px] text-zinc-500">
                Instituciones registradas en la plataforma.
              </p>
            </div>
          </div>

          {/* Colegios */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase">
                {colegiosPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-purple-400 tracking-tight font-mono">
                {centerMetrics.colegios}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Colegios
              </div>
              <p className="text-[11px] text-zinc-500">
                Educación primaria y secundaria.
              </p>
            </div>
          </div>

          {/* Institutos */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase">
                {institutosPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-cyan-400 tracking-tight font-mono">
                {centerMetrics.institutos}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Institutos
              </div>
              <p className="text-[11px] text-zinc-500">
                Educación superior técnica y especializada.
              </p>
            </div>
          </div>

          {/* Universidades */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Award className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase">
                {universidadesPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-amber-400 tracking-tight font-mono">
                {centerMetrics.universidades}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Universidades
              </div>
              <p className="text-[11px] text-zinc-500">
                Educación superior universitaria y postgrado.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. TABLA DE USUARIOS RECIENTES */}
      {metrics?.recentUsers && metrics.recentUsers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Cuentas Registradas Recientemente
              </h2>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Mostrando los últimos {metrics.recentUsers.length} usuarios
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-[#0d0d0d]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121212] border-b border-zinc-800 text-[10px] uppercase font-black tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3.5">Usuario</th>
                  <th className="px-4 py-3.5">Estado / Proveedor</th>
                  <th className="px-4 py-3.5">Rol</th>
                  <th className="px-4 py-3.5">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {metrics.recentUsers.map((u) => {
                  const isDirectGoogle = !u.is_anonymous && !u.linked_google_at;
                  const isLinkedGoogle = Boolean(u.linked_google_at);
                  const isAnon = u.is_anonymous && !u.linked_google_at;
                  const isUserAdmin = u.role === 'admin';

                  return (
                    <tr key={u.id} className="hover:bg-[#141414] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">
                          {u.display_name || u.username || 'Sin apodo'}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[200px]">
                          {u.email || (isAnon ? 'Sesión anónima temporal' : 'Sin correo')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isDirectGoogle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
                            <UserCheck className="w-3 h-3" /> Directo Google
                          </span>
                        ) : isLinkedGoogle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase">
                            <Link2 className="w-3 h-3" /> Anónimo Vinculado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase">
                            <UserX className="w-3 h-3" /> Anónimo Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black uppercase shadow-sm">
                            <ShieldCheck className="w-3 h-3 stroke-[3]" /> ADMIN
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500 font-mono uppercase">
                            Estudiante
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
