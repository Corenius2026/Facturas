import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  if (errorParam) {
    console.error('Error reportado por el proveedor OAuth en /auth/callback:', errorParam, errorDescription);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('Error intercambiando código de autenticación en /auth/callback:', error.message);
  }

  // Redirigir a login con mensaje de error si el código falló o expiró
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
