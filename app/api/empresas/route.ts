import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const DEFAULT_COMPANY = { nit: '901584216', nombre: 'MI EMPRESA SAS' };

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`empresas_get_${clientIp}`, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes.' },
      { status: 429 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: true,
      from_database: false,
      empresas: [DEFAULT_COMPANY],
    });
  }

  try {
    const { data, error } = await supabase
      .from('empresas')
      .select('nit, nombre, creado_en')
      .order('creado_en', { ascending: false });

    if (error) {
      console.warn('Tabla empresas no disponible en Supabase:', error.message);
      return NextResponse.json({
        success: true,
        from_database: false,
        empresas: [],
      });
    }

    return NextResponse.json({
      success: true,
      from_database: true,
      empresas: data || [],
    });
  } catch (error: any) {
    console.error('Error consultando empresas:', error);
    return NextResponse.json({
      success: false,
      from_database: false,
      empresas: [],
    });
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`empresas_post_${clientIp}`, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Límite de solicitudes excedido.' },
      { status: 429 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      message: 'Supabase no está configurado.',
    }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawNit = String(body.nit || '').trim();
    const rawName = String(body.nombre || '').trim();

    const cleanNit = rawNit.replace(/[^0-9]/g, '').substring(0, 15);
    const cleanName = rawName.substring(0, 200);

    if (!cleanNit || !cleanName) {
      return NextResponse.json({
        success: false,
        message: 'El NIT y la Razón Social son requeridos.',
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('empresas')
      .upsert({ nit: cleanNit, nombre: cleanName }, { onConflict: 'nit' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Empresa "${cleanName}" guardada correctamente en base de datos.`,
      empresa: data,
    });
  } catch (error: any) {
    console.error('Error guardando empresa en Supabase:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Error al guardar la empresa en Supabase.',
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`empresas_del_${clientIp}`, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Límite de solicitudes excedido.' },
      { status: 429 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      message: 'Supabase no está configurado.',
    }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawNit = String(body.nit || '').trim();
    const cleanNit = rawNit.replace(/[^0-9]/g, '').substring(0, 15);

    if (!cleanNit) {
      return NextResponse.json({
        success: false,
        message: 'NIT inválido para eliminar.',
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('nit', cleanNit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Empresa eliminada correctamente de la base de datos.',
    });
  } catch (error: any) {
    console.error('Error eliminando empresa en Supabase:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Error al eliminar empresa de Supabase.',
    }, { status: 500 });
  }
}
