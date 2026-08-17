import { supabase } from './supabase';

export interface EducationalCenter {
  id: string;
  name: string;
  type: 'colegio' | 'instituto' | 'universidad';
  profile_photo_url: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateCenterData {
  name: string;
  type: 'colegio' | 'instituto' | 'universidad';
  photoUrl?: string;
}

/**
 * Inserta un nuevo centro educativo en la tabla 'educational_centers' de Supabase.
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
  const { data, error } = await supabase
    .from('educational_centers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // Si la tabla no existe aún, retornamos vacío de manera amigable
    if (error.code === 'P0001' || error.message?.includes('does not exist')) {
      console.warn('La tabla educational_centers no existe aún en Supabase.');
      return [];
    }
    console.error('Error al obtener centros educativos:', error);
    throw error;
  }

  return data as EducationalCenter[] || [];
}
