/**
 * backblaze.ts
 * Servicio para subir avatares comprimidos a Backblaze B2 y sincronizar con Supabase y Firebase Auth.
 */

import { supabase } from './supabase';
import { auth } from './firebase';
import { updateProfile } from 'firebase/auth';
import { CompressionResult } from './imageCompressor';

export interface UploadAvatarResponse {
  success: boolean;
  publicUrl: string;
  fileId?: string;
  sizeKb?: number;
}

/**
 * Sube la imagen comprimida a Backblaze B2 a través del endpoint seguro /api/upload-avatar
 */
export async function uploadAvatarToBackblaze(
  userId: string,
  compressed: CompressionResult
): Promise<UploadAvatarResponse> {
  const response = await fetch('/api/upload-avatar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: compressed.base64,
      contentType: compressed.format,
      userId,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Fallo al subir la imagen a Backblaze B2');
  }

  return {
    success: true,
    publicUrl: data.publicUrl,
    fileId: data.fileId,
    sizeKb: data.sizeKb,
  };
}

/**
 * Actualiza la URL del avatar en Supabase y en Firebase Auth de forma sincronizada
 */
export async function syncUserAvatarProfile(
  firebaseUid: string,
  publicUrl: string
): Promise<{ success: boolean; photoUrl: string }> {
  // 1. Actualizar en Supabase (tabla 'users')
  const { error: sbError } = await supabase
    .from('users')
    .update({ photo_url: publicUrl })
    .eq('firebase_uid', firebaseUid);

  if (sbError) {
    console.error('Error al actualizar photo_url en Supabase:', sbError);
    throw new Error(`Error en Supabase: ${sbError.message}`);
  }

  // 2. Actualizar en Firebase Auth si el usuario actual coincide
  if (auth.currentUser && auth.currentUser.uid === firebaseUid) {
    try {
      await updateProfile(auth.currentUser, { photoURL: publicUrl });
    } catch (fbErr) {
      console.warn('Aviso: No se pudo actualizar photoURL en Firebase Auth:', fbErr);
    }
  }

  return {
    success: true,
    photoUrl: publicUrl,
  };
}
