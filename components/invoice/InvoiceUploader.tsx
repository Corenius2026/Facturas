'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Sparkles, Zap, Image as ImageIcon, X } from 'lucide-react';
import { ImageOptimizationStats } from '@/types/invoice';
import { Button } from '@/components/ui/button';

interface InvoiceUploaderProps {
  selectedFile: File | null;
  previewUrl: string;
  isProcessing: boolean;
  hasResults?: boolean;
  optimizationStats: ImageOptimizationStats | null;
  onFileSelect: (file: File) => void;
  onClearFile: () => void;
  onProcessInvoice: () => void;
}

export const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({
  selectedFile,
  previewUrl,
  isProcessing,
  hasResults = false,
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
    <div className="space-y-4">
      {/* Drag & Drop Area / Document Viewer */}
      {previewUrl ? (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-[#E09145] uppercase tracking-wider">
              Documento Cargado
            </span>
            <button
              type="button"
              onClick={onClearFile}
              className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cambiar imagen</span>
            </button>
          </div>

          <div className="p-4 flex flex-col items-center justify-center bg-muted/20">
            <div className="relative w-full max-w-xs mx-auto rounded-lg overflow-hidden border border-border bg-background">
              <img
                src={previewUrl}
                alt="Vista previa factura"
                className="w-full object-contain max-h-[260px] mx-auto"
              />
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-2 truncate max-w-[200px]">
              {selectedFile?.name}
            </p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-[#E09145] bg-[#E09145]/10'
              : 'border-border hover:border-[#E09145]/60 hover:bg-muted/30'
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
            <div className="w-12 h-12 rounded-2xl bg-[#292C35] text-[#E09145] flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>

            <p className="text-sm font-bold text-foreground">
              Haz clic para seleccionar o arrastra la factura aquí
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              JPG, PNG, WebP (máx. 10MB)
            </p>
          </div>
        </div>
      )}

      {/* Process Button (Only shown when a file is selected and not yet processed) */}
      {selectedFile && !hasResults && (
        <Button
          onClick={onProcessInvoice}
          disabled={isProcessing}
          className="w-full h-11 text-sm font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90 transition-colors border-0 gap-2"
        >
          <Sparkles className="w-4 h-4 text-[#17181D]" />
          <span>{isProcessing ? 'Procesando factura...' : 'Analizar Factura'}</span>
        </Button>
      )}
    </div>
  );
};


