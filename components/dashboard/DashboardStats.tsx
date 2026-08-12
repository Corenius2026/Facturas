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
    <div className="flex flex-col sm:flex-row gap-8 sm:gap-16 pb-8 border-b border-border">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground mb-1">Total Compras</span>
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {formatMonetaryDisplay(totalMonto)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">{activeBuyerName || 'Empresa activa'}</span>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground mb-1">Facturas Procesadas</span>
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {totalCount}
        </span>
        <span className="text-xs text-muted-foreground mt-1">{completedCount} integradas en Siigo</span>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground mb-1">Estado</span>
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {completedCount} <span className="text-lg font-normal text-muted-foreground">OK</span>
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          {revisionCount > 0 ? `${revisionCount} requieren revisión` : '100% verificadas'}
        </span>
      </div>
    </div>
  );
};

