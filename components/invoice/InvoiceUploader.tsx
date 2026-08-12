'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Sparkles, Zap, Image as ImageIcon, X } from 'lucide-react';
import { ImageOptimizationStats } from '@/types/invoice';
import { Button } from '@/components/ui/button';

interface InvoiceUploaderProps {
  selectedFile: File | null;
  previewUrl: string;
  isProcessing: boolean;
  optimizationStats: ImageOptimizationStats | null;
  onFileSelect: (file: File) => void;
  onClearFile: () => void;
  onProcessInvoice: () => void;
}

export const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({
  selectedFile,
  previewUrl,
  isProcessing,
  optimizationStats,
  onFileSelect,
  onClearFile,
  onProcessInvoice,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Analizar Factura</h2>
        <p className="text-sm text-muted-foreground mt-1">Sube una imagen o captura térmica para extraer los datos contables automáticamente.</p>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-border/50 hover:border-blue-400/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/10'
        }`}
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

        <div className="flex flex-col items-center justify-center min-h-[160px]">
          {previewUrl ? (
            <div className="relative mb-4 w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border shadow-sm group">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="w-full object-contain max-h-[300px]"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFile();
                }}
                className="absolute top-2 right-2 p-2 rounded-md bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-foreground opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                title="Quitar archivo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <UploadCloud className="w-8 h-8" />
            </div>
          )}

          <p className="text-sm font-medium text-foreground">
            {selectedFile ? selectedFile.name : 'Haz clic para seleccionar o arrastra el archivo aquí'}
          </p>
          {!selectedFile && (
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, WebP (máx. 10MB)
            </p>
          )}

          {optimizationStats && optimizationStats.reductionPercentage > 0 && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full font-medium">
              <Zap className="w-3 h-3" />
              <span>Optimizada {optimizationStats.reductionPercentage}% antes de subir</span>
            </div>
          )}
        </div>
      </div>

      {/* Process Button */}
      <Button
        onClick={onProcessInvoice}
        disabled={!selectedFile || isProcessing}
        className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all border-0 gap-2"
        size="lg"
      >
        <Sparkles className="w-5 h-5" />
        {isProcessing ? 'Procesando con IA...' : 'Analizar Factura'}
      </Button>
    </div>
  );
};


