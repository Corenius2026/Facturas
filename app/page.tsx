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
  FileArchive
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
  Fecha: string;
  Subtotal: string;
  IVA: string;
  Total: string;
  Productos?: ProductoItem[];
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

export default function MinimarketPOSPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [buyerNit, setBuyerNit] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');

  const [fields, setFields] = useState<InvoiceFields | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [invoiceXmlContent, setInvoiceXmlContent] = useState<string>('');
  const [zipFilename, setZipFilename] = useState<string>('');
  const [xmlFilenameInside, setXmlFilenameInside] = useState<string>('');
  const [pdfFilenameInside, setPdfFilenameInside] = useState<string>('');
  const [zipB64, setZipB64] = useState<string>('');

  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/facturas');
      const data = await res.json();
      setIsDbConnected(data.connected);
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

    try {
      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.detail || 'Error al procesar la factura.');
      }

      setFields(result.fields);
      setProductos(result.productos || result.fields?.Productos || []);
      setRawText(result.raw_text);
      setXmlContent(result.xml_content);
      setInvoiceXmlContent(result.invoice_xml_content || '');
      setZipFilename(result.zip_filename || '');
      setXmlFilenameInside(result.xml_filename_inside || '');
      setPdfFilenameInside(result.pdf_filename_inside || '');
      setZipB64(result.zip_b64 || '');

      showToast('¡Factura analizada e integrada para Siigo!', 'success');
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
    if (!fields || !xmlContent) {
      showToast('No hay factura procesada para descargar.', 'warning');
      return;
    }

    try {
      const nitProvRaw = (fields.NIT || '822007117').replace(/[^0-9]/g, '');
      const nitProvPadded = nitProvRaw.padStart(10, '0');
      const key27 = `08${nitProvPadded}04720260000x39efe`.substring(0, 27);

      const targetZipFilename = zipFilename || `z${key27}.zip`;
      const targetXmlInside = xmlFilenameInside || `ad${key27}.xml`;
      const targetPdfInside = pdfFilenameInside || `fv${key27}.pdf`;

      let zipBlob: Blob;

      if (zipB64) {
        const cleanB64 = zipB64.replace(/[^A-Za-z0-9+/=]/g, '');
        const binaryStr = atob(cleanB64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        zipBlob = new Blob([bytes], { type: 'application/zip' });
      } else {
        const pdfBase64Clean = (
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
        ).replace(/[^A-Za-z0-9+/=]/g, '');

        const pdfBinary = atob(pdfBase64Clean);
        const pdfBytes = new Uint8Array(pdfBinary.length);
        for (let i = 0; i < pdfBinary.length; i++) {
          pdfBytes[i] = pdfBinary.charCodeAt(i);
        }

        const zip = new JSZip();
        zip.file(targetXmlInside, xmlContent);
        zip.file(targetPdfInside, pdfBytes);
        zipBlob = await zip.generateAsync({ type: 'blob' });
      }

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetZipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`¡Paquete ${targetZipFilename} descargado con éxito!`, 'success');
    } catch (err: any) {
      console.error('Error al empaquetar ZIP:', err);
      showToast(err?.message || 'Error al generar el archivo .ZIP', 'error');
    }
  };

  const downloadSiigoCsvFile = () => {
    if (!fields) return;
    const headers = ["NIT Proveedor", "Fecha Emision", "Subtotal", "IVA", "Total Factura", "Cantidad", "Descripcion Producto", "Precio Unitario", "Total Producto"];
    const rows = (productos.length > 0 ? productos : [{ cantidad: "1", descripcion: "Mercancia General", precio_unitario: fields.Subtotal, total_item: fields.Subtotal }]).map(p => [
      `"${fields.NIT}"`,
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
        body: JSON.stringify({ ids: idsToDelete }),
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
      <header className="bg-gradient-to-r from-[#001D39] via-[#0A4174] to-[#001D39] rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-[#49769F]/30 flex items-center justify-between">
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
            <p className="text-[#BDD8E9] text-xs sm:text-sm mt-1 font-medium">Digitalizador de Facturas de Proveedores e Importación a Siigo</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload */}
        <section className="lg:col-span-5 bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAF2F8] pb-3">
              <h2 className="text-base font-bold text-[#001D39] flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#0A4174]" />
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
              <span>{isProcessing ? 'Procesando Documento...' : 'Procesar Factura'}</span>
            </button>
          </div>
        </section>

        {/* Right Column: Extracted Results */}
        <section className="lg:col-span-7 space-y-6 relative">
          {/* Loader Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[#001D39]/85 backdrop-blur-sm border border-[#49769F] rounded-2xl z-40 flex flex-col items-center justify-center gap-4 text-white shadow-2xl">
              <div className="w-14 h-14 border-4 border-[#BDD8E9]/30 border-t-[#7BBDE8] rounded-full animate-spin flex items-center justify-center">
              </div>
              <h3 className="font-bold text-base">Extrayendo Datos y Generando Paquete .ZIP...</h3>
              <p className="text-xs text-[#BDD8E9]">Analizando automáticamente encabezados, productos e integrando formato UBL 2.1...</p>
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
                <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                  <FileArchive className="w-6 h-6 text-[#7BBDE8]" />
                  <div>
                    <h3 className="font-bold text-sm">Archivos para Carga en Siigo Nube</h3>
                    <p className="text-[11px] text-[#BDD8E9]">Selecciona la opción requerida según tu módulo de Siigo</p>
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
                <div className="border-b border-[#EAF2F8] pb-3">
                  <h2 className="text-sm font-extrabold text-[#001D39] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0A4174]" />
                    Encabezado de Compra
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#EAF2F8] border border-[#BDD8E9] rounded-xl p-3">
                    <span className="block text-[11px] font-bold text-[#49769F] uppercase">NIT Proveedor</span>
                    <span className="text-sm font-extrabold text-[#001D39] block mt-0.5">{fields.NIT}</span>
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
              onClick={loadHistory}
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
