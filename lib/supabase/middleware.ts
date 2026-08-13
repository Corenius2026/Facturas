import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 1. Obtener usuario autenticado de forma segura
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    user = null;
  }

  const pathname = request.nextUrl.pathname;

  // 2. Definición de Rutas Públicas
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/registro' ||
    pathname === '/recuperar-password' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/'); // APIs preservadas sin bloqueo durante la Etapa 2

  // 3. Redirección si usuario NO autenticado intenta acceder a ruta privada
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 4. Redirección si usuario YA autenticado intenta acceder a auth pages (excepto reset-password que requiere sesión de recuperación)
  if (user && (pathname === '/login' || pathname === '/registro' || pathname === '/recuperar-password')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
