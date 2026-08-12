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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-8 border-b border-border">
      {/* Total Compras */}
      <div className="flex flex-col p-5 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50">
        <span className="text-sm font-semibold text-sky-600 dark:text-sky-400 mb-1">Total Compras</span>
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          {formatMonetaryDisplay(totalMonto)}
        </span>
        <span className="text-xs text-muted-foreground mt-2">{activeBuyerName || 'Empresa activa'}</span>
      </div>

      {/* Facturas Procesadas */}
      <div className="flex flex-col p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Facturas Procesadas</span>
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          {totalCount}
        </span>
        <span className="text-xs text-muted-foreground mt-2">{completedCount} integradas en Siigo</span>
      </div>
    </div>
  );
};

