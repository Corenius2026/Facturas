'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { DuplicateNotice } from '@/types/invoice';

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
      {/* Loader Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-[#001D39]/85 backdrop-blur-sm border border-[#49769F] rounded-2xl z-40 flex flex-col items-center justify-center gap-4 text-white shadow-2xl">
          <div className="w-14 h-14 border-4 border-[#BDD8E9]/30 border-t-[#7BBDE8] rounded-full animate-spin flex items-center justify-center">
          </div>
          <h3 className="font-bold text-base">Extrayendo Datos e Integrando con NIT {buyerNit || 'Empresa'}...</h3>
          <p className="text-xs text-[#BDD8E9]">Generando automáticamente XML UBL 2.1 y paquete .ZIP para Siigo Nube...</p>
        </div>
      )}

      {/* Alerta Visual de Idempotencia / Factura Duplicada */}
      {duplicateNotice && duplicateNotice.isDuplicate && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm mb-4">
          <Zap className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs font-semibold">
            <span className="font-bold">
              {duplicateNotice.type === 'image_hash'
                ? '⚡ Recuperada de Caché (Misma Imagen)'
                : '🔄 Factura Ya Registrada en tu Empresa'}:
            </span>{' '}
            {duplicateNotice.message}
          </div>
        </div>
      )}
    </>
  );
};
