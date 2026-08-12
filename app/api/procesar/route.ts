import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getSupabaseClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateImageBuffer } from '@/lib/file-validator';
import { calculateImageHash, generateAccountingIdempotencyKey, normalizeInvoiceNumber } from '@/lib/idempotency';
import JSZip from 'jszip';

interface ProductoItem {
  cantidad: string;
  descripcion: string;
  precio_unitario: string;
  total_item: string;
}

interface FacturaDatos {
  NIT: string;
  NombreProveedor?: string;
  BuyerNIT?: string;
  BuyerName?: string;
  Fecha: string;
  Subtotal: string;
  IVA: string;
  Total: string;
  Productos: ProductoItem[];
}

function limpiarValorNumerico(strVal: string): number {
  if (!strVal) return 0;
  const num = parseFloat(strVal.replace(/[^0-9.-]+/g, ''));
  return isNaN(num) ? 0 : num;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeString(input: string, maxLen: number = 100): string {
  if (!input) return '';
  return input.trim().replace(/[^\w\s.,&@#\-áéíóúÁÉÍÓÚñÑ]/g, '').substring(0, maxLen);
}

const PDF_CONTENT_STRING = (
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R/Parent 2 0 R>>endobj\n' +
  '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
  '5 0 obj<</Length 78>>stream\n' +
  'BT\n/F1 12 Tf\n70 710 Td\n(Factura de Compra - DIAN Siigo) Tj\nET\nendstream\nendobj\n' +
  'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000221 00000 n \n0000000292 00000 n \n' +
  'trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n421\n%%EOF'
);

// Genera la estructura XML UBL 2.1 oficial para Siigo Nube adaptada para cualquier Empresa Compradora
async function generarEstructuraSiigoIdentica(datos: FacturaDatos, numeroFacturaCustom?: string | null): Promise<{
  attachedXml: string;
  invoiceXml: string;
  zipFilename: string;
  xmlFilenameInside: string;
  pdfFilenameInside: string;
  zipBase64: string;
}> {
  const nitProvRaw = (datos.NIT || '822007117').replace(/[^0-9]/g, '');
  const nitProvPadded = nitProvRaw.padStart(10, '0');
  const provNameEscaped = escapeXml(datos.NombreProveedor || `PROVEEDOR ${nitProvRaw}`);

  // NIT y Nombre de la empresa compradora en Siigo
  const nitBuyerRaw = (datos.BuyerNIT || '901584216').replace(/[^0-9]/g, '');
  const nitBuyer = nitBuyerRaw || '901584216';
  const buyerNameEscaped = escapeXml(datos.BuyerName || 'MI EMPRESA SAS');

  const fecha = datos.Fecha || new Date().toISOString().split('T')[0];
  const numFactura = numeroFacturaCustom || `FE-${Math.floor(10000 + Math.random() * 90000)}`;
  
  // Generar CUFE y CUDE de 96 caracteres hexadecimales
  const cufeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const cudeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  // Clave de 27 caracteres estandar DIAN VPFE (08 + NIT_PROV_10 + sufijo_15)
  const key27 = `08${nitProvPadded}04720260000x39efe`.substring(0, 27);
  const zipFilename = `z${key27}.zip`;
  const xmlFilenameInside = `ad${key27}.xml`;
  const pdfFilenameInside = `fv${key27}.pdf`;

  const subtotalNum = limpiarValorNumerico(datos.Subtotal);
  const ivaNum = limpiarValorNumerico(datos.IVA);
  const totalNum = limpiarValorNumerico(datos.Total) || (subtotalNum + ivaNum);
  
  const productosList = (datos.Productos && datos.Productos.length > 0)
    ? datos.Productos
    : [{ cantidad: '1', descripcion: 'MERCANCIA GENERAL', precio_unitario: datos.Subtotal, total_item: datos.Subtotal }];

  const lineCount = productosList.length;

  const productosXmlLines = productosList.map((p, index) => {
    const cantNum = limpiarValorNumerico(p.cantidad) || 1;
    const totalItemNum = limpiarValorNumerico(p.total_item) || (limpiarValorNumerico(p.precio_unitario) * cantNum);
    const precioUnitNum = limpiarValorNumerico(p.precio_unitario) || (totalItemNum / cantNum);
    const lineIva = Math.round(totalItemNum * 0.19 * 100) / 100;
    const descEscaped = escapeXml(p.descripcion || 'PRODUCTO');

    return `    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="94">${cantNum.toFixed(2)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${totalItemNum.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${lineIva.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="COP">${totalItemNum.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="COP">${lineIva.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>19.00</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>01</cbc:ID>
              <cbc:Name>IVA</cbc:Name>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${descEscaped}</cbc:Description>
        <cac:StandardItemIdentification>
          <cbc:ID schemeID="999">${index + 101}</cbc:ID>
        </cac:StandardItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="COP">${precioUnitNum.toFixed(2)}</cbc:PriceAmount>
        <cbc:BaseQuantity unitCode="94">1.00</cbc:BaseQuantity>
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join('\n');

  const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
         xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ProfileExecutionID>1</cbc:ProfileExecutionID>
  <cbc:ID>${numFactura}</cbc:ID>
  <cbc:UUID schemeID="1" schemeName="CUFE-SHA384">${cufeSha384}</cbc:UUID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>12:00:00-05:00</cbc:IssueTime>
  <cbc:DueDate>${fecha}</cbc:DueDate>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${lineCount}</cbc:LineCountNumeric>
  <cac:AccountingSupplierParty>
    <cbc:AdditionalAccountID schemeAgencyID="195">1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${provNameEscaped}</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${provNameEscaped}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="7">${nitProvRaw}</cbc:CompanyID>
        <cbc:TaxLevelCode>R-99-PN</cbc:TaxLevelCode>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${provNameEscaped}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="7">${nitProvRaw}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cbc:AdditionalAccountID schemeAgencyID="195">1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeAgencyID="195" schemeName="31" schemeID="8">${nitBuyer}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${buyerNameEscaped}</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${buyerNameEscaped}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="8">${nitBuyer}</cbc:CompanyID>
        <cbc:TaxLevelCode>R-99-PN</cbc:TaxLevelCode>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${buyerNameEscaped}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="8">${nitBuyer}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${ivaNum.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${subtotalNum.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${ivaNum.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${subtotalNum.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${subtotalNum.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${totalNum.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="COP">0.00</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="COP">0.00</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="COP">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="COP">${totalNum.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${productosXmlLines}
</Invoice>`;

  const attachedXml = `<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
                  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
                  xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>Documentos de adjunto de Factura Electronica</cbc:CustomizationID>
  <cbc:ProfileID>Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ProfileExecutionID>1</cbc:ProfileExecutionID>
  <cbc:ID>${numFactura}</cbc:ID>
  <cbc:UUID schemeName="CUDE-SHA384">${cudeSha384}</cbc:UUID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>12:00:00-05:00</cbc:IssueTime>
  <cac:SenderParty>
    <cac:PartyTaxScheme>
      <cbc:RegistrationName>${provNameEscaped}</cbc:RegistrationName>
      <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="7">${nitProvRaw}</cbc:CompanyID>
      <cbc:TaxLevelCode>R-99-PN</cbc:TaxLevelCode>
      <cac:TaxScheme>
        <cbc:ID>01</cbc:ID>
        <cbc:Name>IVA</cbc:Name>
      </cac:TaxScheme>
    </cac:PartyTaxScheme>
  </cac:SenderParty>
  <cac:ReceiverParty>
    <cac:PartyTaxScheme>
      <cbc:RegistrationName>${buyerNameEscaped}</cbc:RegistrationName>
      <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="8">${nitBuyer}</cbc:CompanyID>
      <cbc:TaxLevelCode>R-99-PN</cbc:TaxLevelCode>
      <cac:TaxScheme>
        <cbc:ID>01</cbc:ID>
        <cbc:Name>IVA</cbc:Name>
      </cac:TaxScheme>
    </cac:PartyTaxScheme>
  </cac:ReceiverParty>
  <cac:Attachment>
    <cac:ExternalReference>
      <cbc:MimeCode>text/xml</cbc:MimeCode>
      <cbc:EncodingCode>UTF-8</cbc:EncodingCode>
      <cbc:Description><![CDATA[${invoiceXml}]]></cbc:Description>
    </cac:ExternalReference>
  </cac:Attachment>
  <cac:ParentDocumentLineReference>
    <cbc:LineID>1</cbc:LineID>
    <cbc:DocumentTypeCode>1</cbc:DocumentTypeCode>
    <cac:DocumentReference>
      <cbc:ID>${numFactura}</cbc:ID>
      <cbc:UUID>${cufeSha384}</cbc:UUID>
      <cbc:IssueDate>${fecha}</cbc:IssueDate>
    </cac:DocumentReference>
  </cac:ParentDocumentLineReference>
</AttachedDocument>`;

  // Crear archivo ZIP con la nomenclatura exacta ad[KEY].xml y fv[KEY].pdf
  const zip = new JSZip();
  zip.file(xmlFilenameInside, attachedXml);
  zip.file(pdfFilenameInside, Buffer.from(PDF_CONTENT_STRING, 'utf-8'));

  // Generar base64
  let zipBase64 = '';
  try {
    zipBase64 = await zip.generateAsync({ type: 'base64' });
  } catch (e) {
    console.error('Error generando zip base64:', e);
  }

  return { attachedXml, invoiceXml, zipFilename, xmlFilenameInside, pdfFilenameInside, zipBase64 };
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

          const est = await generarEstructuraSiigoIdentica(cachedFields, existingByHash.numero_factura);

          return NextResponse.json({
            success: true,
            duplicate: true,
            duplicate_type: 'image_hash',
            existing_id: existingByHash.id,
            message: 'Esta imagen ya fue procesada. Se recuperaron los datos existentes sin consumir tokens de IA.',
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
          });
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

          const est = await generarEstructuraSiigoIdentica(cachedFields, existingByKey.numero_factura || rawInvoiceNumber);

          return NextResponse.json({
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
          });
        }
      } catch (errKey) {
        console.warn('Advertencia en verificación de clave contable:', errKey);
      }
    }

    // 6. Generación de XML UBL 2.1 sincronizado
    const est = await generarEstructuraSiigoIdentica(fields, rawInvoiceNumber);
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
          // Si falló por conflicto único de concurrencia (código 23505), recuperar el registro insertado concurrentemente
          if (insertErr.code === '23505' && accountingKey) {
            const { data: concurrentDoc } = await supabase
              .from('facturas')
              .select('id')
              .eq('idempotency_key', accountingKey)
              .maybeSingle();

            createdInvoiceId = concurrentDoc?.id;
            guardadoEnSupabase = true;
          } else {
            // Retrocompatibilidad con schema anterior mientras se ejecuta la migración
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

    return NextResponse.json({
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
    });

  } catch (error: any) {
    console.error('Error en API Next.js:', error);
    return NextResponse.json({
      success: false,
      detail: error.message || 'Error procesando la imagen con Google Gemini AI.'
    }, { status: 500 });
  }
}
