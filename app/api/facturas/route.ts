import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      connected: false,
      facturas: [],
      message: 'Supabase no está configurado aún. Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.'
    });
  }

  try {
    const { data, error } = await supabase
      .from('facturas')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      connected: true,
      facturas: data || []
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      connected: true,
      error: error.message,
      facturas: []
    });
  }
}
