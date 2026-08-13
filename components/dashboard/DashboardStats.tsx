'use client';

import React from 'react';
import { SupabaseInvoice } from '@/types/invoice';
import { formatMonetaryDisplay, limpiarValorNumerico } from '@/lib/siigo-xml';

interface DashboardStatsProps {
  history: SupabaseInvoice[];
  activeBuyerName: string;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ history, activeBuyerName }) => {
  // 1. Total Facturas
  const totalCount = history.length;

  // 2. Suma Total COP
  const totalMonto = history.reduce((acc, curr) => {
    const val = limpiarValorNumerico(curr.total);
    return acc + val;
  }, 0);

  // 3. Facturas en revisión / completadas
  const revisionCount = history.filter((item) => item.estado === 'requiere_revision' || !item.numero_factura).length;
  const completedCount = history.filter((item) => item.estado === 'completada' || item.estado === 'procesada').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-border">
      {/* Total Compras */}
      <div className="flex flex-col p-6 rounded-2xl bg-card border border-border">
        <span className="text-xs font-bold text-[#E09145] uppercase tracking-wider mb-1.5">
          Total Compras
        </span>
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono">
          {formatMonetaryDisplay(totalMonto)}
        </span>
        <span className="text-xs text-muted-foreground mt-2 font-medium">
          {activeBuyerName || 'Empresa activa'}
        </span>
      </div>

      {/* Facturas Procesadas */}
      <div className="flex flex-col p-6 rounded-2xl bg-card border border-border">
        <span className="text-xs font-bold text-[#E09145] uppercase tracking-wider mb-1.5">
          Facturas Procesadas
        </span>
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono">
          {totalCount}
        </span>
        <span className="text-xs text-muted-foreground mt-2 font-medium">
          Documentos registrados
        </span>
      </div>
    </div>
  );
};

