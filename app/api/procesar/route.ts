import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getSupabaseClient } from '@/lib/supabase';
import JSZip from 'jszip';

interface ProductoItem {
  cantidad: string;
  descripcion: string;
  precio_unitario: string;
  total_item: string;
}

interface FacturaDatos {
  NIT: string;
  BuyerNIT?: string;
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

const MINIMAL_PDF_BASE64 = (
  'JVBERi0xLjQKJcFSWzENCjEgMCBvYmo8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PmVuZG9iagoy' +
  'IDAwYmo8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PmVuZG9iagozIDAgb2JqPDwvVHlw' +
  'ZS9QYWdlL01lZGlhQm94WzAgMCA2MTIgNzkyXS9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+' +
  '/Q29udGVudHMgNSAwIFIvUGFyZW50IDIgMCBSPj5lbmRvYmoKNCAwIG9iajw8L1R5cGUvRm9udC9T' +
  'dWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+ZW5kb2JqCjUgMCBvYmo8PC9MZW5ndGggNzg+' +
  'PnN0cmVhbQpCVAovRjEgMTIgVGYKNzAgNzEwIFRkCihGYWN0dXJhIGRlIENvbXByYSAtIE1pbmltYXJr' +
  'ZXQgUE9TKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAN' +
  'CjAwMDAwMDAwMDkgMDAwMDAgbiANCjAwMDAwMDAwNTggMDAwMDAgbiANCjAwMDAwMDAxMTUgMDAwMDAg' +
  'biANCjAwMDAwMDAyMjEgMDAwMDAgbiANCjAwMDAwMDAyOTIgMDAwMDAgbiANCnRyYWlsZXIKPDwvU2l6' +
  'ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDIxCiUlRU9G'
);

// Genera la estructura idéntica requerida por Siigo Nube basándonos en el archivo de muestra oficial
async function generarEstructuraSiigoIdentica(datos: FacturaDatos): Promise<{
  attachedXml: string;
  invoiceXml: string;
  zipFilename: string;
  xmlFilenameInside: string;
  pdfFilenameInside: string;
  zipBase64: string;
}> {
  const nitProvRaw = (datos.NIT || '822007117').replace(/[^0-9]/g, '');
  const nitProvPadded = nitProvRaw.padStart(10, '0');
  const nitBuyerRaw = (datos.BuyerNIT || '901584216').replace(/[^0-9]/g, '');
  const nitBuyer = nitBuyerRaw || '901584216';

  const fecha = datos.Fecha || new Date().toISOString().split('T')[0];
  const numFactura = `FE-${Math.floor(10000 + Math.random() * 90000)}`;
  
  // Generar CUFE y CUDE de 96 caracteres hexadecimales
  const cufeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const cudeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  // Clave de 27 caracteres idéntica al estándar DIAN VPFE (08 + NIT_PROV_10 + sufijo_15)
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

  const provNameEscaped = escapeXml(`PROVEEDOR ${nitProvRaw}`);

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
        <cbc:Name>MINIMARKET POS</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>MINIMARKET POS</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="8">${nitBuyer}</cbc:CompanyID>
        <cbc:TaxLevelCode>R-99-PN</cbc:TaxLevelCode>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>MINIMARKET POS</cbc:RegistrationName>
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
      <cbc:RegistrationName>MINIMARKET POS</cbc:RegistrationName>
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
  zip.file(pdfFilenameInside, Buffer.from(MINIMAL_PDF_BASE64, 'base64'));

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
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const geminiApiKeyInput = formData.get('gemini_api_key') as string | null;
    const customModelInput = formData.get('gemini_model') as string | null;
    const buyerNitInput = formData.get('buyer_nit') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, detail: 'No se envió ningún archivo de imagen.' }, { status: 400 });
    }

    const apiKeyToUse = geminiApiKeyInput?.trim() || process.env.GEMINI_API_KEY || '';

    if (!apiKeyToUse) {
      return NextResponse.json({
        success: false,
        detail: 'Se requiere una clave de API de Google Gemini (GEMINI_API_KEY). Ingresa tu API Key en la pantalla o en las variables de entorno de Vercel.'
      }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Inicializar cliente Google GenAI
    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    
    // Modelo primario configurado: gemini-3.5-flash
    const preferredModel = customModelInput?.trim() || process.env.GEMINI_MODEL || 'gemini-3.5-flash';

    // Lista ordenada de modelos a intentar
    const modelsToTry = Array.from(new Set([preferredModel, 'gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']));

    const prompt = (
      "Eres un experto contable especializado en software Siigo y ERPs comerciales. " +
      "Analiza detalladamente esta foto de factura de compra de minimarket. " +
      "Extrae los datos generales (NIT del proveedor, Fecha de emisión, Subtotal, IVA, Total) Y ADEMÁS extrae la lista completa de ítems o productos detallados. " +
      "Para cada producto en la lista, extrae: cantidad, descripcion (nombre del producto), precio_unitario y total_item. " +
      "Devuelve un formato JSON estricto con los campos: NIT, Fecha, Subtotal, IVA, Total, TextoExtraido y un arreglo Productos."
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
                mimeType: file.type || 'image/jpeg',
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
        break; // Éxito!
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

    const fields: FacturaDatos = {
      NIT: datosJson.NIT || 'N/A',
      BuyerNIT: buyerNitInput || '901584216',
      Fecha: datosJson.Fecha || 'N/A',
      Subtotal: datosJson.Subtotal || 'N/A',
      IVA: datosJson.IVA || 'N/A',
      Total: datosJson.Total || 'N/A',
      Productos: datosJson.Productos || [],
    };

    const est = await generarEstructuraSiigoIdentica(fields);
    const rawText = datosJson.TextoExtraido || `[Analizado exitosamente con la API de Google Gemini (${modelUsed})]`;

    // Guardar en Supabase si está disponible
    let guardadoEnSupabase = false;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('facturas').insert({
          nit: fields.NIT,
          fecha: fields.Fecha,
          subtotal: fields.Subtotal,
          iva: fields.IVA,
          total: fields.Total,
          texto_extraido: rawText,
          xml_content: est.attachedXml,
        });
        guardadoEnSupabase = true;
      } catch (errDb) {
        console.error('Error al guardar en Supabase:', errDb);
      }
    }

    const imageOriginalB64 = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      filename: file.name,
      motor_usado: `🤖 Google Gemini AI (${modelUsed})`,
      guardado_en_supabase: guardadoEnSupabase,
      raw_text: rawText,
      fields,
      productos: fields.Productos,
      imagen_original_b64: imageOriginalB64,
      xml_content: est.attachedXml,
      invoice_xml_content: est.invoiceXml,
      zip_filename: est.zipFilename,
      xml_filename_inside: est.xmlFilenameInside,
      pdf_filename_inside: est.pdfFilenameInside,
      zip_b64: est.zipBase64,
    });

  } catch (error: any) {
    console.error('Error en API Next.js:', error);
    return NextResponse.json({
      success: false,
      detail: error.message || 'Error procesando la imagen con Google Gemini AI.'
    }, { status: 500 });
  }
}
