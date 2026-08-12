'use client';

import React, { useRef } from 'react';
import { UploadCloud, FileText, Sparkles, Zap } from 'lucide-react';
import { ImageOptimizationStats } from '@/types/invoice';

interface UploadDropzoneProps {
  selectedFile: File | null;
  previewUrl: string;
  isProcessing: boolean;
  optimizationStats: ImageOptimizationStats | null;
  onFileSelect: (file: File) => void;
  onProcessInvoice: () => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  selectedFile,
  previewUrl,
  isProcessing,
  optimizationStats,
  onFileSelect,
  onProcessInvoice,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <section className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 border-b border-[#BDD8E9]/60 pb-3 mb-5">
        <div className="p-2 bg-[#001D39] text-[#7BBDE8] rounded-xl shadow-inner">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#001D39]">Cargar Factura de Compra</h2>
          <p className="text-xs text-[#49769F]">Arrastra o sube una fotografía de la factura física</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dropzone Container */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#BDD8E9] hover:border-[#0A4174] bg-[#EAF2F8]/40 hover:bg-[#EAF2F8]/80 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFileSelect(e.target.files[0]);
              }
            }}
            accept="image/*"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center">
            {previewUrl ? (
              <div className="relative mb-3 max-h-56 overflow-hidden rounded-xl border border-[#BDD8E9] shadow-inner">
                <img
                  src={previewUrl}
                  alt="Vista previa de factura"
                  className="object-contain max-h-56 w-full rounded-xl transition-transform group-hover:scale-105 duration-300"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-[#BDD8E9]/50 group-hover:bg-[#BDD8E9] text-[#0A4174] rounded-2xl flex items-center justify-center mb-3 shadow-inner transition-colors">
                <UploadCloud className="w-8 h-8" />
              </div>
            )}

            <p className="text-sm font-bold text-[#001D39] mb-1">
              {selectedFile ? 'Haz clic para cambiar de factura' : 'Arrastra tu imagen aquí o haz clic para explorar'}
            </p>
            <p className="text-xs text-[#49769F]">Formatos aceptados: JPG, PNG, WebP (Optimización inteligente)</p>

            {selectedFile && (
              <div className="mt-4 inline-flex items-center gap-2 bg-[#001D39] text-[#7BBDE8] px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow">
                <FileText className="w-4 h-4" />
                <span>{selectedFile.name}</span>
              </div>
            )}

            {optimizationStats && optimizationStats.reductionPercentage > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-xl text-[11px] font-bold shadow-sm">
                <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {(optimizationStats.originalSize / 1024).toFixed(0)} KB → {(optimizationStats.optimizedSize / 1024).toFixed(0)} KB (-{optimizationStats.reductionPercentage}%) en {optimizationStats.durationMs}ms
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Botón de Procesar */}
        <div className="pt-2">
          <button
            onClick={onProcessInvoice}
            disabled={!selectedFile || isProcessing}
            className="w-full bg-[#001D39] hover:bg-[#0A4174] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Sparkles className="w-4 h-4 text-[#7BBDE8]" />
            <span>{isProcessing ? 'Procesando Documento...' : 'Procesar Factura para Siigo'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
