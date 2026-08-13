import { createClient } from '@/lib/supabase/server';
import { User } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'admin' | 'accountant' | 'viewer';

export interface TenantContextResult {
  userId: string | null;
  tenantId: string | null;
  role: UserRole | null;
  user: User | null;
  profile: {
    id: string;
    email: string;
    nombre: string | null;
  } | null;
  tenant: {
    id: string;
    nombre: string;
    nit: string | null;
    slug: string;
    status: 'active' | 'suspended' | 'deleted';
  } | null;
  isAuthenticated: boolean;
  error?: string;
}

/**
 * Resuelve el Tenant activo del usuario autenticado en el servidor de forma estricta y segura.
 * 
 * REGLA CRÍTICA DE SEGURIDAD:
 * NUNCA se determina el tenant utilizando inputs del cliente (buyer_nit, query params, FormData ni headers).
 * La autorización se resuelve exclusivamente a través de:
 * Sesión SSR Autenticada -> auth.users -> tenant_memberships -> tenants
 */
export async function getCurrentTenant(): Promise<TenantContextResult> {
  try {
    const supabase = await createClient();

    // 1. Obtener usuario autenticado verificado por Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        userId: null,
        tenantId: null,
        role: null,
        user: null,
        profile: null,
        tenant: null,
        isAuthenticated: false,
        error: authError?.message || 'No hay sesión de usuario autenticada.',
      };
    }

    // 2. Consultar perfil de usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, nombre')
      .eq('id', user.id)
      .maybeSingle();

    // 3. Consultar las membresías activas del usuario en tenants
    const { data: memberships, error: membershipError } = await supabase
      .from('tenant_memberships')
      .select(`
        id,
        role,
        created_at,
        tenant:tenants (
          id,
          nombre,
          nit,
          slug,
          status,
          deleted_at
        )
      `)
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      // Auto-aprovisionamiento resiliente: Si el usuario no tiene tenant asignado, crearlo como Owner automáticamente
      const userMetaName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Usuario');
      const userName = String(userMetaName).trim();
      const orgName = `Organización de ${userName}`;
      const slug = `org-${user.id.slice(0, 8)}`;

      // 1. Asegurar perfil
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email || '',
        nombre: userName,
      });

      // 2. Crear o recuperar tenant existente
      let { data: newTenant } = await supabase
        .from('tenants')
        .select('id, nombre, nit, slug, status')
        .eq('slug', slug)
        .maybeSingle();

      if (!newTenant && user.email) {
        const emailPrefix = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const { data: matchedTenant } = await supabase
          .from('tenants')
          .select('id, nombre, nit, slug, status')
          .ilike('slug', `org-${emailPrefix}%`)
          .maybeSingle();
        newTenant = matchedTenant;
      }

      if (!newTenant) {
        const { data: createdTenant } = await supabase
          .from('tenants')
          .insert({
            nombre: orgName,
            slug: slug,
            status: 'active',
          })
          .select('id, nombre, nit, slug, status')
          .single();
        newTenant = createdTenant;
      }

      if (newTenant) {
        // 3. Crear membresía Owner
        await supabase.from('tenant_memberships').upsert({
          tenant_id: newTenant.id,
          user_id: user.id,
          role: 'owner',
        }, { onConflict: 'tenant_id,user_id' });

        return {
          userId: user.id,
          tenantId: newTenant.id,
          role: 'owner',
          user,
          profile: { id: user.id, email: user.email || '', nombre: userName },
          tenant: {
            id: newTenant.id,
            nombre: newTenant.nombre,
            nit: newTenant.nit || null,
            slug: newTenant.slug,
            status: newTenant.status,
          },
          isAuthenticated: true,
        };
      }

      return {
        userId: user.id,
        tenantId: null,
        role: null,
        user,
        profile: profile || { id: user.id, email: user.email || '', nombre: null },
        tenant: null,
        isAuthenticated: true,
        error: 'El usuario no tiene organizaciones (tenants) asignadas.',
      };
    }

    // 4. Filtrar tenants activos (no suspendidos ni eliminados)
    const validMemberships = memberships.filter(
      (m: any) => m.tenant && m.tenant.status === 'active' && !m.tenant.deleted_at
    );

    if (validMemberships.length === 0) {
      return {
        userId: user.id,
        tenantId: null,
        role: null,
        user,
        profile: profile || { id: user.id, email: user.email || '', nombre: null },
        tenant: null,
        isAuthenticated: true,
        error: 'Las organizaciones asignadas al usuario están suspendidas o eliminadas.',
      };
    }

    // 5. Priorizar rol: owner -> admin -> accountant -> viewer
    const rolePriority: Record<string, number> = {
      owner: 1,
      admin: 2,
      accountant: 3,
      viewer: 4,
    };

    validMemberships.sort((a: any, b: any) => {
      const pA = rolePriority[a.role] || 99;
      const pB = rolePriority[b.role] || 99;
      return pA - pB;
    });

    const primaryMembership = validMemberships[0] as any;
    const activeTenant = primaryMembership.tenant;

    return {
      userId: user.id,
      tenantId: activeTenant.id,
      role: primaryMembership.role as UserRole,
      user,
      profile: profile || { id: user.id, email: user.email || '', nombre: null },
      tenant: {
        id: activeTenant.id,
        nombre: activeTenant.nombre,
        nit: activeTenant.nit,
        slug: activeTenant.slug,
        status: activeTenant.status,
      },
      isAuthenticated: true,
    };
  } catch (err: any) {
    console.error('Error resolviendo tenant context en servidor:', err);
    return {
      userId: null,
      tenantId: null,
      role: null,
      user: null,
      profile: null,
      tenant: null,
      isAuthenticated: false,
      error: err.message || 'Error interno al resolver contexto de organización.',
    };
  }
}
