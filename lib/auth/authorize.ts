import { NextResponse } from 'next/server';
import { getCurrentTenant, TenantContextResult } from '@/lib/tenant-context';
import { AppPermission, hasPermission, UserRole } from './permissions';

export interface AuthorizedContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  user: TenantContextResult['user'];
  profile: TenantContextResult['profile'];
  tenant: NonNullable<TenantContextResult['tenant']>;
}

export type AuthorizationResult =
  | { success: true; context: AuthorizedContext; response?: never }
  | { success: false; response: NextResponse; context?: never };

/**
 * Valida que exista una sesión autenticada con un tenant activo y que el rol del usuario
 * posea el permiso requerido.
 * 
 * REGLA DE SEGURIDAD ESTRICTA:
 * NUNCA se aceptan permisos, roles o identificadores de tenant enviados por el frontend.
 * Toda la autorización se deriva exclusivamente de la sesión SSR del servidor.
 */
export async function requirePermission(permission: AppPermission): Promise<AuthorizationResult> {
  const tenantContext = await getCurrentTenant();

  // 1. Validar autenticación
  if (!tenantContext.isAuthenticated || !tenantContext.userId) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'No autenticado. Por favor inicia sesión.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }

  // 2. Validar pertenencia a un tenant activo
  if (!tenantContext.tenantId || !tenantContext.tenant || !tenantContext.role) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'No tienes una organización activa asignada.',
          code: 'FORBIDDEN_NO_TENANT',
        },
        { status: 403 }
      ),
    };
  }

  // 3. Validar permiso según el rol
  if (!hasPermission(tenantContext.role, permission)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Acceso denegado: tu rol (${tenantContext.role}) no tiene el permiso '${permission}'.`,
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    context: {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      role: tenantContext.role,
      user: tenantContext.user,
      profile: tenantContext.profile,
      tenant: tenantContext.tenant,
    },
  };
}

/**
 * Valida que el usuario pertenezca a uno de los roles permitidos.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthorizationResult> {
  const tenantContext = await getCurrentTenant();

  if (!tenantContext.isAuthenticated || !tenantContext.userId) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'No autenticado. Por favor inicia sesión.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }

  if (!tenantContext.tenantId || !tenantContext.tenant || !tenantContext.role) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'No tienes una organización activa asignada.',
          code: 'FORBIDDEN_NO_TENANT',
        },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(tenantContext.role)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Acceso denegado: se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`,
          code: 'FORBIDDEN_INVALID_ROLE',
        },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    context: {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      role: tenantContext.role,
      user: tenantContext.user,
      profile: tenantContext.profile,
      tenant: tenantContext.tenant,
    },
  };
}
