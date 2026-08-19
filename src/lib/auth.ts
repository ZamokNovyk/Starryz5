import { 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  linkWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { supabase } from './supabase';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

/**
 * Sincroniza los detalles del usuario autenticado con la tabla 'users' de Supabase.
 * Realiza un upsert comprobando por el campo 'firebase_uid'.
 */
export async function syncUserWithSupabase(user: AuthUser) {
  try {
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
      console.error('Error al sincronizar usuario con Supabase:', error.message);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('Excepción al sincronizar usuario con Supabase:', err);
    throw err;
  }
}

/**
 * Inicia sesión usando Google Popup.
 */
export async function loginWithGoogle(): Promise<AuthUser> {
  try {
    // Forzar explícitamente persistencia local para evitar errores de IndexedDB bloqueado o en pestañas ocultas
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    const user: AuthUser = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      isAnonymous: firebaseUser.isAnonymous,
    };

    await syncUserWithSupabase(user);
    return user;
  } catch (error: any) {
    console.error('Error en login con Google:', error);
    // Manejo de errores específicos y amigables para el usuario
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('La ventana emergente de inicio de sesión fue bloqueada por tu navegador. Por favor, permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Cerraste la ventana de Google antes de completar el inicio de sesión.');
    }
    if (error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Se canceló la ventana de inicio de sesión anterior por una nueva solicitud.');
    }
    throw error;
  }
}

/**
 * Inicia sesión de manera anónima.
 */
export async function loginAnonymously(): Promise<AuthUser> {
  try {
    // Forzar persistencia para sesiones anónimas
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInAnonymously(auth);
    const firebaseUser = result.user;

    const user: AuthUser = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || 'Usuario Anónimo',
      email: firebaseUser.email || null,
      photoURL: firebaseUser.photoURL || null,
      isAnonymous: firebaseUser.isAnonymous,
    };

    await syncUserWithSupabase(user);
    return user;
  } catch (error) {
    console.error('Error en login anónimo:', error);
    throw error;
  }
}

/**
 * Cierra la sesión en Firebase.
 */
export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error en logout:', error);
    throw error;
  }
}

/**
 * Vincula la cuenta anónima actual con Google.
 */
export async function linkAnonymousWithGoogle(): Promise<AuthUser> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay un usuario activo para vincular.");
    }

    await setPersistence(auth, browserLocalPersistence);
    const result = await linkWithPopup(currentUser, googleProvider);
    const firebaseUser = result.user;

    const user: AuthUser = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      isAnonymous: firebaseUser.isAnonymous,
    };

    const now = new Date().toISOString();
    
    // Actualizamos solo los datos del proveedor y la fecha de vinculación
    // preservando el nombre de usuario de Supabase ya que no lo actualizamos en este query
    const { error } = await supabase
      .from('users')
      .update({
        email: user.email,
        photo_url: user.photoURL,
        is_anonymous: false,
        linked_google_at: now
      })
      .eq('firebase_uid', user.uid);

    if (error) {
      console.error("Error al actualizar la vinculación en Supabase:", error.message);
      throw error;
    }

    return user;
  } catch (error: any) {
    console.error('Error al vincular cuenta con Google:', error);
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('La ventana emergente de vinculación fue bloqueada por tu navegador. Por favor permite las ventanas emergentes.');
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Cancelaste la vinculación de cuenta al cerrar la ventana flotante.');
    }
    throw error;
  }
}

/**
 * Comprueba si un nombre de usuario / apodo está disponible en Supabase llamando al RPC 'check_username_available'.
 * Si el RPC no está disponible o da error, ejecuta una consulta de comprobación directa en Supabase.
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

  // 1. Invocar la función RPC 'check_username_available' en Supabase
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

  // 2. Consulta de respaldo directo en la tabla 'users' de Supabase
  try {
    let query = supabase
      .from('users')
      .select('id, firebase_uid, display_name');

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

