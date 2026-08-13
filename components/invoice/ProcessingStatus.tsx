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
        <Card className="border-border bg-card shadow-sm overflow-hidden animate-fade-in mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#E09145] text-[#17181D] flex items-center justify-center animate-spin">
                <Loader2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground">
                  Procesando Factura con Inteligencia Artificial
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Integrando documento con NIT <strong className="text-[#E09145] font-mono">{buyerNit || 'Empresa'}</strong>
                </p>
              </div>
            </div>

            {/* Visual Process Steps */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-foreground text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E09145]" />
                <span>1. Imagen Recibida</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-foreground text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E09145]" />
                <span>2. Optimización</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#E09145]/10 text-[#E09145] text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#E09145]" />
                <span>3. Inferencia IA</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-muted-foreground text-[11px] font-semibold">
                <FileCheck className="w-3.5 h-3.5" />
                <span>4. Generación XML</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate / Idempotency Notice */}
      {duplicateNotice && duplicateNotice.isDuplicate && (
        <div className="flex items-center gap-3 p-3.5 mb-6 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium m-0">
            {duplicateNotice.message}
          </p>
        </div>
      )}
    </>
  );
};
