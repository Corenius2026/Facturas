import { NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/tenant-context';
import { getCurrentUsage } from '@/lib/billing/usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authContext = await getCurrentTenant();

    if (!authContext.isAuthenticated || !authContext.tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No autenticado o sin organización asignada.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const usage = await getCurrentUsage(authContext.tenantId);

    return NextResponse.json({
      success: true,
      usage: {
        tenantId: usage.tenantId,
        plan: usage.plan,
        planName: usage.planName,
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
        status: usage.status,
        allowed: usage.allowed,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener métricas de consumo de la organización.',
      },
      { status: 500 }
    );
  }
}
