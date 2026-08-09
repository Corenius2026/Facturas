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
  Layers
} from 'lucide-react';

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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');

  const [fields, setFields] = useState<InvoiceFields | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');

  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
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

      showToast('Factura analizada e integrada exitosamente', 'success');
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error en el procesamiento de la factura', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSampleInvoice = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 1050);
    ctx.fillStyle = '#001D39';
    ctx.font = '22px monospace';

    const lineas = [
      'DISTRIBUIDORA ALIMENTOS Y BEBIDAS S.A.S.',
      'NIT: 900.876.543-1',
      'Factura de Venta No. FE-00892',
      'Fecha: 15/10/2025',
      '-----------------------------------------',
      'CANT  DESCRIPCION             VALOR',
      ' 10   Cajas Leche Entera 1L   $450,000',
      '  5   Sacos Arroz 5kg         $180,000',
      '  2   Cajas Gaseosas 1.5L     $170,000',
      '-----------------------------------------',
      'SUBTOTAL: $800,000',
      'IVA (19%): $152,000',
      'TOTAL: $952,000',
      '-----------------------------------------',
      '¡GRACIAS POR SU COMPRA!'
    ];

    let y = 70;
    lineas.forEach(l => {
      ctx.fillText(l, 50, y);
      y += 42;
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const sampleFile = new File([blob], 'factura_ejemplo_minimarket.png', { type: 'image/png' });
      setSelectedFile(sampleFile);
      setPreviewUrl(canvas.toDataURL());
      processInvoice(sampleFile);
    });
  };

  const copyXmlToClipboard = () => {
    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    showToast('XML copiado al portapapeles', 'success');
  };

  const downloadXmlFile = (xmlStr?: string, filename?: string) => {
    const content = xmlStr || xmlContent;
    if (!content) return;
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') + '.xml' : 'factura_siigo.xml');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo XML descargado correctamente', 'success');
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Minimarket<span className="text-[#7BBDE8]"> POS</span>
            </h1>
            <p className="text-[#BDD8E9] text-xs sm:text-sm mt-1 font-medium">Digitalización de Facturas de Proveedores e Inventario</p>
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
              <h3 className="font-bold text-base">Extrayendo Datos de la Factura...</h3>
              <p className="text-xs text-[#BDD8E9]">Analizando automáticamente encabezados y lista de productos...</p>
            </div>
          )}

          {!fields ? (
            <div className="bg-white border border-[#BDD8E9] rounded-2xl p-12 text-center text-[#49769F] shadow-md">
              <FileText className="w-14 h-14 mx-auto mb-3 text-[#6EA2B3] opacity-60" />
              <h3 className="text-lg font-bold text-[#001D39] mb-1">Sin Factura Procesada</h3>
              <p className="text-xs max-w-md mx-auto">Carga la imagen de una factura en el panel izquierdo para visualizar el resumen de la compra y la lista de productos.</p>
            </div>
          ) : (
            <>
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
                    Detalle de Productos
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

              {/* Tabs Viewer */}
              <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex gap-2 border-b border-[#EAF2F8] pb-3">
                  <button
                    onClick={() => setActiveTab('image')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                      activeTab === 'image' ? 'bg-[#001D39] text-[#7BBDE8]' : 'text-[#49769F] hover:text-[#001D39]'
                    }`}
                  >
                    Imagen Original
                  </button>
                  <button
                    onClick={() => setActiveTab('text')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                      activeTab === 'text' ? 'bg-[#001D39] text-[#7BBDE8]' : 'text-[#49769F] hover:text-[#001D39]'
                    }`}
                  >
                    Texto Procesado
                  </button>
                </div>

                {activeTab === 'image' && previewUrl && (
                  <div className="bg-slate-900 border border-[#BDD8E9] rounded-xl overflow-hidden max-h-72 flex items-center justify-center p-2">
                    <img src={previewUrl} alt="Factura Preview" className="max-h-64 object-contain" />
                  </div>
                )}

                {activeTab === 'text' && (
                  <pre className="bg-[#001D39] border border-[#BDD8E9] rounded-xl p-4 font-mono text-xs text-[#BDD8E9] max-h-64 overflow-y-auto leading-relaxed">
                    {rawText}
                  </pre>
                )}
              </div>

              {/* XML Editor Block */}
              <div className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#EAF2F8] pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#001D39] uppercase tracking-wider">
                      Estructura XML Generada
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyXmlToClipboard}
                      className="bg-[#EAF2F8] hover:bg-[#BDD8E9] border border-[#BDD8E9] text-[#001D39] font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
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

      {/* History Section */}
      <section className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex justify-between items-center border-b border-[#EAF2F8] pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#001D39]">
              Historial de Compras
            </h2>
            <p className="text-xs text-[#49769F]">Registro de facturas procesadas y guardadas</p>
          </div>
          <button
            onClick={loadHistory}
            className="bg-[#EAF2F8] hover:bg-[#BDD8E9] border border-[#BDD8E9] text-[#001D39] font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#0A4174]" />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#001D39] text-[#BDD8E9] uppercase font-bold text-[11px]">
                <th className="p-3 rounded-l-lg">Fecha</th>
                <th className="p-3">Proveedor (NIT)</th>
                <th className="p-3">Subtotal</th>
                <th className="p-3">IVA</th>
                <th className="p-3">TOTAL</th>
                <th className="p-3 text-right rounded-r-lg">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BDD8E9]/50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#49769F]">
                    Aún no hay compras registradas.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-[#EAF2F8]/60 transition-colors">
                    <td className="p-3 font-semibold text-[#001D39]">{item.fecha}</td>
                    <td className="p-3 font-extrabold text-[#0A4174]">{item.nit}</td>
                    <td className="p-3 text-[#49769F] font-semibold">${item.subtotal}</td>
                    <td className="p-3 text-[#49769F] font-semibold">${item.iva}</td>
                    <td className="p-3 font-black text-[#001D39]">${item.total}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => downloadXmlFile(item.xml_content, `factura_${item.nit}.xml`)}
                        className="bg-[#001D39] hover:bg-[#0A4174] text-white px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all shadow-sm"
                      >
                        <Download className="w-3 h-3 text-[#7BBDE8]" />
                        <span>XML</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
