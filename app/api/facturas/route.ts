import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      connected: false,
      facturas: [],
      message: 'Supabase no está configurado aún.'
    });
  }

  try {
    const { data, error } = await supabase
      .from('facturas')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(100);

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

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      message: 'Supabase no está configurado.'
    }, { status: 400 });
  }

  try {
    const body = await req.json();
    const ids: string[] = body.ids || [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No se enviaron IDs válidos para eliminar.'
      }, { status: 400 });
    }

    const { error, count } = await supabase
      .from('facturas')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      count: count || ids.length,
      message: `${count || ids.length} registro(s) eliminado(s) correctamente.`
    });
  } catch (error: any) {
    console.error('Error al eliminar en Supabase:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Error al eliminar registros en Supabase.'
    }, { status: 500 });
  }
}
