import { supabase } from './supabase';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

// Google OAuth 2.0 Client ID (Directo de Google Cloud Console - 100% Gratuito e Ilimitado)
export const GOOGLE_CLIENT_ID = "1048861626265-cvmacbok572b21bns1eq15kkf56s0t9f.apps.googleusercontent.com";

const STORAGE_KEY = 'starryz_auth_user';
const TOKEN_STORAGE_KEY = 'starryz_google_token';

// Lista de escuchadores para cambios de estado de autenticación (Reemplazo nativo de onAuthStateChanged)
type AuthCallback = (user: AuthUser | null) => void;
const listeners = new Set<AuthCallback>();

function notifyListeners(user: AuthUser | null) {
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch (err) {
      console.warn('Error en listener de auth:', err);
    }
  });
}

/**
 * Registra un suscriptor para cambios en el estado de autenticación.
 */
export function onAuthStateChanged(callback: AuthCallback): () => void {
  listeners.add(callback);
  // Llamar inmediatamente con el estado actual guardado
  const current = getStoredUser();
  callback(current);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Obtiene el usuario autenticado actualmente desde almacenamiento local.
 */
export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Objeto de compatibilidad hacia atrás para código existente que consulte `auth.currentUser`.
 */
export const auth = {
  get currentUser(): AuthUser | null {
    return getStoredUser();
  }
};

/**
 * Carga el script oficial de Google Identity Services si aún no está presente en la ventana.
 */
export function ensureGoogleScriptLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }

    // Verificar si ya existe una etiqueta script
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Fallo al cargar script de Google Identity')));
      // En caso de que ya estuviera cargado pero el evento load haya pasado
      setTimeout(() => {
        if ((window as any).google?.accounts?.oauth2) resolve();
      }, 500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar el script de Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Sincroniza y preserva el perfil del usuario en la tabla 'users' de Supabase.
 * Vincula por email para no perder perfiles, votos, o registros creados previamente.
 */
export async function syncUserWithSupabase(user: AuthUser, googleSub?: string): Promise<any> {
  if (!user || !user.uid) return null;

  try {
    // 1. Si no es anónimo y tiene email, buscar si ya existe en la base de datos
    if (!user.isAnonymous && user.email) {
      const { data: existing } = await supabase
        .from('users')
        .select('id, firebase_uid, email, display_name, photo_url, role')
        .eq('email', user.email)
        .maybeSingle();

      if (existing) {
        // Preservar el firebase_uid original existente para mantener vinculadas todas sus tablas (votos, actitud, etc.)
        const activeUid = existing.firebase_uid || existing.id || user.uid;
        
        // Actualizar datos más recientes
        await supabase
          .from('users')
          .update({
            display_name: existing.display_name || user.displayName || 'Usuario',
            photo_url: user.photoURL || existing.photo_url,
            is_anonymous: false,
          })
          .eq('id', existing.id);

        return existing;
      }
    }

    // 2. Si no existía, insertar nuevo usuario
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          firebase_uid: user.uid,
          email: user.email,
          display_name: user.displayName || (user.isAnonymous ? 'Usuario Anónimo' : 'Usuario'),
          photo_url: user.photoURL,
          is_anonymous: user.isAnonymous,
        },
        {
          onConflict: 'firebase_uid',
        }
      )
      .select();

    if (error) {
      console.warn('Aviso al sincronizar usuario con Supabase:', error.message);
      return null;
    }
    return data;
  } catch (err: any) {
    console.warn('Aviso de conectividad al sincronizar con Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Inicia sesión usando Google OAuth 2.0 Directo (Google Identity Services).
 * 100% Gratuito e Ilimitado (Sin límites ni costos de Firebase Auth).
 */
export async function loginWithGoogle(): Promise<AuthUser> {
  await ensureGoogleScriptLoaded();

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('El servicio de Google Identity no está disponible. Revisa tu conexión a internet.');
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (resolved) return;
          resolved = true;

          if (tokenResponse?.error) {
            if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
              const cancelErr: any = new Error('Cerraste la ventana de Google antes de completar el inicio de sesión.');
              cancelErr.isUserCancellation = true;
              return reject(cancelErr);
            }
            return reject(new Error(`Error de autenticación Google: ${tokenResponse.error}`));
          }

          if (!tokenResponse?.access_token) {
            return reject(new Error('No se recibió token de acceso de Google.'));
          }

          try {
            // Guardar token temporal
            localStorage.setItem(TOKEN_STORAGE_KEY, tokenResponse.access_token);

            // Consultar datos del perfil oficial de Google usando el token recibido
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            if (!userinfoRes.ok) {
              throw new Error('No se pudo obtener información del perfil de Google.');
            }

            const googleProfile = await userinfoRes.json();
            const email = googleProfile.email;
            const displayName = googleProfile.name || email?.split('@')[0] || 'Usuario';
            const photoURL = googleProfile.picture || null;
            const googleSub = googleProfile.sub;

            // Comprobar si este correo ya existía en la base de datos de Supabase para reutilizar su UID exacto
            let userUid = `google_${googleSub}`;
            if (email) {
              const { data: existingUser } = await supabase
                .from('users')
                .select('id, firebase_uid')
                .eq('email', email)
                .maybeSingle();

              if (existingUser?.firebase_uid) {
                userUid = existingUser.firebase_uid;
              } else if (existingUser?.id) {
                userUid = existingUser.id;
              }
            }

            const authUser: AuthUser = {
              uid: userUid,
              displayName,
              email,
              photoURL,
              isAnonymous: false,
            };

            // Sincronizar en Supabase
            await syncUserWithSupabase(authUser, googleSub);

            // Guardar sesión localmente
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));

            // Notificar a toda la aplicación
            notifyListeners(authUser);

            resolve(authUser);
          } catch (profileErr: any) {
            console.error('Error al procesar perfil de Google:', profileErr);
            reject(profileErr);
          }
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (clientErr: any) {
      console.error('Error al inicializar cliente de Google OAuth:', clientErr);
      reject(clientErr);
    }
  });
}

/**
 * Inicia sesión de manera anónima (guardado localmente en PostgreSQL sin dependencias externas).
 */
export async function loginAnonymously(): Promise<AuthUser> {
  const anonUid = `anon_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
  
  const authUser: AuthUser = {
    uid: anonUid,
    displayName: 'Usuario Anónimo',
    email: null,
    photoURL: null,
    isAnonymous: true,
  };

  await syncUserWithSupabase(authUser);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  notifyListeners(authUser);

  return authUser;
}

/**
 * Cierra la sesión activa.
 */
export async function logout(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);

  try {
    const google = (window as any).google;
    if (google?.accounts?.id?.disableAutoSelect) {
      google.accounts.id.disableAutoSelect();
    }
  } catch (e) {}

  notifyListeners(null);
}

/**
 * Vincula la cuenta anónima actual con Google OAuth Directo.
 */
export async function linkAnonymousWithGoogle(): Promise<AuthUser> {
  const current = getStoredUser();
  if (!current) {
    throw new Error('No hay una sesión activa para vincular.');
  }

  // Realizar flujo de Google OAuth
  const googleUser = await loginWithGoogle();

  // Si había una cuenta anónima previa, marcar su fecha de vinculación
  if (current.isAnonymous && current.uid !== googleUser.uid) {
    try {
      const now = new Date().toISOString();
      await supabase
        .from('users')
        .update({
          is_anonymous: false,
          linked_google_at: now,
        })
        .eq('firebase_uid', current.uid);
    } catch (e) {
      console.warn('Aviso no crítico al vincular cuenta anónima previa:', e);
    }
  }

  return googleUser;
}

/**
 * Actualiza los datos de perfil del usuario activo (nombre o foto) en la sesión local y en Supabase.
 */
export async function updateAuthUserProfile(updates: { displayName?: string; photoURL?: string }) {
  const current = getStoredUser();
  if (!current) return;

  const updated: AuthUser = {
    ...current,
    displayName: updates.displayName !== undefined ? updates.displayName : current.displayName,
    photoURL: updates.photoURL !== undefined ? updates.photoURL : current.photoURL,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyListeners(updated);

  // Sincronizar en tabla users de Supabase
  try {
    await supabase
      .from('users')
      .update({
        display_name: updated.displayName,
        photo_url: updated.photoURL,
      })
      .eq('firebase_uid', updated.uid);
  } catch (err) {
    console.warn('Aviso al actualizar perfil en Supabase:', err);
  }
}

/**
 * Comprueba si un nombre de usuario / apodo está disponible en Supabase.
 */
export async function checkUsernameAvailable(
  username: string,
  currentUserId?: string,
  currentFirebaseUid?: string
): Promise<{ available: boolean; message: string }> {
  const clean = username.trim();
  if (!clean) {
    return { available: false, message: 'El nombre de usuario no puede estar vacío.' };
  }

  if (clean.length < 2) {
    return { available: false, message: 'El nombre debe tener al menos 2 caracteres.' };
  }

  if (clean.length > 35) {
    return { available: false, message: 'El nombre no puede superar los 35 caracteres.' };
  }

  try {
    const { data, error } = await supabase.rpc('check_username_available', {
      p_username: clean,
      p_user_id: currentUserId || null,
      p_firebase_uid: currentFirebaseUid || null,
    });

    if (!error && typeof data === 'boolean') {
      return {
        available: data,
        message: data ? 'Nombre disponible' : 'Este nombre ya está en uso',
      };
    }
  } catch (rpcErr) {
    console.warn('Aviso: RPC check_username_available:', rpcErr);
  }

  try {
    let query = supabase.from('users').select('id, firebase_uid, display_name');

    if (currentFirebaseUid) {
      query = query.neq('firebase_uid', currentFirebaseUid);
    } else if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data: existing, error } = await query.ilike('display_name', clean);
    if (error) {
      console.warn('Error al verificar disponibilidad:', error.message);
      return { available: true, message: 'Nombre disponible' };
    }

    const isTaken = existing && existing.length > 0;
    return {
      available: !isTaken,
      message: !isTaken ? 'Nombre disponible' : 'Este nombre ya está en uso',
    };
  } catch (err) {
    console.warn('Excepción al comprobar username:', err);
    return { available: true, message: 'Nombre disponible' };
  }
}
