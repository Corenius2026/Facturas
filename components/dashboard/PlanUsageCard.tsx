'use client';

import React, { useEffect, useState } from 'react';
import { Zap, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface UsageInfo {
  plan: string;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  allowed: boolean;
}

interface PlanUsageCardProps {
  buyerNit?: string;
  buyerName?: string;
}

export const PlanUsageCard: React.FC<PlanUsageCardProps> = ({ buyerNit, buyerName }) => {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUsage = () => {
    const url = buyerNit ? `/api/usage?buyer_nit=${encodeURIComponent(buyerNit)}` : '/api/usage';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.usage) {
          setUsage(data.usage);
        }
      })
      .catch((err) => console.warn('Error cargando métricas de cuota:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsage();
    // Re-verificar cada 30 segundos o al cambiar de empresa
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [buyerNit]);

  if (loading || !usage) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-muted rounded"></div>
          <div className="h-6 w-40 bg-muted rounded"></div>
        </div>
        <div className="h-8 w-24 bg-muted rounded-xl"></div>
      </div>
    );
  }

  const percentUsed = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const isNearLimit = percentUsed >= 85 && percentUsed < 100;
  const isAtLimit = percentUsed >= 100 || !usage.allowed;

  let progressColor = 'bg-[#E09145]';
  if (isAtLimit) {
    progressColor = 'bg-destructive';
  } else if (isNearLimit) {
    progressColor = 'bg-amber-500';
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Plan Header */}
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            isAtLimit 
              ? 'bg-destructive/15 text-destructive border border-destructive/30' 
              : 'bg-[#E09145]/15 text-[#E09145] border border-[#E09145]/30'
          }`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Plan de {buyerName || (buyerNit ? `NIT ${buyerNit}` : 'la Empresa')}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E09145]/15 text-[#E09145] border border-[#E09145]/30">
                {usage.planName || usage.plan.toUpperCase()}
              </span>
            </div>
            <h4 className="text-base font-bold text-foreground mt-0.5">
              {usage.used} <span className="text-xs font-medium text-muted-foreground">/ {usage.limit} facturas este mes</span>
            </h4>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {isAtLimit ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-bold">
              <ShieldAlert className="w-4 h-4" />
              <span>Límite Alcanzado</span>
            </div>
          ) : isNearLimit ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>{usage.remaining} restantes</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{usage.remaining} facturas disponibles</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 space-y-1.5">
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
          <span>{percentUsed}% consumido</span>
          <span>{usage.remaining} facturas disponibles para este ciclo</span>
        </div>
      </div>

      {/* Warning message if close or at limit */}
      {isAtLimit && (
        <div className="mt-3.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Has llegado al límite de facturas procesadas de tu plan. No se procesarán nuevas facturas hasta el próximo ciclo o actualización de plan.</span>
        </div>
      )}
    </div>
  );
};
