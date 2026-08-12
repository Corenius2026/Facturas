'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  UploadCloud,
  FileText,
  Calendar,
  Package,
  Tag,
  DollarSign,
  Copy,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  FileCheck2,
  Store,
  Sparkles,
  Layers,
  Trash2,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileArchive,
  Plus,
  BookmarkCheck,
  Check,
  Building,
  X
} from 'lucide-react';
import JSZip from 'jszip';

interface ProductoItem {
  cantidad: string;
  descripcion: string;
  precio_unitario: string;
  total_item: string;
}

interface InvoiceFields {
  NIT: string;
  NombreProveedor?: string;
  BuyerNIT?: string;
  BuyerName?: string;
  Fecha: string;
  Subtotal: string;
  IVA: string;
  Total: string;
  Productos?: ProductoItem[];
}

interface EmpresaGuardada {
  nit: string;
  nombre: string;
}

interface SupabaseInvoice {
  id: string;
  nit: string;
  fecha: string;
  subtotal: string;
  iva: string;
  total: string;
  xml_content: string;
  creado_en: string;
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

function limpiarValorNumerico(strVal: string): number {
  if (!strVal) return 0;
  const num = parseFloat(strVal.replace(/[^0-9.-]+/g, ''));
  return isNaN(num) ? 0 : num;
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

function generarXmlSiigoClient(datos: InvoiceFields) {
  const nitProvRaw = (datos.NIT || '822007117').replace(/[^0-9]/g, '');
  const nitProvPadded = nitProvRaw.padStart(10, '0');
  const provNameEscaped = escapeXml(datos.NombreProveedor || `PROVEEDOR ${nitProvRaw}`);

  const nitBuyerRaw = (datos.BuyerNIT || '901584216').replace(/[^0-9]/g, '');
  const nitBuyer = nitBuyerRaw || '901584216';
  const buyerNameEscaped = escapeXml(datos.BuyerName || 'MI EMPRESA SAS');

  const fecha = datos.Fecha || new Date().toISOString().split('T')[0];
  const numFactura = `FE-${Math.floor(10000 + Math.random() * 90000)}`;

  const cufeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const cudeSha384 = Array.from({ length: 96 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

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

  return { attachedXml, invoiceXml, zipFilename, xmlFilenameInside, pdfFilenameInside };
}

export default function MinimarketPOSPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [buyerNit, setBuyerNit] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [savedCompanies, setSavedCompanies] = useState<EmpresaGuardada[]>([]);
  
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [fields, setFields] = useState<InvoiceFields | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [zipFilename, setZipFilename] = useState<string>('');
  const [xmlFilenameInside, setXmlFilenameInside] = useState<string>('');
  const [pdfFilenameInside, setPdfFilenameInside] = useState<string>('');

  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Cargar empresas guardadas del usuario desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('siigo_empresas_list');
      const activeNit = localStorage.getItem('siigo_active_buyer_nit') || '';
      const activeName = localStorage.getItem('siigo_active_buyer_name') || '';

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedCompanies(parsed);
          setBuyerNit(activeNit || parsed[0].nit);
          setBuyerName(activeName || parsed[0].nombre);
          return;
        }
      }

      // Si hay un NIT activo guardado previamente
      if (activeNit) {
        setBuyerNit(activeNit);
        setBuyerName(activeName);
      }
    } catch (e) {
      console.error('Error loading saved companies:', e);
    }
  }, []);

  const handleSaveCurrentCompany = () => {
    if (!buyerNit.trim()) {
      showToast('Ingresa el NIT de tu empresa en Siigo para guardarla.', 'warning');
      return;
    }
    const cleanNit = buyerNit.replace(/[^0-9]/g, '');
    const cleanName = buyerName.trim() || `EMPRESA ${cleanNit}`;
    
    const existing = savedCompanies.filter(c => c.nit !== cleanNit);
    const updated = [...existing, { nit: cleanNit, nombre: cleanName }];
    setSavedCompanies(updated);
    localStorage.setItem('siigo_empresas_list', JSON.stringify(updated));
    localStorage.setItem('siigo_active_buyer_nit', cleanNit);
    localStorage.setItem('siigo_active_buyer_name', cleanName);
    showToast(`Empresa "${cleanName}" guardada con éxito.`, 'success');
  };

  const handleDeleteCompany = (nitToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCompanies.filter(c => c.nit !== nitToDelete);
    setSavedCompanies(updated);
    localStorage.setItem('siigo_empresas_list', JSON.stringify(updated));
    showToast('Empresa eliminada de tu lista.', 'success');
  };

  const handleSelectCompany = (comp: EmpresaGuardada) => {
    setBuyerNit(comp.nit);
    setBuyerName(comp.nombre);
    localStorage.setItem('siigo_active_buyer_nit', comp.nit);
    localStorage.setItem('siigo_active_buyer_name', comp.nombre);
    
    // Regenerar XML al instante si hay factura activa
    if (fields) {
      const updatedFields = { ...fields, BuyerNIT: comp.nit, BuyerName: comp.nombre };
      setFields(updatedFields);
      const est = generarXmlSiigoClient(updatedFields);
      setXmlContent(est.attachedXml);
      setZipFilename(est.zipFilename);
      setXmlFilenameInside(est.xmlFilenameInside);
      setPdfFilenameInside(est.pdfFilenameInside);
    }
    loadHistory(comp.nit);
    showToast(`Empresa activa seleccionada: ${comp.nombre}`, 'success');
  };

  const handleBuyerNitChange = (val: string) => {
    setBuyerNit(val);
    localStorage.setItem('siigo_active_buyer_nit', val);
    if (fields) {
      const updatedFields = { ...fields, BuyerNIT: val };
      setFields(updatedFields);
      const est = generarXmlSiigoClient(updatedFields);
      setXmlContent(est.attachedXml);
      setZipFilename(est.zipFilename);
      setXmlFilenameInside(est.xmlFilenameInside);
      setPdfFilenameInside(est.pdfFilenameInside);
    }
  };

  const handleBuyerNameChange = (val: string) => {
    setBuyerName(val);
    localStorage.setItem('siigo_active_buyer_name', val);
    if (fields) {
      const updatedFields = { ...fields, BuyerName: val };
      setFields(updatedFields);
      const est = generarXmlSiigoClient(updatedFields);
      setXmlContent(est.attachedXml);
      setZipFilename(est.zipFilename);
      setXmlFilenameInside(est.xmlFilenameInside);
      setPdfFilenameInside(est.pdfFilenameInside);
    }
  };

  const loadHistory = async (targetBuyerNit?: string) => {
    try {
      const nitToUse = (targetBuyerNit !== undefined ? targetBuyerNit : buyerNit).trim();
      const url = nitToUse ? `/api/facturas?buyer_nit=${encodeURIComponent(nitToUse)}` : '/api/facturas';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          showToast(data.error || 'Límite de consultas alcanzado. Espera un momento.', 'warning');
        }
        return;
      }
      if (data.connected && data.facturas) {
        setHistory(data.facturas);
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona una imagen válida (.png, .jpg)', 'warning');
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    processInvoice(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const processInvoice = async (fileToProcess?: File) => {
    const targetFile = fileToProcess || selectedFile;
    if (!targetFile) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', targetFile);
    if (buyerNit.trim()) {
      formData.append('buyer_nit', buyerNit.trim());
    }
    if (buyerName.trim()) {
      formData.append('buyer_name', buyerName.trim());
    }

    try {
      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.detail || 'Error al procesar la factura.');
      }

      // Si el usuario no ha digitado una empresa y la IA detectó una en la foto, sugerirla
      if (!buyerNit && result.fields?.BuyerNIT) {
        setBuyerNit(result.fields.BuyerNIT);
      }
      if (!buyerName && result.fields?.BuyerName) {
        setBuyerName(result.fields.BuyerName);
      }

      const activeBuyerNit = buyerNit.trim() || result.fields?.BuyerNIT || '901584216';
      const activeBuyerName = buyerName.trim() || result.fields?.BuyerName || 'MI EMPRESA SAS';

      const fullFields: InvoiceFields = {
        ...result.fields,
        BuyerNIT: activeBuyerNit,
        BuyerName: activeBuyerName,
      };

      setFields(fullFields);
      setProductos(result.productos || result.fields?.Productos || []);
      setRawText(result.raw_text);

      // Generar XML exacto sincronizado con la empresa activa
      const est = generarXmlSiigoClient(fullFields);
      setXmlContent(est.attachedXml);
      setZipFilename(est.zipFilename);
      setXmlFilenameInside(est.xmlFilenameInside);
      setPdfFilenameInside(est.pdfFilenameInside);

      showToast('¡Factura analizada e integrada con éxito!', 'success');
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error en el procesamiento de la factura', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyXmlToClipboard = () => {
    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    showToast('XML UBL 2.1 copiado al portapapeles', 'success');
  };

  const downloadXmlFile = (xmlStr?: string, filename?: string) => {
    const content = xmlStr || xmlContent;
    if (!content) return;
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') + '_ubl21.xml' : 'factura_dian.xml');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo XML UBL 2.1 descargado', 'success');
  };

  const downloadSiigoZipFile = async () => {
    if (!fields) {
      showToast('No hay factura procesada para descargar.', 'warning');
      return;
    }

    try {
      // Regenerar el XML garantizando que use el BuyerNIT y BuyerName exactos
      const currentFields: InvoiceFields = {
        ...fields,
        BuyerNIT: buyerNit.trim() || '901584216',
        BuyerName: buyerName.trim() || 'MI EMPRESA SAS',
      };

      const est = generarXmlSiigoClient(currentFields);
      const targetZipFilename = est.zipFilename;
      const targetXmlInside = est.xmlFilenameInside;
      const targetPdfInside = est.pdfFilenameInside;

      const pdfBytes = new TextEncoder().encode(PDF_CONTENT_STRING);

      const zip = new JSZip();
      zip.file(targetXmlInside, est.attachedXml);
      zip.file(targetPdfInside, pdfBytes);
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetZipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`¡Paquete ${targetZipFilename} descargado con NIT ${currentFields.BuyerNIT}!`, 'success');
    } catch (err: any) {
      console.error('Error al empaquetar ZIP:', err);
      showToast(err?.message || 'Error al generar el archivo .ZIP', 'error');
    }
  };

  const downloadSiigoCsvFile = () => {
    if (!fields) return;
    const activeBuyerNit = buyerNit.trim() || '901584216';
    const activeBuyerName = buyerName.trim() || 'MI EMPRESA SAS';
    
    const headers = ["NIT Proveedor", "Nombre Proveedor", "NIT Comprador", "Empresa Compradora", "Fecha Emision", "Subtotal", "IVA", "Total Factura", "Cantidad", "Descripcion Producto", "Precio Unitario", "Total Producto"];
    const rows = (productos.length > 0 ? productos : [{ cantidad: "1", descripcion: "Mercancia General", precio_unitario: fields.Subtotal, total_item: fields.Subtotal }]).map(p => [
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
    showToast('Plantilla CSV para Siigo descargada', 'success');
  };

  // Multi-select handlers
  const handleToggleSelect = (id: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoiceIds.length === history.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(history.map(item => item.id));
    }
  };

  const handleDeleteSelected = async (targetIds?: string[]) => {
    const idsToDelete = targetIds || selectedInvoiceIds;
    if (idsToDelete.length === 0) return;

    if (!confirm(`¿Estás seguro de que deseas eliminar ${idsToDelete.length} factura(s)?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/facturas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete, buyer_nit: buyerNit.trim() }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Error al eliminar registros.');
      }

      showToast(result.message || 'Registros eliminados con éxito.', 'success');
      setSelectedInvoiceIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar facturas', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-[#001D39] border-red-500 text-red-200' :
          toast.type === 'warning' ? 'bg-[#001D39] border-amber-500 text-amber-200' :
          'bg-[#001D39] border-[#4E8EA2] text-[#BDD8E9]'
        }`}>
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#7BBDE8]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Clean Premium Header Banner */}
      <header className="bg-gradient-to-r from-[#001D39] via-[#0A4174] to-[#001D39] rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-[#49769F]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center shadow-inner">
            <Store className="w-8 h-8 text-[#7BBDE8]" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Minimarket<span className="text-[#7BBDE8]"> POS</span>
              </h1>
              <span className="bg-[#7BBDE8]/20 border border-[#7BBDE8]/40 text-[#7BBDE8] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Modelo Funcional V1
              </span>
            </div>
            <p className="text-[#BDD8E9] text-xs sm:text-sm mt-1 font-medium">Digitalizador de Facturas con Vinculación de Empresa para Siigo Nube</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Company Setup & Upload */}
        <section className="lg:col-span-5 space-y-6">
          {/* Active Company Config Card */}
          <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAF2F8] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0A4174]" />
                <div>
                  <h2 className="text-sm font-extrabold text-[#001D39] uppercase tracking-wider">
                    Tu Empresa en Siigo (Comprador)
                  </h2>
                  <p className="text-[11px] text-[#49769F]">Configura el NIT con el que cargarás a Siigo</p>
                </div>
              </div>
            </div>

            {/* Saved Companies Quick Switcher */}
            {savedCompanies.length > 0 && (
              <div className="space-y-1.5 bg-[#EAF2F8]/60 p-3 rounded-xl border border-[#BDD8E9]">
                <span className="text-[10px] font-extrabold text-[#49769F] uppercase tracking-wider block">
                  Mis Empresas Guardadas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {savedCompanies.map((comp) => {
                    const isSelected = buyerNit.replace(/[^0-9]/g, '') === comp.nit.replace(/[^0-9]/g, '');
                    return (
                      <div
                        key={comp.nit}
                        onClick={() => handleSelectCompany(comp)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-[#001D39] text-[#7BBDE8] border-[#001D39] shadow-sm'
                            : 'bg-white text-[#001D39] border-[#BDD8E9] hover:bg-[#BDD8E9]/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-[#7BBDE8]" />}
                        <span>{comp.nombre} ({comp.nit})</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCompany(comp.nit, e)}
                          title="Eliminar de mi lista"
                          className="text-red-400 hover:text-red-600 focus:outline-none ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Company Inputs */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-[#001D39] uppercase">
                  NIT de tu Empresa en Siigo:
                </label>
                <input
                  type="text"
                  value={buyerNit}
                  onChange={(e) => handleBuyerNitChange(e.target.value)}
                  placeholder="Escribe el NIT (ej: 900123456)"
                  className="w-full bg-[#EAF2F8]/40 border border-[#BDD8E9] rounded-xl px-3 py-2.5 text-xs text-[#001D39] font-bold focus:outline-none focus:border-[#0A4174] focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold text-[#001D39] uppercase">
                  Razón Social / Nombre de la Empresa:
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => handleBuyerNameChange(e.target.value)}
                  placeholder="Escribe la Razón Social (ej: MI EMPRESA S.A.S.)"
                  className="w-full bg-[#EAF2F8]/40 border border-[#BDD8E9] rounded-xl px-3 py-2.5 text-xs text-[#001D39] font-bold focus:outline-none focus:border-[#0A4174] focus:bg-white transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-[#49769F] font-semibold">
                {buyerNit ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Vinculado: {buyerNit}
                  </span>
                ) : (
                  <span>Ingresa el NIT de tu empresa</span>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleSaveCurrentCompany}
                className="text-[11px] bg-[#001D39] hover:bg-[#0A4174] text-white font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-[#7BBDE8]" />
                <span>Guardar Empresa</span>
              </button>
            </div>
          </div>

          {/* Upload Card */}
          <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAF2F8] pb-3">
                <h2 className="text-sm font-extrabold text-[#001D39] flex items-center gap-2 uppercase tracking-wider">
                  <FileCheck2 className="w-4 h-4 text-[#0A4174]" />
                  Factura de Proveedor
                </h2>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#49769F]/40 hover:border-[#0A4174] bg-[#EAF2F8]/50 hover:bg-[#EAF2F8] transition-all rounded-2xl p-8 text-center cursor-pointer relative group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <div className="w-14 h-14 bg-white border border-[#BDD8E9] rounded-full flex items-center justify-center mx-auto mb-3 text-[#0A4174] shadow-sm group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-7 h-7 text-[#0A4174]" />
                </div>
                <h3 className="font-bold text-sm text-[#001D39]">Arrastra la imagen de la factura</h3>
                <p className="text-xs text-[#49769F] mt-1">o <span className="text-[#0A4174] font-bold underline">explora tus archivos</span> (.jpg, .png)</p>
                
                {selectedFile && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-[#001D39] text-[#7BBDE8] px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow">
                    <FileText className="w-4 h-4" />
                    <span>{selectedFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => processInvoice()}
                disabled={!selectedFile || isProcessing}
                className="w-full bg-[#001D39] hover:bg-[#0A4174] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles className="w-4 h-4 text-[#7BBDE8]" />
                <span>{isProcessing ? 'Procesando Documento...' : 'Procesar Factura para Siigo'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Extracted Results */}
        <section className="lg:col-span-7 space-y-6 relative">
          {/* Loader Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[#001D39]/85 backdrop-blur-sm border border-[#49769F] rounded-2xl z-40 flex flex-col items-center justify-center gap-4 text-white shadow-2xl">
              <div className="w-14 h-14 border-4 border-[#BDD8E9]/30 border-t-[#7BBDE8] rounded-full animate-spin flex items-center justify-center">
              </div>
              <h3 className="font-bold text-base">Extrayendo Datos e Integrando con NIT {buyerNit || 'Empresa'}...</h3>
              <p className="text-xs text-[#BDD8E9]">Generando automáticamente XML UBL 2.1 y paquete .ZIP para Siigo Nube...</p>
            </div>
          )}

          {!fields ? (
            <div className="bg-white border border-[#BDD8E9] rounded-2xl p-12 text-center text-[#49769F] shadow-md">
              <FileText className="w-14 h-14 mx-auto mb-3 text-[#6EA2B3] opacity-60" />
              <h3 className="text-lg font-bold text-[#001D39] mb-1">Sin Factura Procesada</h3>
              <p className="text-xs max-w-md mx-auto">Carga la imagen de una factura en el panel izquierdo para generar automáticamente el paquete .ZIP y la plantilla requerida por Siigo.</p>
            </div>
          ) : (
            <>
              {/* Export Buttons Bar for Siigo */}
              <div className="bg-gradient-to-r from-[#001D39] to-[#0A4174] border border-[#49769F]/40 rounded-2xl p-5 shadow-lg text-white space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <FileArchive className="w-6 h-6 text-[#7BBDE8]" />
                    <div>
                      <h3 className="font-bold text-sm">Archivos de Carga para Siigo Nube</h3>
                      <p className="text-[11px] text-[#BDD8E9]">Empresa Receptora: <strong className="text-[#7BBDE8]">{buyerName || 'MI EMPRESA'} (NIT: {buyerNit || '901584216'})</strong></p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={downloadSiigoZipFile}
                    className="w-full bg-[#7BBDE8] hover:bg-[#6EA2B3] text-[#001D39] font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <FileArchive className="w-4 h-4" />
                    <span>📦 Descargar Paquete .ZIP (Siigo)</span>
                  </button>

                  <button
                    onClick={downloadSiigoCsvFile}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#7BBDE8]" />
                    <span>📊 Plantilla CSV (Compras Masivas)</span>
                  </button>
                </div>
              </div>

              {/* Header Metrics Summary */}
              <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
                <div className="border-b border-[#EAF2F8] pb-3 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-[#001D39] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0A4174]" />
                    Encabezado de Compra
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#EAF2F8] border border-[#BDD8E9] rounded-xl p-3">
                    <span className="block text-[11px] font-bold text-[#49769F] uppercase">NIT Proveedor</span>
                    <span className="text-sm font-extrabold text-[#001D39] block mt-0.5">{fields.NIT}</span>
                    {fields.NombreProveedor && (
                      <span className="text-[10px] text-[#49769F] font-semibold block truncate mt-0.5">{fields.NombreProveedor}</span>
                    )}
                  </div>

                  <div className="bg-[#EAF2F8] border border-[#BDD8E9] rounded-xl p-3">
                    <span className="block text-[11px] font-bold text-[#49769F] uppercase">Fecha Emisión</span>
                    <span className="text-sm font-extrabold text-[#001D39] block mt-0.5">{fields.Fecha}</span>
                  </div>

                  <div className="bg-[#EAF2F8] border border-[#BDD8E9] rounded-xl p-3">
                    <span className="block text-[11px] font-bold text-[#49769F] uppercase">Subtotal</span>
                    <span className="text-sm font-extrabold text-[#001D39] block mt-0.5">${fields.Subtotal}</span>
                  </div>

                  <div className="bg-[#EAF2F8] border border-[#BDD8E9] rounded-xl p-3">
                    <span className="block text-[11px] font-bold text-[#49769F] uppercase">Impuesto IVA</span>
                    <span className="text-sm font-extrabold text-[#001D39] block mt-0.5">${fields.IVA}</span>
                  </div>

                  <div className="col-span-2 sm:col-span-4 bg-[#001D39] rounded-xl p-4 text-white flex justify-between items-center shadow">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#BDD8E9]">
                      <DollarSign className="w-5 h-5 text-[#7BBDE8]" />
                      <span>TOTAL FACTURA PROVEEDOR</span>
                    </div>
                    <span className="text-2xl font-black text-[#7BBDE8]">${fields.Total}</span>
                  </div>
                </div>
              </div>

              {/* Itemized Products Table */}
              <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-[#EAF2F8] pb-3">
                  <h2 className="text-sm font-extrabold text-[#001D39] flex items-center gap-2 uppercase tracking-wider">
                    <ListOrdered className="w-4 h-4 text-[#0A4174]" />
                    Detalle de Productos para Siigo
                  </h2>
                  <span className="bg-[#001D39] text-[#7BBDE8] text-xs font-bold px-3 py-1 rounded-full">
                    {productos.length} Ítems
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#001D39] text-[#BDD8E9] uppercase font-bold text-[11px]">
                        <th className="p-3 rounded-l-lg">Cant</th>
                        <th className="p-3">Descripción del Producto</th>
                        <th className="p-3">Precio Unitario</th>
                        <th className="p-3 text-right rounded-r-lg">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#BDD8E9]/50">
                      {productos.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-[#49769F]">
                            No se detectó tabla detallada de productos.
                          </td>
                        </tr>
                      ) : (
                        productos.map((prod, idx) => (
                          <tr key={idx} className="hover:bg-[#EAF2F8]/60 transition-colors">
                            <td className="p-3 font-extrabold text-[#0A4174]">{prod.cantidad || '1'}</td>
                            <td className="p-3 font-bold text-[#001D39]">{prod.descripcion}</td>
                            <td className="p-3 text-[#49769F] font-semibold">${prod.precio_unitario || '0'}</td>
                            <td className="p-3 text-right font-black text-[#0A4174]">${prod.total_item || '0'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* XML Editor Block */}
              <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#EAF2F8] pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#001D39] uppercase tracking-wider">
                      Estructura XML DIAN UBL 2.1
                    </h2>
                    <p className="text-[11px] text-[#49769F]">Adquirente configurado en XML: <strong className="text-[#0A4174]">{buyerName || 'MI EMPRESA'} (NIT: {buyerNit || '901584216'})</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyXmlToClipboard}
                      className="bg-[#EAF2F8] hover:bg-[#BDD8E9] border border-[#BDD8E9] text-[#001D39] font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar XML</span>
                    </button>
                    <button
                      onClick={() => downloadXmlFile()}
                      className="bg-[#001D39] hover:bg-[#0A4174] text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow"
                    >
                      <Download className="w-3.5 h-3.5 text-[#7BBDE8]" />
                      <span>Descargar XML</span>
                    </button>
                  </div>
                </div>

                <pre className="bg-[#001D39] border border-[#BDD8E9] rounded-xl p-4 font-mono text-xs text-[#7BBDE8] max-h-60 overflow-y-auto leading-relaxed">
                  {xmlContent}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>

      {/* History Section with Multi-select and Delete */}
      <section className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#EAF2F8] pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#001D39]">
              Historial de Compras
            </h2>
            <p className="text-xs text-[#49769F]">Registro de facturas procesadas y guardadas</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {selectedInvoiceIds.length > 0 && (
              <button
                onClick={() => handleDeleteSelected()}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Seleccionados ({selectedInvoiceIds.length})</span>
              </button>
            )}

            <button
              onClick={() => loadHistory()}
              className="bg-[#EAF2F8] hover:bg-[#BDD8E9] border border-[#BDD8E9] text-[#001D39] font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0A4174]" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#001D39] text-[#BDD8E9] uppercase font-bold text-[11px]">
                <th className="p-3 rounded-l-lg w-10 text-center">
                  <button
                    onClick={handleSelectAll}
                    title="Seleccionar todo"
                    className="focus:outline-none"
                  >
                    {history.length > 0 && selectedInvoiceIds.length === history.length ? (
                      <CheckSquare className="w-4 h-4 text-[#7BBDE8]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#BDD8E9]/60 hover:text-white" />
                    )}
                  </button>
                </th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Proveedor (NIT)</th>
                <th className="p-3">Subtotal</th>
                <th className="p-3">IVA</th>
                <th className="p-3">TOTAL</th>
                <th className="p-3 text-right rounded-r-lg">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BDD8E9]/50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#49769F]">
                    Aún no hay compras registradas.
                  </td>
                </tr>
              ) : (
                history.map((item) => {
                  const isSelected = selectedInvoiceIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-[#EAF2F8]' : 'hover:bg-[#EAF2F8]/60'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleSelect(item.id)}
                          className="focus:outline-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#0A4174]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#49769F]/50 hover:text-[#0A4174]" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 font-semibold text-[#001D39]">{item.fecha}</td>
                      <td className="p-3 font-extrabold text-[#0A4174]">{item.nit}</td>
                      <td className="p-3 text-[#49769F] font-semibold">${item.subtotal}</td>
                      <td className="p-3 text-[#49769F] font-semibold">${item.iva}</td>
                      <td className="p-3 font-black text-[#001D39]">${item.total}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => downloadXmlFile(item.xml_content, `factura_${item.nit}.xml`)}
                            className="bg-[#001D39] hover:bg-[#0A4174] text-white px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all shadow-sm"
                            title="Descargar XML"
                          >
                            <Download className="w-3 h-3 text-[#7BBDE8]" />
                            <span>XML</span>
                          </button>
                          
                          <button
                            onClick={() => handleDeleteSelected([item.id])}
                            className="bg-red-100 hover:bg-red-200 text-red-700 p-1.5 rounded-lg transition-all"
                            title="Eliminar factura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
