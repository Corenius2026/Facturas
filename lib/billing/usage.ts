import { createClient } from '@/lib/supabase/server';
import { getCurrentTenant } from '@/lib/tenant-context';

export type PlanSlug = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanDetails {
  slug: PlanSlug;
  name: string;
  monthlyInvoiceLimit: number;
  priceCop: number;
  allow2Fa: boolean;
  allowBatchExport: boolean;
}

export interface TenantUsageResult {
  success: boolean;
  allowed: boolean;
  tenantId: string;
  plan: PlanSlug;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  code?: string;
  error?: string;
  message?: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  tenantId: string;
  plan: PlanSlug;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  code?: string;
  error?: string;
}

/**
 * Consulta el consumo actual y límites del plan para el tenant autenticado.
 * NUNCA confía en parámetros enviados desde el cliente.
 */
export async function getCurrentUsage(explicitTenantId?: string): Promise<TenantUsageResult> {
  try {
    let tenantId = explicitTenantId;

    if (!tenantId) {
      const authContext = await getCurrentTenant();
      if (!authContext.isAuthenticated || !authContext.tenantId) {
        return {
          success: false,
          allowed: false,
          tenantId: '',
          plan: 'free',
          planName: 'Plan Free',
          used: 0,
          limit: 30,
          remaining: 0,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          status: 'inactive',
          code: 'UNAUTHENTICATED',
          error: 'No hay sesión de organización activa.',
        };
      }
      tenantId = authContext.tenantId;
    }

    const supabase = await createClient();

    // 1. Intentar llamar a la función RPC segura de PostgreSQL
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_tenant_usage', {
      p_tenant_id: tenantId,
    });

    if (!rpcError && rpcData && typeof rpcData === 'object') {
      return {
        success: rpcData.success ?? true,
        allowed: rpcData.allowed ?? true,
        tenantId: rpcData.tenant_id ?? tenantId,
        plan: (rpcData.plan as PlanSlug) || 'free',
        planName: rpcData.plan_name || 'Plan Free',
        used: Number(rpcData.used) || 0,
        limit: Number(rpcData.limit) || 30,
        remaining: Number(rpcData.remaining) || 0,
        periodStart: rpcData.period_start || new Date().toISOString(),
        periodEnd: rpcData.period_end || new Date().toISOString(),
        status: rpcData.status || 'active',
        code: rpcData.code,
        message: rpcData.message,
      };
    }

    // 2. Fallback resiliente mediante consulta estructurada si el RPC aún no está compilado en la BD
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const plan = subscription?.plan || { slug: 'free', name: 'Plan Free', monthly_invoice_limit: 30 };
    const monthlyLimit = plan.monthly_invoice_limit || 30;

    const { data: usage } = await supabase
      .from('usage_periods')
      .select('invoices_processed')
      .eq('tenant_id', tenantId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .maybeSingle();

    const used = usage?.invoices_processed || subscription?.current_period_invoices || 0;
    const remaining = Math.max(0, monthlyLimit - used);
    const allowed = used < monthlyLimit && (subscription?.status || 'active') === 'active';

    return {
      success: true,
      allowed,
      tenantId,
      plan: plan.slug as PlanSlug,
      planName: plan.name,
      used,
      limit: monthlyLimit,
      remaining,
      periodStart,
      periodEnd,
      status: subscription?.status || 'active',
    };
  } catch (err: any) {
    console.error('Error al obtener consumo de tenant:', err);
    return {
      success: false,
      allowed: false,
      tenantId: explicitTenantId || '',
      plan: 'free',
      planName: 'Plan Free',
      used: 0,
      limit: 30,
      remaining: 0,
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      status: 'error',
      error: err.message || 'Error consultando métricas de cuota.',
    };
  }
}

/**
 * Valida si el tenant tiene cuota disponible ANTES de invocar el motor de IA (Gemini).
 */
export async function checkInvoiceQuota(explicitTenantId?: string): Promise<QuotaCheckResult> {
  const usage = await getCurrentUsage(explicitTenantId);

  if (!usage.allowed) {
    return {
      allowed: false,
      tenantId: usage.tenantId,
      plan: usage.plan,
      planName: usage.planName,
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
      code: usage.code || 'QUOTA_EXCEEDED',
      error: usage.message || `Has alcanzado el límite mensual de facturas de tu ${usage.planName} (${usage.limit} facturas).`,
    };
  }

  return {
    allowed: true,
    tenantId: usage.tenantId,
    plan: usage.plan,
    planName: usage.planName,
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
  };
}

/**
 * Incrementa ATÓMICAMENTE el consumo mensual en 1 unidad cuando una factura
 * ha sido procesada y guardada exitosamente en la base de datos.
 */
export async function consumeInvoiceQuota(tenantId: string): Promise<TenantUsageResult> {
  try {
    const supabase = await createClient();

    // 1. Ejecutar RPC atómico con UPDATE condicional WHERE used < limit
    const { data: rpcData, error: rpcError } = await supabase.rpc('consume_invoice_quota', {
      p_tenant_id: tenantId,
    });

    if (!rpcError && rpcData && typeof rpcData === 'object') {
      return {
        success: rpcData.success ?? true,
        allowed: rpcData.allowed ?? true,
        tenantId: rpcData.tenant_id ?? tenantId,
        plan: (rpcData.plan as PlanSlug) || 'free',
        planName: rpcData.plan_name || 'Plan Free',
        used: Number(rpcData.used) || 0,
        limit: Number(rpcData.limit) || 30,
        remaining: Number(rpcData.remaining) || 0,
        periodStart: rpcData.period_start || new Date().toISOString(),
        periodEnd: rpcData.period_end || new Date().toISOString(),
        status: rpcData.status || 'active',
        code: rpcData.code,
        message: rpcData.message,
      };
    }

    // 2. Fallback resiliente
    const current = await getCurrentUsage(tenantId);
    if (!current.allowed) {
      return {
        ...current,
        success: false,
        allowed: false,
        code: 'QUOTA_EXCEEDED',
        message: `Has alcanzado el límite de tu ${current.planName}.`,
      };
    }

    const newUsed = current.used + 1;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    await supabase
      .from('usage_periods')
      .upsert({
        tenant_id: tenantId,
        period_start: periodStart,
        period_end: periodEnd,
        invoices_processed: newUsed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,period_start,period_end' });

    await supabase
      .from('subscriptions')
      .update({
        current_period_invoices: newUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return {
      ...current,
      used: newUsed,
      remaining: Math.max(0, current.limit - newUsed),
      allowed: newUsed < current.limit,
    };
  } catch (err: any) {
    console.error('Error al consumir cuota de factura:', err);
    return {
      success: false,
      allowed: false,
      tenantId,
      plan: 'free',
      planName: 'Plan Free',
      used: 0,
      limit: 30,
      remaining: 0,
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      status: 'error',
      error: err.message || 'Error consumiendo cuota.',
    };
  }
}
