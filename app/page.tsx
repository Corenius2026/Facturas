'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Calendar,
  DollarSign,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  Store,
  Sparkles,
  Layers,
  Trash2,
  CheckSquare,
  Square,
  Camera,
  TrendingUp,
  Receipt,
  Package
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

  const [fields, setFields] = useState<InvoiceFields | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [xmlContent, setXmlContent] = useState<string>('');

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
    // Auto procesar al seleccionar
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
      setXmlContent(result.xml_content);

      showToast('¡Factura guardada con éxito!', 'success');
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error analizando la factura', 'error');
    } finally {
      setIsProcessing(false);
    }
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
    showToast('Documento contable descargado', 'success');
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

    if (!confirm(`¿Borrar ${idsToDelete.length} factura(s)?`)) {
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

      showToast(result.message || 'Facturas eliminadas.', 'success');
      setSelectedInvoiceIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar facturas', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Dashboard calculations
  const totalFacturas = history.length;
  const totalGastado = history.reduce((sum, item) => {
    const val = parseFloat(item.total.replace(/[^0-9.-]+/g,""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-900/90 border-red-500 text-red-100' :
          toast.type === 'warning' ? 'bg-amber-900/90 border-amber-500 text-amber-100' :
          'bg-[#001D39]/95 border-[#4E8EA2] text-[#BDD8E9]'
        }`}>
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#7BBDE8]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="bg-[#001D39] rounded-3xl p-5 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center sm:justify-between gap-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-16 h-16 bg-[#0A4174] border border-[#49769F]/50 rounded-2xl flex items-center justify-center shadow-inner">
            <Store className="w-8 h-8 text-[#7BBDE8]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Mi Negocio<span className="text-[#7BBDE8]">.POS</span>
            </h1>
            <p className="text-[#BDD8E9] text-sm mt-1 opacity-90">Gestión de compras e inventario</p>
          </div>
        </div>
      </header>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-[#BDD8E9] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Facturas</p>
            <p className="text-xl font-black text-[#001D39]">{totalFacturas}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-[#BDD8E9] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Total Compras</p>
            <p className="text-xl font-black text-[#001D39]">${totalGastado.toLocaleString('es-CO')}</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload/Camera Zone */}
        <section className="bg-white border border-[#BDD8E9] rounded-3xl p-6 shadow-md flex flex-col justify-center">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#7BBDE8] bg-[#EAF2F8]/50 hover:bg-[#EAF2F8] active:bg-[#BDD8E9]/50 transition-all rounded-3xl p-10 text-center cursor-pointer relative group flex flex-col items-center justify-center min-h-[250px]"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 mb-4">
                  <div className="absolute inset-0 border-4 border-[#BDD8E9] rounded-2xl"></div>
                  <div className="absolute left-0 right-0 h-1 bg-[#0A4174] shadow-[0_0_10px_#0A4174] animate-scan rounded-full"></div>
                </div>
                <h3 className="font-bold text-[#001D39] text-lg">Leyendo Factura...</h3>
                <p className="text-sm text-[#49769F] mt-1 animate-pulse">Extrayendo productos y precios</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-[#001D39] rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg group-hover:scale-105 transition-transform">
                  <Camera className="w-10 h-10" />
                </div>
                <h3 className="font-black text-xl text-[#001D39]">Tomar Foto</h3>
                <p className="text-sm text-[#49769F] mt-2 font-medium">Toca aquí para escanear una factura física o subir una imagen.</p>
              </>
            )}
          </div>
        </section>

        {/* Results / Extracted Data */}
        <section className="bg-white border border-[#BDD8E9] rounded-3xl p-6 shadow-md">
          {!fields ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60 min-h-[250px]">
              <Sparkles className="w-16 h-16 text-[#6EA2B3] mb-4" />
              <h3 className="text-xl font-bold text-[#001D39]">Sin factura activa</h3>
              <p className="text-sm text-[#49769F] max-w-xs mt-2">Toma una foto de tu factura y la IA extraerá todos los datos mágicamente.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-[#001D39] flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Factura Registrada
                </h2>
                <button
                  onClick={() => downloadXmlFile()}
                  className="bg-[#EAF2F8] hover:bg-[#BDD8E9] text-[#0A4174] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  title="Exportar para sistema contable"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Contabilidad</span>
                </button>
              </div>

              {/* Total & Basic Info */}
              <div className="bg-[#001D39] rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div>
                  <p className="text-[#7BBDE8] text-xs font-bold uppercase tracking-wider mb-1">Total a Pagar</p>
                  <p className="text-3xl font-black">${fields.Total}</p>
                </div>
                <div className="flex gap-4 sm:text-right text-sm">
                  <div>
                    <p className="text-[#49769F] font-semibold text-xs">Proveedor</p>
                    <p className="font-bold text-[#BDD8E9]">{fields.NIT}</p>
                  </div>
                  <div>
                    <p className="text-[#49769F] font-semibold text-xs">Fecha</p>
                    <p className="font-bold text-[#BDD8E9]">{fields.Fecha}</p>
                  </div>
                </div>
              </div>

              {/* Responsive Products List */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {productos.length} Productos Identificados
                </h3>
                
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {productos.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No se detectaron productos individuales.</p>
                  ) : (
                    productos.map((prod, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center hover:shadow-sm transition-shadow">
                        <div className="flex-1">
                          <p className="font-extrabold text-[#001D39] text-sm mb-1">{prod.descripcion}</p>
                          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                            <span className="bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">Cant: {prod.cantidad || '1'}</span>
                            <span>Unidad: ${prod.precio_unitario || '0'}</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-black text-[#0A4174] text-base">${prod.total_item || '0'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* History Section */}
      <section className="bg-white border border-[#BDD8E9] rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex justify-between items-center border-b border-[#EAF2F8] pb-4">
          <div>
            <h2 className="text-xl font-black text-[#001D39]">
              Historial
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedInvoiceIds.length > 0 && (
              <button
                onClick={() => handleDeleteSelected()}
                disabled={isDeleting}
                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar ({selectedInvoiceIds.length})</span>
              </button>
            )}

            <button
              onClick={loadHistory}
              className="bg-slate-50 hover:bg-slate-100 text-[#001D39] font-bold p-2 rounded-xl transition-all"
              title="Actualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Responsive History List */}
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-slate-400 py-8 font-medium">
              Aún no hay compras registradas en el historial.
            </div>
          ) : (
            history.map((item) => {
              const isSelected = selectedInvoiceIds.includes(item.id);
              return (
                <div 
                  key={item.id} 
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                    isSelected ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-100 hover:border-[#BDD8E9]'
                  }`}
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button
                      onClick={() => handleToggleSelect(item.id)}
                      className="focus:outline-none p-1"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-[#0A4174]" />
                      ) : (
                        <Square className="w-6 h-6 text-slate-300 hover:text-[#0A4174]" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <p className="font-black text-[#001D39] text-base mb-1">{item.nit}</p>
                      <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.fecha}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto pl-10 sm:pl-0 gap-6">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">Total</p>
                      <p className="font-black text-[#001D39] text-lg">${item.total}</p>
                    </div>
                    
                    <button
                      onClick={() => downloadXmlFile(item.xml_content, `factura_${item.nit}.xml`)}
                      className="bg-[#EAF2F8] hover:bg-[#BDD8E9] text-[#0A4174] p-2.5 rounded-xl transition-all"
                      title="Descargar para Contabilidad"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
