'use client';

import React from 'react';
import { Receipt, DollarSign, Calendar, AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { SupabaseInvoice } from '@/types/invoice';
import { Card, CardContent } from '@/components/ui/card';
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

  // 3. Facturas del mes actual
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthCount = history.filter(
    (item) => (item.fecha && item.fecha.startsWith(currentMonth)) || (item.creado_en && item.creado_en.startsWith(currentMonth))
  ).length;

  // 4. Facturas en revisión / completadas
  const revisionCount = history.filter((item) => item.estado === 'requiere_revision' || !item.numero_factura).length;
  const completedCount = history.filter((item) => item.estado === 'completada' || item.estado === 'procesada').length;

  const stats = [
    {
      title: 'Facturas Procesadas',
      value: totalCount.toString(),
      subtext: `${completedCount} integradas en Siigo`,
      icon: Receipt,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total Compras Acumulado',
      value: formatMonetaryDisplay(totalMonto),
      subtext: `Para ${activeBuyerName || 'esta empresa'}`,
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Actividad de Este Mes',
      value: `${monthCount} facturas`,
      subtext: `Mes en curso (${new Date().toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })})`,
      icon: Calendar,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-500/10',
    },
    {
      title: 'Estado de Documentos',
      value: `${completedCount} OK`,
      subtext: revisionCount > 0 ? `${revisionCount} requieren revisión` : '100% verificadas',
      icon: revisionCount > 0 ? AlertCircle : CheckCircle2,
      color: revisionCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
      bgColor: revisionCount > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card key={idx} className="hover:border-primary/40 transition-all duration-200 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </span>
                <div className={`p-2 rounded-xl ${stat.bgColor} ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-xl font-black text-foreground tracking-tight">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{stat.subtext}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
