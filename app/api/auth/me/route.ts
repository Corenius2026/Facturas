import { NextResponse } from 'next/server';
import { getCurrentTenant } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getCurrentTenant();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({
      success: true,
      isAuthenticated: false,
      user: null,
      tenant: null,
      role: null,
    });
  }

  return NextResponse.json({
    success: true,
    isAuthenticated: true,
    user: {
      id: context.userId,
      email: context.profile?.email || context.user?.email,
      nombre: context.profile?.nombre,
    },
    tenant: context.tenant,
    role: context.role,
  });
}
