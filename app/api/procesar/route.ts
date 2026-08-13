import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getSupabaseClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateImageBuffer } from '@/lib/file-validator';
import { calculateImageHash, generateAccountingIdempotencyKey } from '@/lib/idempotency';
import { generarEstructuraSiigo, limpiarValorNumerico } from '@/lib/siigo-xml';
import { FacturaDatos, ProcesarApiResponse } from '@/types/invoice';

function sanitizeString(input: string, maxLen: number = 100): string {
  if (!input) return '';
  return input.trim().replace(/[^\w\s.,&@#\-áéíóúÁÉÍÓÚñÑ]/g, '').substring(0, maxLen);
}

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. Control de Tasa (Rate Limiting) por IP - Máximo 10 peticiones por minuto
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`procesar_${clientIp}`, 10, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        detail: 'Has alcanzado el límite de solicitudes permitidas por minuto. Por favor, espera un momento antes de procesar otra factura.'
      }, {
        status: 429,
        headers: { 'Retry-After': '60' }
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawBuyerNit = formData.get('buyer_nit') as string | null;
    const rawBuyerName = formData.get('buyer_name') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, detail: 'No se envió ningún archivo de factura para analizar.' }, { status: 400 });
    }

    // 2. Validación de Credencial Exclusiva en Servidor
    const apiKeyToUse = process.env.GEMINI_API_KEY || '';
    if (!apiKeyToUse) {
      return NextResponse.json({
        success: false,
        detail: 'El servicio de IA no está configurado en el servidor (Falta la variable GEMINI_API_KEY en el entorno).'
      }, { status: 500 });
    }

    // 3. Validación Estricta de Archivo (Tamaño y Magic Bytes)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validation = validateImageBuffer(buffer, file.type);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        detail: validation.error || 'El archivo cargado no es una imagen válida.'
      }, { status: 400 });
    }

    // Sanitización de entradas del cliente
    const buyerNitInput = rawBuyerNit ? rawBuyerNit.replace(/[^0-9]/g, '').substring(0, 15) : '901584216';
    const buyerNameInput = rawBuyerName ? sanitizeString(rawBuyerName, 100) : 'MI EMPRESA SAS';

    // 4. Cálculo de SHA-256 de la imagen optimizada (Capa Pre-Gemini)
    const imageHash = calculateImageHash(buffer);
    const supabase = getSupabaseClient();

    // =========================================================================
    // CAPA PRE-GEMINI: BYPASS DE IA SI LA IMAGEN YA FUE PROCESADA
    // =========================================================================
    if (supabase) {
      try {
        const { data: existingByHash } = await supabase
          .from('facturas')
          .select('*')
          .eq('buyer_nit', buyerNitInput)
          .eq('image_hash', imageHash)
          .neq('estado', 'error')
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingByHash) {
          const durationMs = Math.round(performance.now() - startTime);
          console.log(`[Idempotency] Imagen idéntica encontrada (${imageHash.substring(0, 10)}...). Bypass de Gemini.`);

          const cachedFields: FacturaDatos = {
            NIT: existingByHash.proveedor_nit || existingByHash.nit || 'N/A',
            NombreProveedor: existingByHash.proveedor_nombre || `PROVEEDOR ${existingByHash.proveedor_nit || existingByHash.nit}`,
            BuyerNIT: existingByHash.buyer_nit,
            BuyerName: existingByHash.buyer_name,
            Fecha: existingByHash.fecha ? String(existingByHash.fecha) : 'N/A',
            Subtotal: String(existingByHash.subtotal || '0'),
            IVA: String(existingByHash.iva || '0'),
            Total: String(existingByHash.total || '0'),
            Productos: Array.isArray(existingByHash.productos) ? existingByHash.productos : [],
          };

          const est = await generarEstructuraSiigo(cachedFields, existingByHash.numero_factura);

          const responsePayload: ProcesarApiResponse = {
            success: true,
            duplicate: true,
            duplicate_type: 'image_hash',
            existing_id: existingByHash.id,
            message: 'Esta imagen ya fue procesada. Se recuperaron los datos existentes.',
            filename: file.name,
            motor_usado: `⚡ Caché Idempotente (${imageHash.substring(0, 8)}...)`,
            guardado_en_supabase: true,
            raw_text: existingByHash.texto_extraido,
            fields: cachedFields,
            buyer_nit: existingByHash.buyer_nit,
            buyer_name: existingByHash.buyer_name,
            nombre_proveedor: existingByHash.proveedor_nombre,
            productos: cachedFields.Productos,
            xml_content: existingByHash.xml_content || est.attachedXml,
            invoice_xml_content: est.invoiceXml,
            zip_filename: est.zipFilename,
            xml_filename_inside: est.xmlFilenameInside,
            pdf_filename_inside: est.pdfFilenameInside,
            zip_b64: est.zipBase64,
            image_hash: imageHash,
            idempotency_key: existingByHash.idempotency_key,
            duracion_ms: durationMs,
          };

          return NextResponse.json(responsePayload);
        }
      } catch (errCache) {
        console.warn('Advertencia en verificación de caché por hash:', errCache);
      }
    }

    // 5. Inferencia con Google GenAI (Solo si no estaba en caché de imagen)
    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const modelsToTry = Array.from(new Set([preferredModel, 'gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']));

    const prompt = (
      "Eres un experto contable especializado en software Siigo y facturación electrónica de la DIAN en Colombia. " +
      "Analiza detalladamente esta foto de factura de compra. " +
      "Extrae con total precisión: " +
      "1. Datos del Proveedor/Emisor: NIT_Proveedor (solo dígitos) y Nombre_Proveedor (Razón Social del vendedor). " +
      "2. Datos de la Empresa Compradora/Adquirente/Cliente (quien compra o a quien facturan): NIT_Comprador (solo dígitos) y Nombre_Comprador (Razón Social o nombre del cliente/comprador si figura en la factura). " +
      "3. Datos del Documento: NumeroFactura (ej: BC10 146694, FE-1234, etc. tal como aparece en el encabezado). " +
      "4. Datos Generales: Fecha de emisión (YYYY-MM-DD), Subtotal, IVA, Total. " +
      "5. Lista detallada de Productos (arreglo Productos con: cantidad, descripcion, precio_unitario, total_item). " +
      "Devuelve un formato JSON estricto con los campos: NIT, NombreProveedor, NIT_Comprador, NombreComprador, NumeroFactura, Fecha, Subtotal, IVA, Total, TextoExtraido y un arreglo Productos."
    );

    let response = null;
    let modelUsed = '';
    let lastError: any = null;

    for (const candidateModel of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: candidateModel,
          contents: [
            {
              inlineData: {
                mimeType: validation.detectedMimeType || file.type || 'image/jpeg',
                data: buffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                NIT: { type: Type.STRING },
                NombreProveedor: { type: Type.STRING },
                NIT_Comprador: { type: Type.STRING },
                NombreComprador: { type: Type.STRING },
                NumeroFactura: { type: Type.STRING },
                Fecha: { type: Type.STRING },
                Subtotal: { type: Type.STRING },
                IVA: { type: Type.STRING },
                Total: { type: Type.STRING },
                TextoExtraido: { type: Type.STRING },
                Productos: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      cantidad: { type: Type.STRING },
                      descripcion: { type: Type.STRING },
                      precio_unitario: { type: Type.STRING },
                      total_item: { type: Type.STRING },
                    },
                    required: ['cantidad', 'descripcion', 'total_item'],
                  },
                },
              },
              required: ['NIT', 'Fecha', 'Subtotal', 'IVA', 'Total', 'Productos'],
            },
          },
        });

        modelUsed = candidateModel;
        break; // Éxito
      } catch (err: any) {
        console.warn(`Modelo ${candidateModel} no disponible, probando siguiente modelo...`, err?.message);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw new Error(lastError?.message || 'No se pudo obtener respuesta de la API de Google Gemini.');
    }

    const responseText = response.text || '{}';
    const datosJson = JSON.parse(responseText);

    const detectedBuyerNit = datosJson.NIT_Comprador || buyerNitInput || '901584216';
    const detectedBuyerName = datosJson.NombreComprador || buyerNameInput || 'MI EMPRESA SAS';
    const rawInvoiceNumber = datosJson.NumeroFactura || null;

    const fields: FacturaDatos = {
      NIT: datosJson.NIT || 'N/A',
      NombreProveedor: datosJson.NombreProveedor || `PROVEEDOR ${datosJson.NIT || ''}`,
      BuyerNIT: buyerNitInput || detectedBuyerNit,
      BuyerName: buyerNameInput || detectedBuyerName,
      Fecha: datosJson.Fecha || 'N/A',
      Subtotal: datosJson.Subtotal || 'N/A',
      IVA: datosJson.IVA || 'N/A',
      Total: datosJson.Total || 'N/A',
      Productos: datosJson.Productos || [],
    };

    const activeBuyerNit = fields.BuyerNIT || '901584216';

    // =========================================================================
    // CAPA POST-GEMINI: IDEMPOTENCY KEY CONTABLE POR NÚMERO DE FACTURA
    // =========================================================================
    const accountingKey = generateAccountingIdempotencyKey(activeBuyerNit, fields.NIT, rawInvoiceNumber);

    if (supabase && accountingKey) {
      try {
        const { data: existingByKey } = await supabase
          .from('facturas')
          .select('*')
          .eq('idempotency_key', accountingKey)
          .neq('estado', 'error')
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingByKey) {
          const durationMs = Math.round(performance.now() - startTime);
          console.log(`[Idempotency] Factura contable duplicada encontrada (${accountingKey}). Reutilizando registro existente.`);

          const cachedFields: FacturaDatos = {
            NIT: existingByKey.proveedor_nit || existingByKey.nit || fields.NIT,
            NombreProveedor: existingByKey.proveedor_nombre || fields.NombreProveedor,
            BuyerNIT: existingByKey.buyer_nit || activeBuyerNit,
            BuyerName: existingByKey.buyer_name || fields.BuyerName,
            Fecha: existingByKey.fecha ? String(existingByKey.fecha) : fields.Fecha,
            Subtotal: String(existingByKey.subtotal || fields.Subtotal),
            IVA: String(existingByKey.iva || fields.IVA),
            Total: String(existingByKey.total || fields.Total),
            Productos: Array.isArray(existingByKey.productos) && existingByKey.productos.length > 0 ? existingByKey.productos : fields.Productos,
          };

          const est = await generarEstructuraSiigo(cachedFields, existingByKey.numero_factura || rawInvoiceNumber);

          const responsePayload: ProcesarApiResponse = {
            success: true,
            duplicate: true,
            duplicate_type: 'invoice_key',
            existing_id: existingByKey.id,
            message: `Esta factura (${existingByKey.numero_factura || rawInvoiceNumber} de ${cachedFields.NombreProveedor}) ya existe en el historial de tu empresa.`,
            filename: file.name,
            motor_usado: `🤖 Google Gemini AI (${modelUsed})`,
            guardado_en_supabase: true,
            raw_text: existingByKey.texto_extraido,
            fields: cachedFields,
            buyer_nit: existingByKey.buyer_nit,
            buyer_name: existingByKey.buyer_name,
            nombre_proveedor: existingByKey.proveedor_nombre,
            productos: cachedFields.Productos,
            xml_content: existingByKey.xml_content || est.attachedXml,
            invoice_xml_content: est.invoiceXml,
            zip_filename: est.zipFilename,
            xml_filename_inside: est.xmlFilenameInside,
            pdf_filename_inside: est.pdfFilenameInside,
            zip_b64: est.zipBase64,
            image_hash: imageHash,
            idempotency_key: accountingKey,
            duracion_ms: durationMs,
          };

          return NextResponse.json(responsePayload);
        }
      } catch (errKey) {
        console.warn('Advertencia en verificación de clave contable:', errKey);
      }
    }

    // 6. Generación de XML UBL 2.1 sincronizado
    const est = await generarEstructuraSiigo(fields, rawInvoiceNumber);
    const rawText = `[NIT_COMPRADOR:${activeBuyerNit}] ${datosJson.TextoExtraido || `[Analizado exitosamente con Google Gemini AI (${modelUsed})]`}`;
    const durationMs = Math.round(performance.now() - startTime);

    // Determinar estado: si tiene número de factura válido pasa a completada, de lo contrario requiere revisión
    const finalEstado = accountingKey ? 'completada' : 'requiere_revision';

    // 7. Persistencia segura en Supabase
    let guardadoEnSupabase = false;
    let createdInvoiceId: string | undefined = undefined;

    if (supabase) {
      try {
        const subtotalNum = limpiarValorNumerico(fields.Subtotal) || null;
        const ivaNum = limpiarValorNumerico(fields.IVA) || null;
        const totalNum = limpiarValorNumerico(fields.Total) || (subtotalNum !== null && ivaNum !== null ? subtotalNum + ivaNum : null);
        const isoDate = (fields.Fecha && fields.Fecha !== 'N/A' && /^\d{4}-\d{2}-\d{2}$/.test(fields.Fecha)) ? fields.Fecha : null;

        const newSchemaPayload: any = {
          proveedor_nit: fields.NIT || 'N/A',
          proveedor_nombre: fields.NombreProveedor || null,
          buyer_nit: activeBuyerNit,
          buyer_name: fields.BuyerName || null,
          numero_factura: rawInvoiceNumber || ((est.invoiceXml.match(/<cbc:ID>([^<]+)<\/cbc:ID>/) || [])[1] || null),
          fecha: isoDate,
          subtotal: subtotalNum,
          iva: ivaNum,
          total: totalNum,
          productos: fields.Productos || [],
          estado: finalEstado,
          image_hash: imageHash,
          idempotency_key: accountingKey,
          modelo_ia: modelUsed,
          duracion_ms: durationMs,
          texto_extraido: rawText,
          xml_content: est.attachedXml,
        };

        const { data: insertedData, error: insertErr } = await supabase
          .from('facturas')
          .insert(newSchemaPayload)
          .select('id')
          .single();

        if (!insertErr && insertedData) {
          createdInvoiceId = insertedData.id;
          guardadoEnSupabase = true;
        } else if (insertErr) {
          // Si falló por conflicto único de concurrencia (código 23505), recuperar el registro ganador
          if (insertErr.code === '23505' && accountingKey) {
            const { data: concurrentDoc } = await supabase
              .from('facturas')
              .select('id')
              .eq('idempotency_key', accountingKey)
              .maybeSingle();

            createdInvoiceId = concurrentDoc?.id;
            guardadoEnSupabase = true;
          } else {
            // Retrocompatibilidad con schema anterior
            const { data: legacyData } = await supabase
              .from('facturas')
              .insert({
                nit: fields.NIT,
                fecha: fields.Fecha,
                subtotal: fields.Subtotal,
                iva: fields.IVA,
                total: fields.Total,
                texto_extraido: rawText,
                xml_content: est.attachedXml,
              })
              .select('id')
              .single();

            createdInvoiceId = legacyData?.id;
            guardadoEnSupabase = true;
          }
        }
      } catch (errDb) {
        console.error('Error al guardar en Supabase:', errDb);
      }
    }

    const responsePayload: ProcesarApiResponse = {
      success: true,
      duplicate: false,
      invoice_id: createdInvoiceId,
      filename: file.name,
      motor_usado: `🤖 Google Gemini AI (${modelUsed})`,
      guardado_en_supabase: guardadoEnSupabase,
      raw_text: rawText,
      fields,
      buyer_nit: fields.BuyerNIT,
      buyer_name: fields.BuyerName,
      nombre_proveedor: fields.NombreProveedor,
      numero_factura: rawInvoiceNumber,
      productos: fields.Productos,
      xml_content: est.attachedXml,
      invoice_xml_content: est.invoiceXml,
      zip_filename: est.zipFilename,
      xml_filename_inside: est.xmlFilenameInside,
      pdf_filename_inside: est.pdfFilenameInside,
      zip_b64: est.zipBase64,
      image_hash: imageHash,
      idempotency_key: accountingKey,
      duracion_ms: durationMs,
    };

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('Error en API Next.js:', error);
    return NextResponse.json({
      success: false,
      detail: error.message || 'Error procesando la imagen con Google Gemini AI.'
    }, { status: 500 });
  }
}
