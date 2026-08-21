import { supabase } from './supabase';

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
 * Inserta un nuevo centro educativo en la tabla 'educational_centers' de Supabase (0 MAU en Supabase Auth).
 */
export async function createEducationalCenter(data: CreateCenterData, firebaseUid: string): Promise<EducationalCenter> {
  if (!data.name || !data.name.trim()) {
    throw new Error('El nombre del centro educativo es requerido.');
  }

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

