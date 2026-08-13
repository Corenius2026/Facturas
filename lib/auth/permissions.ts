export type UserRole = 'owner' | 'admin' | 'accountant' | 'viewer';

export type AppPermission =
  | 'tenant.manage'      // Administrar organización, configuración general y miembros
  | 'users.manage'       // Invitar usuarios y gestionar miembros
  | 'roles.manage'       // Modificar roles de miembros (solo owner)
  | 'settings.view'      // Ver configuraciones de la organización
  | 'company.manage'     // Crear, actualizar y eliminar empresas/emisores en el sistema
  | 'invoice.process'    // Cargar y procesar facturas mediante IA (Gemini)
  | 'invoice.view'       // Consultar historial y detalles de facturas
  | 'invoice.delete'     // Eliminar facturas del historial
  | 'invoice.export';    // Descargar XML UBL 2.1, CSV y ZIP para Siigo

/**
 * Matriz estricta de Roles y Permisos (RBAC) para FacturaAI B2B SaaS.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly AppPermission[]> = {
  owner: [
    'tenant.manage',
    'users.manage',
    'roles.manage',
    'settings.view',
    'company.manage',
    'invoice.process',
    'invoice.view',
    'invoice.delete',
    'invoice.export',
  ],
  admin: [
    'users.manage',
    'settings.view',
    'company.manage',
    'invoice.process',
    'invoice.view',
    'invoice.delete',
    'invoice.export',
  ],
  accountant: [
    'invoice.process',
    'invoice.view',
    'invoice.export',
  ],
  viewer: [
    'invoice.view',
  ],
} as const;

/**
 * Verifica si un rol específico posee un permiso determinado.
 */
export function hasPermission(role: UserRole | null | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Verifica si un rol específico posee al menos uno de los permisos requeridos.
 */
export function hasAnyPermission(role: UserRole | null | undefined, permissions: AppPermission[]): boolean {
  if (!role || !permissions || permissions.length === 0) return false;
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Verifica si un rol específico posee todos los permisos requeridos.
 */
export function hasAllPermissions(role: UserRole | null | undefined, permissions: AppPermission[]): boolean {
  if (!role || !permissions || permissions.length === 0) return false;
  return permissions.every((p) => hasPermission(role, p));
}
