import { signInWithPopup, signInAnonymously, signOut, linkWithPopup } from 'firebase/auth';
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
  } catch (error) {
    console.error('Error en login con Google:', error);
    throw error;
  }
}

/**
 * Inicia sesión de manera anónima.
 */
export async function loginAnonymously(): Promise<AuthUser> {
  try {
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
  } catch (error) {
    console.error('Error al vincular cuenta con Google:', error);
    throw error;
  }
}
