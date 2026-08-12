'use client';

import React from 'react';
import { SupabaseInvoice } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';

interface DashboardStatsProps {
  history: SupabaseInvoice[];
  activeBuyerName: string;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ history, activeBuyerName }) => {
  // 1. Total Facturas
  const totalCount = history.length;

  // 2. Suma Total COP
  const totalMonto = history.reduce((acc, curr) => {
    const val = typeof curr.total === 'number' ? curr.total : parseFloat(String(curr.total || '0').replace(/[^0-9.-]+/g, ''));
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // 3. Facturas en revisión / completadas
  const revisionCount = history.filter((item) => item.estado === 'requiere_revision' || !item.numero_factura).length;
  const completedCount = history.filter((item) => item.estado === 'completada' || item.estado === 'procesada').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-8 border-b border-border">
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

      {/* Estado */}
      <div className="flex flex-col p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Estado de Integración</span>
        <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground flex items-baseline gap-2">
          {completedCount} <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">OK</span>
        </span>
        <span className="text-xs text-muted-foreground mt-2">
          {revisionCount > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">{revisionCount} requieren revisión</span>
          ) : (
            '100% verificadas'
          )}
        </span>
      </div>
    </div>
  );
};

