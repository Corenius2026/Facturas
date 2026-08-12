'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Sparkles, Zap, Image as ImageIcon, X, ArrowUpRight } from 'lucide-react';
import { ImageOptimizationStats } from '@/types/invoice';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Subir Factura de Compra</CardTitle>
              <CardDescription>Formatos soportados: JPG, PNG, WebP o fotos de tickets térmicos</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            OCR Multimodal
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40'
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

          <div className="flex flex-col items-center justify-center">
            {previewUrl ? (
              <div className="relative mb-3 max-h-56 overflow-hidden rounded-xl border border-border bg-card shadow-xs group-hover:shadow-md transition-all">
                <img
                  src={previewUrl}
                  alt="Vista previa de factura"
                  className="object-contain max-h-56 w-full rounded-xl"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearFile();
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/90 hover:bg-destructive hover:text-destructive-foreground text-foreground shadow-sm transition-all"
                  title="Quitar archivo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}

            <p className="text-xs font-bold text-foreground mb-1">
              {selectedFile ? 'Haz clic para cambiar de factura' : 'Arrastra una fotografía aquí o haz clic para explorar'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              La imagen se optimiza en el navegador antes de enviarla a Gemini AI
            </p>

            {selectedFile && (
              <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-xl text-xs font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
            )}

            {optimizationStats && optimizationStats.reductionPercentage > 0 && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-xl text-[11px] font-bold">
                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {(optimizationStats.originalSize / 1024).toFixed(0)} KB → {(optimizationStats.optimizedSize / 1024).toFixed(0)} KB (-{optimizationStats.reductionPercentage}%) en {optimizationStats.durationMs}ms
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Process Button */}
        <Button
          onClick={onProcessInvoice}
          disabled={!selectedFile || isProcessing}
          size="lg"
          className="w-full gap-2 text-xs font-bold shadow-md shadow-primary/20 h-11"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isProcessing ? 'Procesando Documento...' : 'Procesar Factura para Siigo'}</span>
        </Button>
      </CardContent>
    </Card>
  );
};
