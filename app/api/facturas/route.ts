import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/auth/authorize';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  // 0. Autorización RBAC en Servidor: Validar permiso 'invoice.view'
  const authResult = await requirePermission('invoice.view');
  if (!authResult.success) {
    return authResult.response;
  }
  const { tenantId } = authResult.context;

  // 1. Rate Limiting por IP para GET (Máximo 60 peticiones/minuto)
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`facturas_get_${clientIp}`, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      success: false,
      connected: false,
      facturas: [],
      error: 'Demasiadas solicitudes. Espera un momento antes de volver a consultar.'
    }, { status: 429 });
  }

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
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get('id');
    const rawBuyerNit = searchParams.get('buyer_nit');
    const cleanBuyerNit = rawBuyerNit ? rawBuyerNit.replace(/[^0-9]/g, '').substring(0, 15) : '';

    // 2. Consulta bajo demanda de XML para una sola factura (Descarga)
    if (singleId) {
      if (!UUID_REGEX.test(singleId.trim())) {
        return NextResponse.json({ success: false, error: 'Identificador de factura no válido.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('facturas')
        .select('*')
        .eq('id', singleId.trim())
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .single();

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Factura no encontrada o no pertenece a tu organización.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        connected: true,
        factura: {
          id: data.id,
          nit: data.proveedor_nit || data.nit,
          xml_content: data.xml_content
        }
      });
    }

    // 3. Consulta de Listado General Optimizado con aislamiento de Tenant
    let query = supabase
      .from('facturas')
      .select('id, proveedor_nit, proveedor_nombre, buyer_nit, buyer_name, numero_factura, fecha, subtotal, iva, total, productos, estado, creado_en')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order('creado_en', { ascending: false })
      .limit(100);

    if (cleanBuyerNit) {
      query = query.eq('buyer_nit', cleanBuyerNit);
    }

    let rawData: any[] | null = null;
    let queryErr: any = null;

    const resPrimary = await query;
    if (!resPrimary.error) {
      rawData = resPrimary.data;
    } else {
      queryErr = resPrimary.error;
      // Resiliencia retrocompatible si aún no se ejecutan los ALTER TABLE
      let fallbackQuery = supabase
        .from('facturas')
        .select('id, nit, fecha, subtotal, iva, total, texto_extraido, creado_en')
        .order('creado_en', { ascending: false })
        .limit(100);

      if (cleanBuyerNit) {
        fallbackQuery = fallbackQuery.or(`texto_extraido.ilike.%[NIT_COMPRADOR:${cleanBuyerNit}]%,xml_content.ilike.%<cbc:CompanyID%>${cleanBuyerNit}</cbc:CompanyID>%`);
      }

      const fallbackRes = await fallbackQuery;
      if (!fallbackRes.error) {
        rawData = fallbackRes.data as any[];
        queryErr = null;
      } else {
        queryErr = fallbackRes.error;
      }
    }

    if (queryErr) {
      throw queryErr;
    }

    // Normalizar formato de salida para el cliente
    const normalizedFacturas = (rawData || []).map((f: any) => ({
      id: f.id,
      proveedor_nit: f.proveedor_nit || f.nit || 'N/A',
      proveedor_nombre: f.proveedor_nombre || null,
      buyer_nit: f.buyer_nit || cleanBuyerNit || 'N/A',
      buyer_name: f.buyer_name || null,
      numero_factura: f.numero_factura || null,
      fecha: f.fecha ? String(f.fecha) : null,
      subtotal: f.subtotal !== null && f.subtotal !== undefined ? f.subtotal : 'N/A',
      iva: f.iva !== null && f.iva !== undefined ? f.iva : 'N/A',
      total: f.total !== null && f.total !== undefined ? f.total : 'N/A',
      productos: Array.isArray(f.productos) ? f.productos : [],
      estado: f.estado || 'procesada',
      creado_en: f.creado_en
    }));

    return NextResponse.json({
      success: true,
      connected: true,
      facturas: normalizedFacturas
    });
  } catch (error: any) {
    console.error('Error al consultar facturas en Supabase:', error);
    return NextResponse.json({
      success: false,
      connected: true,
      error: error.message || 'Error al recuperar facturas.',
      facturas: []
    });
  }
}

export async function DELETE(req: NextRequest) {
  // 0. Autorización RBAC en Servidor: Validar permiso 'invoice.delete' (solo Owner y Admin)
  const authResult = await requirePermission('invoice.delete');
  if (!authResult.success) {
    return authResult.response;
  }
  const { tenantId } = authResult.context;

  // 1. Rate Limiting por IP para DELETE (Máximo 20 eliminaciones/minuto)
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`facturas_del_${clientIp}`, 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      success: false,
      message: 'Límite de solicitudes de eliminación excedido. Por favor espera un momento.'
    }, { status: 429 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      success: false,
      message: 'Supabase no está configurado.'
    }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = body.ids || [];
    const rawBuyerNit = body.buyer_nit as string | undefined;
    const cleanBuyerNit = rawBuyerNit ? rawBuyerNit.replace(/[^0-9]/g, '').substring(0, 15) : '';

    // 2. Validación Estricta de IDs
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No se enviaron IDs válidos para eliminar.'
      }, { status: 400 });
    }

    if (ids.length > 50) {
      return NextResponse.json({
        success: false,
        message: 'Por seguridad, el límite máximo de eliminación es de 50 facturas por lote.'
      }, { status: 400 });
    }

    // Validar que cada ID sea un formato UUID válido
    const validIds = ids.filter(id => typeof id === 'string' && UUID_REGEX.test(id.trim()));
    if (validIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Ninguno de los identificadores proporcionados tiene un formato UUID válido.'
      }, { status: 400 });
    }

    let deleteQuery = supabase
      .from('facturas')
      .delete({ count: 'exact' })
      .in('id', validIds)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const { error, count } = await deleteQuery;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      count: count ?? validIds.length,
      message: `${count ?? validIds.length} registro(s) eliminado(s) correctamente.`
    });
  } catch (error: any) {
    console.error('Error al eliminar en Supabase:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Error al eliminar registros en Supabase.'
    });
  }
}
