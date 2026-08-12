'use client';

import React from 'react';
import { Zap, Sparkles, CheckCircle2, Loader2, ShieldCheck, FileCheck, Layers } from 'lucide-react';
import { DuplicateNotice } from '@/types/invoice';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProcessingStatusProps {
  isProcessing: boolean;
  buyerNit: string;
  duplicateNotice: DuplicateNotice | null;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  isProcessing,
  buyerNit,
  duplicateNotice,
}) => {
  return (
    <>
      {/* Animated Processing Stepper Overlay */}
      {isProcessing && (
        <Card className="border-primary/40 bg-card/95 backdrop-blur-md shadow-xl overflow-hidden animate-fade-in mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-spin">
                <Loader2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground">
                  Procesando Factura con Google Gemini AI
                </h3>
                <p className="text-xs text-muted-foreground">
                  Integrando documento con NIT <strong className="text-primary">{buyerNit || 'Empresa'}</strong> para Siigo Nube
                </p>
              </div>
            </div>

            {/* Visual Process Steps */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 text-primary text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1. Imagen Recibida</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 text-primary text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>2. Optimización Canvas</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 text-primary text-[11px] font-bold animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>3. Inferencia Gemini</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-muted-foreground text-[11px] font-semibold">
                <FileCheck className="w-3.5 h-3.5" />
                <span>4. Generación UBL 2.1</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate / Idempotency Notice */}
      {duplicateNotice && duplicateNotice.isDuplicate && (
        <Card className="border-amber-500/30 bg-amber-500/10 shadow-xs mb-6 animate-fade-in">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-extrabold text-amber-900 dark:text-amber-200">
                  {duplicateNotice.type === 'image_hash'
                    ? '⚡ Recuperada de Caché (Misma Fotografía)'
                    : '🔄 Factura Ya Registrada en tu Empresa'}
                </span>
                <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                  Idempotencia
                </Badge>
              </div>
              <p className="text-amber-800/90 dark:text-amber-300/90 font-medium">
                {duplicateNotice.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
