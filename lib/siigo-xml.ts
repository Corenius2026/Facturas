import JSZip from 'jszip';
import { FacturaDatos, ProductoItem, SiigoStructureResult } from '@/types/invoice';

export function limpiarValorNumerico(strVal: string | number | null | undefined): number {
  if (strVal === null || strVal === undefined) return 0;
  if (typeof strVal === 'number') return isNaN(strVal) ? 0 : strVal;
  
  let text = String(strVal).trim();
  // Eliminar símbolos de moneda y caracteres extraños (dejando solo números, puntos, comas y signo menos)
  text = text.replace(/[^0-9.,-]/g, '');
  if (!text) return 0;
  
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  
  let normalized = text;
  
  if (lastDot > -1 && lastComma > -1) {
    if (lastDot > lastComma) {
      // Formato US: 2,500.50 -> quitar comas
      normalized = text.replace(/,/g, '');
    } else {
      // Formato EU/CO: 2.500,50 -> quitar puntos, cambiar coma por punto
      normalized = text.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastDot > -1) {
    // Si tiene un punto y lo que le sigue son exactamente 3 dígitos (ej: 266.940), es separador de miles
    const parts = text.split('.');
    if (parts[parts.length - 1].length === 3) {
      normalized = text.replace(/\./g, '');
    } else {
      // De lo contrario es decimal (ej: 266.94 o 266.9400)
      normalized = text;
    }
  } else if (lastComma > -1) {
    // Si tiene coma y lo que le sigue son exactamente 3 dígitos (ej: 266,940), es separador de miles
    const parts = text.split(',');
    if (parts[parts.length - 1].length === 3) {
      normalized = text.replace(/,/g, '');
    } else {
      normalized = text.replace(',', '.');
    }
  }

  let num = parseFloat(normalized);
  
  // Salvaguarda para pesos colombianos: si el número resulta tener decimales y es menor a 1000 
  // (ej. 266.94), es casi seguro un error de extracción de IA que omitió el último 0 de un 
  // valor como 266.940. En Colombia no se usan céntimos y las facturas reales no son de $266.
  if (!isNaN(num) && num > 0 && num < 1000 && (num % 1 !== 0)) {
    num = Math.round(num * 1000);
  }

  return isNaN(num) ? 0 : num;
}

export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatMonetaryDisplay(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === 'N/A' || val === '') return 'N/A';
  const num = limpiarValorNumerico(val);
  return `$ ${num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const PDF_CONTENT_STRING = (
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

/**
 * Genera la estructura XML UBL 2.1 oficial para Siigo Nube adaptada para cualquier Empresa Compradora
 */
export async function generarEstructuraSiigo(
  datos: FacturaDatos,
  numeroFacturaCustom?: string | null
): Promise<SiigoStructureResult> {
  const nitProvRaw = (datos.NIT || '822007117').replace(/[^0-9]/g, '');
  const nitProvPadded = nitProvRaw.padStart(10, '0');
  const provNameEscaped = escapeXml(datos.NombreProveedor || `PROVEEDOR ${nitProvRaw}`);

  // NIT y Nombre de la empresa compradora en Siigo
  const nitBuyerRaw = (datos.BuyerNIT || '901584216').replace(/[^0-9]/g, '');
  const nitBuyer = nitBuyerRaw || '901584216';
  const buyerNameEscaped = escapeXml(datos.BuyerName || 'MI EMPRESA SAS');

  const fecha = datos.Fecha && datos.Fecha !== 'N/A' ? datos.Fecha : new Date().toISOString().split('T')[0];
  const numFactura = numeroFacturaCustom || `FE-${Math.floor(10000 + Math.random() * 90000)}`;

  // Generar CUFE y CUDE de 96 caracteres hexadecimales
  const cufeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const cudeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  // Clave de 27 caracteres estándar DIAN VPFE (08 + NIT_PROV_10 + sufijo_15)
  const key27 = `08${nitProvPadded}04720260000x39efe`.substring(0, 27);
  const zipFilename = `z${key27}.zip`;
  const xmlFilenameInside = `ad${key27}.xml`;
  const pdfFilenameInside = `fv${key27}.pdf`;

  const subtotalNum = limpiarValorNumerico(datos.Subtotal);
  const ivaNum = limpiarValorNumerico(datos.IVA);
  const totalNum = limpiarValorNumerico(datos.Total) || (subtotalNum + ivaNum);

  // 1. Determinar valores totales consistentes
  let effectiveSubtotal = subtotalNum;
  let effectiveIva = ivaNum;
  let effectiveTotal = totalNum;

  if (effectiveTotal === 0 && effectiveSubtotal > 0) {
    effectiveTotal = effectiveSubtotal + effectiveIva;
  }
  if (effectiveSubtotal === 0 && effectiveTotal > 0) {
    effectiveSubtotal = effectiveIva > 0 ? Math.max(0, effectiveTotal - effectiveIva) : effectiveTotal;
  }

  const productosList = (datos.Productos && datos.Productos.length > 0)
    ? datos.Productos
    : [{ cantidad: '1', descripcion: 'MERCANCIA GENERAL', precio_unitario: String(effectiveSubtotal), total_item: String(effectiveSubtotal) }];

  const lineCount = productosList.length;

  // 2. Suma bruta de los ítems extraídos para detectar si vienen con IVA incluido
  const rawItemsTotal = productosList.reduce((acc, p) => {
    const cant = limpiarValorNumerico(p.cantidad) || 1;
    const tot = limpiarValorNumerico(p.total_item) || (limpiarValorNumerico(p.precio_unitario) * cant);
    return acc + tot;
  }, 0);

  const hasIva = effectiveIva > 0;
  // Si la suma de los productos está más cerca del Total que del Subtotal, los precios traen IVA incluido
  const isGrossList = hasIva && effectiveTotal > 0 && Math.abs(rawItemsTotal - effectiveTotal) < Math.abs(rawItemsTotal - effectiveSubtotal);

  // Tasa efectiva de IVA (ej. 19% o proporcional)
  const effectiveIvaRate = hasIva && effectiveSubtotal > 0 ? (effectiveIva / effectiveSubtotal) : (hasIva ? 0.19 : 0.0);
  const ivaPercentStr = (effectiveIvaRate * 100).toFixed(2);

  const productosXmlLines = productosList.map((p, index) => {
    const cantNum = limpiarValorNumerico(p.cantidad) || 1;
    const rawTotalItem = limpiarValorNumerico(p.total_item) || (limpiarValorNumerico(p.precio_unitario) * cantNum) || (effectiveSubtotal / lineCount);
    
    // Si la lista de productos venía con IVA incluido, desglosamos la Base Gravable (sin IVA) para Siigo
    let lineBaseAmount: number;
    let lineIvaAmount: number;

    if (isGrossList) {
      lineBaseAmount = Math.round((rawTotalItem / (1 + effectiveIvaRate)) * 100) / 100;
      lineIvaAmount = Math.round((rawTotalItem - lineBaseAmount) * 100) / 100;
    } else if (hasIva) {
      lineBaseAmount = Math.round(rawTotalItem * 100) / 100;
      lineIvaAmount = Math.round((lineBaseAmount * effectiveIvaRate) * 100) / 100;
    } else {
      lineBaseAmount = Math.round(rawTotalItem * 100) / 100;
      lineIvaAmount = 0.0;
    }

    const unitPriceBase = cantNum > 0 ? (lineBaseAmount / cantNum) : lineBaseAmount;
    const descEscaped = escapeXml(p.descripcion || 'PRODUCTO');

    return `    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="94">${cantNum.toFixed(2)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${lineBaseAmount.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${lineIvaAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="COP">${lineBaseAmount.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="COP">${lineIvaAmount.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>${ivaPercentStr}</cbc:Percent>
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
        <cbc:PriceAmount currencyID="COP">${unitPriceBase.toFixed(2)}</cbc:PriceAmount>
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
    <cbc:TaxAmount currencyID="COP">${effectiveIva.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${effectiveSubtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${effectiveIva.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${ivaPercentStr}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${effectiveSubtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${effectiveSubtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${effectiveTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="COP">0.00</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="COP">0.00</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="COP">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="COP">${effectiveTotal.toFixed(2)}</cbc:PayableAmount>
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
  const pdfBytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(PDF_CONTENT_STRING)
    : Buffer.from(PDF_CONTENT_STRING, 'utf-8');
  zip.file(pdfFilenameInside, pdfBytes);

  let zipBase64 = '';
  try {
    zipBase64 = await zip.generateAsync({ type: 'base64' });
  } catch (e) {
    console.error('Error generando zip base64:', e);
  }

  return { attachedXml, invoiceXml, zipFilename, xmlFilenameInside, pdfFilenameInside, zipBase64 };
}

/**
 * Descarga en el navegador un archivo XML
 */
export function downloadXmlBlob(content: string, filename: string) {
  if (!content || typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga en el navegador el paquete ZIP oficial de Siigo Nube
 */
export async function downloadSiigoZipPackage(
  fields: FacturaDatos,
  xmlContent: string,
  targetZipFilename: string,
  xmlFilenameInside: string,
  pdfFilenameInside: string
) {
  if (typeof window === 'undefined') return;
  const zip = new JSZip();
  zip.file(xmlFilenameInside, xmlContent);
  const pdfBytes = new TextEncoder().encode(PDF_CONTENT_STRING);
  zip.file(pdfFilenameInside, pdfBytes);

  const contentBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(contentBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = targetZipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga en el navegador la plantilla CSV de compras para Siigo
 */
export function downloadSiigoCsvTemplate(
  fields: FacturaDatos,
  productos: ProductoItem[]
) {
  if (typeof window === 'undefined') return;
  const activeBuyerNit = fields.BuyerNIT || '901584216';
  const activeBuyerName = fields.BuyerName || 'MI EMPRESA SAS';

  const headers = [
    "NIT Proveedor", "Nombre Proveedor", "NIT Comprador", "Empresa Compradora",
    "Fecha Emision", "Subtotal", "IVA", "Total Factura", "Cantidad",
    "Descripcion Producto", "Precio Unitario", "Total Producto"
  ];

  const rows = (productos.length > 0 ? productos : [{
    cantidad: "1", descripcion: "Mercancia General",
    precio_unitario: fields.Subtotal, total_item: fields.Subtotal
  }]).map(p => [
    `"${fields.NIT}"`,
    `"${(fields.NombreProveedor || '').replace(/"/g, '""')}"`,
    `"${activeBuyerNit}"`,
    `"${activeBuyerName.replace(/"/g, '""')}"`,
    `"${fields.Fecha}"`,
    `"${fields.Subtotal}"`,
    `"${fields.IVA}"`,
    `"${fields.Total}"`,
    `"${p.cantidad}"`,
    `"${p.descripcion.replace(/"/g, '""')}"`,
    `"${p.precio_unitario}"`,
    `"${p.total_item}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantilla_compras_siigo_${fields.NIT}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
