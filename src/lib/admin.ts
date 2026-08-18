import { supabase } from './supabase';

export interface AdminUserMetric {
  totalUsers: number;
  directGoogle: number;
  activeAnonymous: number;
  linkedAnonymous: number;
  adminUsers: number;
}

export interface AdminCentersMetric {
  totalCenters: number;
  colegios: number;
  institutos: number;
  universidades: number;
}

export interface AdminDashboardData {
  userMetrics: AdminUserMetric;
  centerMetrics: AdminCentersMetric;
  recentUsers: Array<{
    id: string;
    firebase_uid: string;
    email: string | null;
    display_name: string | null;
    username: string | null;
    role: string | null;
    is_anonymous: boolean;
    linked_google_at: string | null;
    created_at: string;
  }>;
}

/**
 * Consulta en tiempo real las métricas dinámicas de usuarios y centros desde Supabase
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardData> {
  try {
    // 1. Consultar todos los usuarios en Supabase
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error('Error al consultar tabla users en admin metrics:', usersError.message);
    }

    const users: any[] = usersData || [];

    // Lógica dinámica de estados de usuarios:
    // a) Directo con Google: proveedor Google (tiene email o is_anonymous=false) que NO fue anónimo previamente
    const directGoogle = users.filter(u => {
      const isAnon = u.is_anonymous === true;
      const hasLinkedGoogle = Boolean(u.linked_google_at);
      const hasEmail = Boolean(u.email);
      // Si tiene email y no es anónimo y no tiene fecha de migración posterior -> Directo con Google
      return (hasEmail || !isAnon) && !hasLinkedGoogle;
    }).length;

    // b) Usuarios Anónimos Actuales: registrados de forma anónima que aún NO han vinculado Google
    const activeAnonymous = users.filter(u => {
      const isAnon = u.is_anonymous === true;
      const hasLinkedGoogle = Boolean(u.linked_google_at);
      return isAnon && !hasLinkedGoogle;
    }).length;

    // c) Anónimos Migrados / Vinculados a Google: iniciaron como anónimos y vincularon Google OAuth
    const linkedAnonymous = users.filter(u => {
      return Boolean(u.linked_google_at);
    }).length;

    const adminUsers = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;

    const userMetrics: AdminUserMetric = {
      totalUsers: users.length,
      directGoogle,
      activeAnonymous,
      linkedAnonymous,
      adminUsers
    };

    // 2. Consultar todos los centros educativos
    const { data: centersData, error: centersError } = await supabase
      .from('educational_centers')
      .select('*');

    if (centersError) {
      console.warn('Aviso al consultar centros en admin metrics:', centersError.message);
    }

    const centers: any[] = centersData || [];
    
    let colegios = 0;
    let institutos = 0;
    let universidades = 0;

    centers.forEach(c => {
      const type = (c.type || '').toLowerCase().trim();
      if (type === 'colegio') {
        colegios++;
      } else if (type === 'instituto') {
        institutos++;
      } else {
        // universidades o default
        universidades++;
      }
    });

    const centerMetrics: AdminCentersMetric = {
      totalCenters: centers.length,
      colegios,
      institutos,
      universidades
    };

    return {
      userMetrics,
      centerMetrics,
      recentUsers: users.slice(0, 20)
    };
  } catch (err) {
    console.error('Error general al obtener métricas del panel de administración:', err);
    return {
      userMetrics: {
        totalUsers: 0,
        directGoogle: 0,
        activeAnonymous: 0,
        linkedAnonymous: 0,
        adminUsers: 0
      },
      centerMetrics: {
        totalCenters: 0,
        colegios: 0,
        institutos: 0,
        universidades: 0
      },
      recentUsers: []
    };
  }
}
