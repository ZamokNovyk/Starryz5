'use client';

import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  HardDrive,
  FileCheck2,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { 
  validateAvatarFile, 
  compressAvatarToTarget, 
  CompressionResult,
  MAX_UPLOAD_SIZE_BYTES
} from '@/src/lib/imageCompressor';
import { uploadAvatarToBackblaze, syncUserAvatarProfile } from '@/src/lib/backblaze';

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentPhotoUrl?: string | null;
  onAvatarUpdated: (newPhotoUrl: string) => void;
}

export default function AvatarUploadModal({
  isOpen,
  onClose,
  userId,
  currentPhotoUrl,
  onAvatarUpdated
}: AvatarUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Validar límite de 5 MB y tipo
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Archivo no válido');
      return;
    }

    setSelectedFile(file);
    setCompressing(true);

    try {
      // 2. Comprimir al objetivo 90 KB - 100 KB
      const result = await compressAvatarToTarget(file);
      setCompressionResult(result);
    } catch (err: any) {
      console.error('Error al comprimir:', err);
      setErrorMsg(err.message || 'Error al procesar y comprimir la imagen');
      setSelectedFile(null);
      setCompressionResult(null);
    } finally {
      setCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (compressing || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleUpload = async () => {
    if (!compressionResult || !userId) return;

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Paso 1: Subida a Backblaze B2
      setUploadProgressMsg('Subiendo foto optimizada a Backblaze B2...');
      const uploadRes = await uploadAvatarToBackblaze(userId, compressionResult);

      // Paso 2: Sincronizar en Supabase y Firebase Auth
      setUploadProgressMsg('Actualizando foto de perfil en la base de datos...');
      await syncUserAvatarProfile(userId, uploadRes.publicUrl);

      setSuccessMsg('¡Foto de perfil actualizada con éxito en Backblaze B2!');
      onAvatarUpdated(uploadRes.publicUrl);

      // Cerrar modal automáticamente tras 1.5 segundos
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Error durante la subida:', err);
      setErrorMsg(err.message || 'Ocurrió un error al subir la foto a Backblaze B2');
    } finally {
      setUploading(false);
      setUploadProgressMsg('');
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setCompressionResult(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div 
        className="w-full max-w-lg bg-[#0e0e0e] border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Encabezado */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#eab308]/15 border border-[#eab308]/30 flex items-center justify-center text-[#eab308]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                Foto de Perfil
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 lowercase">
                  b2 cloud storage
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Almacenamiento en Backblaze B2 • Máx 5 MB (comprimido a 90 - 100 KB)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="py-5 overflow-y-auto space-y-5 relative z-10">
          
          {/* Mensajes de Estado */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Estado 1: No hay imagen seleccionada (Área Drag & Drop) */}
          {!selectedFile && !compressionResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-[#eab308] bg-zinc-900/40 hover:bg-zinc-900/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-zinc-800 group-hover:bg-[#eab308]/20 flex items-center justify-center text-zinc-400 group-hover:text-[#eab308] transition-colors shadow-inner">
                <Upload className="w-7 h-7 group-hover:scale-110 transition-transform" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white group-hover:text-[#eab308] transition-colors">
                  Haz clic o arrastra tu foto aquí
                </p>
                <p className="text-xs text-zinc-400">
                  Formatos admitidos: JPG, PNG o WebP
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Límite: 5.0 MB
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-600/30">
                  Salida: 90 - 100 KB
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />
            </div>
          )}

          {/* Estado de Carga / Compresión en Proceso */}
          {compressing && (
            <div className="py-10 flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-9 h-9 text-[#eab308] animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Optimizando y ajustando imagen...</p>
                <p className="text-xs text-zinc-400">
                  Calibrando peso al rango de 90 KB – 100 KB con calidad WebP HD
                </p>
              </div>
            </div>
          )}

          {/* Estado 2: Imagen Procesada y Lista para Subir */}
          {compressionResult && !compressing && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              
              {/* Comparador Visual y Vista Previa */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div className="relative flex-shrink-0">
                  <img
                    src={compressionResult.base64}
                    alt="Vista previa avatar"
                    className="w-24 h-24 sm:w-28 sm:sm:h-28 rounded-full object-cover ring-4 ring-[#eab308] shadow-[0_0_25px_rgba(234,179,8,0.3)]"
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-black shadow-md">
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Peso Original:</span>
                    <span className="font-mono text-zinc-300 font-bold">
                      {(compressionResult.originalSize / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Peso Comprimido:</span>
                    <span className="font-mono text-emerald-400 font-black text-sm flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {(compressionResult.compressedSize / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Ahorro de Datos:</span>
                    <span className="font-mono text-[#eab308] font-bold">
                      -{compressionResult.savingsPercent}%
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Resolución: {compressionResult.width}×{compressionResult.height}px</span>
                    <span className="uppercase font-mono text-blue-400 font-semibold">WebP Ultra HD</span>
                  </div>
                </div>
              </div>

              {/* Indicador de Rango Cumplido */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  Rango objetivo alcanzado:
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {compressionResult.compressedSize <= 102400 && compressionResult.compressedSize >= 92160
                    ? '90 KB - 100 KB (Óptimo)'
                    : `${(compressionResult.compressedSize / 1024).toFixed(1)} KB (≤ 100 KB)`}
                </span>
              </div>

              {/* Botón para cambiar foto seleccionada */}
              <button
                type="button"
                onClick={resetSelection}
                disabled={uploading}
                className="w-full py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Elegir otra imagen
              </button>
            </div>
          )}

        </div>

        {/* Pie del Modal con Botones */}
        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-3 relative z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          {compressionResult && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || Boolean(successMsg)}
              className="px-5 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(234,179,8,0.35)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{uploadProgressMsg || 'Subiendo a Backblaze B2...'}</span>
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-black" />
                  <span>Guardar en Backblaze B2</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
