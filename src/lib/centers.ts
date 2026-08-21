import { supabase } from './supabase';
import { apiFetch } from './api';

export interface EducationalCenter {
  id: string;
  name: string;
  type: 'colegio' | 'instituto' | 'universidad';
  profile_photo_url: string | null;
  description?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  twitter_url?: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateCenterData {
  name: string;
  type: 'colegio' | 'instituto' | 'universidad';
  photoUrl?: string;
}

/**
 * Inserta un nuevo centro educativo en la tabla 'educational_centers' vía backend API proxy (0 MAU).
 */
export async function createEducationalCenter(data: CreateCenterData, firebaseUid: string): Promise<EducationalCenter> {
  if (!data.name || !data.name.trim()) {
    throw new Error('El nombre del centro educativo es requerido.');
  }

  // 1. Intentar vía Backend Proxy API
  try {
    const res = await apiFetch<EducationalCenter>('/api/educational-centers', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name.trim(),
        type: data.type,
        photoUrl: data.photoUrl?.trim() || null,
        firebaseUid,
      }),
    });
    if (res && res.id) {
      return res;
    }
  } catch (apiErr) {
    console.warn('[Centers Proxy] API create center failed, falling back:', apiErr);
  }

  // 2. Fallback de cliente directo
  const { data: inserted, error } = await supabase
    .from('educational_centers')
    .insert([
      {
        name: data.name.trim(),
        type: data.type,
        profile_photo_url: data.photoUrl?.trim() || null,
        created_by: firebaseUid,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error al insertar centro educativo en Supabase:', error);
    throw new Error(error.message || 'No se pudo crear el centro educativo en la base de datos.');
  }

  return inserted as EducationalCenter;
}

/**
 * Recupera todos los centros educativos creados por los usuarios en Supabase.
 */
export async function getEducationalCenters(): Promise<EducationalCenter[]> {
  // 1. Intentar vía Backend Proxy API
  try {
    const res = await apiFetch<EducationalCenter[]>('/api/educational-centers');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (apiErr) {
    console.warn('[Centers Proxy] API get centers failed, falling back:', apiErr);
  }

  // 2. Fallback de cliente directo
  try {
    const { data, error } = await supabase
      .from('educational_centers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'P0001' || error.message?.includes('does not exist')) {
        return [];
      }
      console.warn('Aviso al obtener centros educativos de Supabase:', error.message || error);
      return [];
    }

    return (data as EducationalCenter[]) || [];
  } catch (err) {
    console.warn('Excepción de red al obtener centros educativos:', err);
    return [];
  }
}

/**
 * Elimina un centro educativo de la tabla 'educational_centers' en Supabase.
 */
export async function deleteEducationalCenter(centerId: string): Promise<void> {
  const { error } = await supabase
    .from('educational_centers')
    .delete()
    .eq('id', centerId);

  if (error) {
    console.error('Error al eliminar centro educativo en Supabase:', error);
    throw new Error(error.message || 'No se pudo eliminar el centro educativo.');
  }
}

