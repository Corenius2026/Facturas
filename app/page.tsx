'use client';

import React, { useState, useEffect } from 'react';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { optimizeInvoiceImage } from '@/lib/image-optimizer';
import {
  generarEstructuraSiigo,
  downloadXmlBlob,
  downloadSiigoZipPackage,
  downloadSiigoCsvTemplate,
} from '@/lib/siigo-xml';
import {
  FacturaDatos,
  ProductoItem,
  EmpresaGuardada,
  SupabaseInvoice,
  ImageOptimizationStats,
  DuplicateNotice,
  ToastNotification as ToastType,
  ProcesarApiResponse,
} from '@/types/invoice';

import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { CompanyModal } from '@/components/company/CompanyModal';
import { InvoiceUploader } from '@/components/invoice/InvoiceUploader';
import { ProcessingStatus } from '@/components/invoice/ProcessingStatus';
import { InvoiceLoadingCard } from '@/components/invoice/InvoiceLoadingCard';
import { InvoiceDetailCard } from '@/components/invoice/InvoiceDetailCard';
import { InvoiceProductTable } from '@/components/invoice/InvoiceProductTable';
import { HistoryTable } from '@/components/history/HistoryTable';
import { ToastNotification } from '@/components/ToastNotification';

export default function MinimarketPOSPage() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'uploader' | 'history'>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // File & Optimization State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [optimizationStats, setOptimizationStats] = useState<ImageOptimizationStats | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Multi-Company State
  const [buyerNit, setBuyerNit] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [savedCompanies, setSavedCompanies] = useState<EmpresaGuardada[]>([]);

  // Processed Invoice State
  const [fields, setFields] = useState<FacturaDatos | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [zipFilename, setZipFilename] = useState<string>('');
  const [xmlFilenameInside, setXmlFilenameInside] = useState<string>('');
  const [pdfFilenameInside, setPdfFilenameInside] = useState<string>('');
  const [duplicateNotice, setDuplicateNotice] = useState<DuplicateNotice | null>(null);

  // History State
  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Auth & RBAC State
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);

  // Toast Notifications
  const [toast, setToast] = useState<ToastType | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync Dark Theme
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('Error syncing theme:', e);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Sincronizar contexto de sesión y RBAC de forma inmediata (Cliente + Servidor)
  useEffect(() => {
    const supabase = createClient();

    // 1. Sincronización instantánea desde la sesión local del navegador
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Usuario');
        setUserName(String(metaName).trim());
        setUserRole('owner');
        setTenantName(`Organización de ${String(metaName).trim()}`);
      }
    }).catch((err) => console.warn('Error leyendo usuario en cliente:', err));

    // 2. Sincronización completa autorizada desde el servidor de base de datos
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.isAuthenticated) {
          if (data.role) setUserRole(data.role);
          if (data.user?.nombre || data.user?.email) {
            setUserName(data.user?.nombre || data.user?.email);
          }
          if (data.tenant?.nombre) setTenantName(data.tenant?.nombre);
        }
      })
      .catch((err) => console.warn('Error sincronizando contexto de sesión:', err));
  }, []);

  // Load Saved Companies from localStorage
  useEffect(() => {
    try {
      // 1. Cargar desde API de Supabase
      fetch('/api/empresas')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.empresas)) {
            setSavedCompanies(data.empresas);
            if (data.empresas.length > 0) {
              setBuyerNit(data.empresas[0].nit);
              setBuyerName(data.empresas[0].nombre);
            } else {
              setBuyerNit('');
              setBuyerName('');
            }
            localStorage.setItem('siigo_saved_companies', JSON.stringify(data.empresas));
          }
        })
        .catch((e) => console.warn('Error sincronizando empresas de Supabase:', e));

      // 2. Caché local instantáneo mientras responde la red
      const raw = localStorage.getItem('siigo_saved_companies');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedCompanies(parsed);
            setBuyerNit(parsed[0].nit);
            setBuyerName(parsed[0].nombre);
          }
        } catch (parseErr) {
          console.warn('Caché local de empresas inválido, limpiando...', parseErr);
          localStorage.removeItem('siigo_saved_companies');
        }
      }
    } catch (e) {
      console.warn('Error leyendo empresas de localStorage:', e);
    }
  }, []);

  // Load History from Supabase
  const loadHistory = async (targetBuyerNit?: string) => {
    try {
      const nitToFilter = (targetBuyerNit !== undefined ? targetBuyerNit : buyerNit).trim();
      const url = nitToFilter
        ? `/api/facturas?buyer_nit=${encodeURIComponent(nitToFilter)}`
        : '/api/facturas';

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.facturas)) {
        setHistory(data.facturas);
      }
    } catch (err) {
      console.error('Error cargando historial de compras:', err);
    }
  };

  useEffect(() => {
    if (buyerNit) {
      loadHistory(buyerNit);
    }
  }, [buyerNit]);

  // Handle File Selection with Client Canvas Compression
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP)', 'error');
      return;
    }

    try {
      const optResult = await optimizeInvoiceImage(file, 1800, 0.84);

      setSelectedFile(optResult.file);
      setPreviewUrl(URL.createObjectURL(optResult.file));
      setOptimizationStats(optResult.stats);
      setDuplicateNotice(null);
    } catch (err: any) {
      console.error('Error al optimizar imagen en cliente:', err);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setOptimizationStats(null);
    }
  };

  // Process Invoice (Post to Backend with Idempotency)
  const processInvoice = async () => {
    if (!selectedFile || isProcessing) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (buyerNit.trim()) formData.append('buyer_nit', buyerNit.trim());
      if (buyerName.trim()) formData.append('buyer_name', buyerName.trim());

      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });

      const result: ProcesarApiResponse = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.detail || 'Error al procesar la factura.');
      }

      if (!buyerNit && result.fields?.BuyerNIT) {
        setBuyerNit(result.fields.BuyerNIT);
      }
      if (!buyerName && result.fields?.BuyerName) {
        setBuyerName(result.fields.BuyerName);
      }

      const activeBuyerNit = buyerNit.trim() || result.fields?.BuyerNIT || '901584216';
      const activeBuyerName = buyerName.trim() || result.fields?.BuyerName || 'MI EMPRESA SAS';

      const fullFields: FacturaDatos = {
        NIT: result.fields?.NIT || 'N/A',
        NombreProveedor: result.fields?.NombreProveedor || '',
        BuyerNIT: activeBuyerNit,
        BuyerName: activeBuyerName,
        Fecha: result.fields?.Fecha || 'N/A',
        Subtotal: String(result.fields?.Subtotal || '0'),
        IVA: String(result.fields?.IVA || '0'),
        Total: String(result.fields?.Total || '0'),
        Productos: result.productos || result.fields?.Productos || [],
      };

      setFields(fullFields);
      setProductos(fullFields.Productos);
      setRawText(result.raw_text || '');

      // Generar XML exacto sincronizado con la empresa activa
      const est = await generarEstructuraSiigo(fullFields, result.numero_factura);
      setXmlContent(est.attachedXml);
      setZipFilename(est.zipFilename);
      setXmlFilenameInside(est.xmlFilenameInside);
      setPdfFilenameInside(est.pdfFilenameInside);

      if (result.duplicate) {
        setDuplicateNotice({
          isDuplicate: true,
          type: result.duplicate_type,
          message: result.message,
        });
      } else {
        setDuplicateNotice(null);
        showToast('¡Factura analizada e integrada con éxito!', 'success');
      }
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error en el procesamiento de la factura', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download XML On-Demand from History
  const downloadHistoryXml = async (invoiceId: string, nit: string) => {
    try {
      const res = await fetch(`/api/facturas?id=${encodeURIComponent(invoiceId)}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.factura?.xml_content) {
        throw new Error(data.error || 'No se encontró el XML de esta factura en Supabase.');
      }

      downloadXmlBlob(data.factura.xml_content, `factura_${nit}_${invoiceId.substring(0, 8)}.xml`);
      showToast('Archivo XML descargado con éxito', 'success');
    } catch (err: any) {
      console.error('Error al descargar XML bajo demanda:', err);
      showToast(err.message || 'Error al descargar el XML de la factura', 'error');
    }
  };

  // Company Actions
  const handleSaveCompany = async (nit: string, name: string) => {
    const updated = savedCompanies.filter((c) => c.nit !== nit);
    updated.unshift({ nit, nombre: name });
    setSavedCompanies(updated);
    setBuyerNit(nit);
    setBuyerName(name);
    localStorage.setItem('siigo_saved_companies', JSON.stringify(updated));
    showToast(`Empresa "${name}" guardada y activada`, 'success');

    // Sincronizar en la base de datos de Supabase en segundo plano
    try {
      await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nit, nombre: name }),
      });
    } catch (e) {
      console.warn('Error sincronizando empresa con BD:', e);
    }
  };

  const handleDeleteCompany = async (nit: string) => {
    const updated = savedCompanies.filter((c) => c.nit !== nit);
    setSavedCompanies(updated);
    localStorage.setItem('siigo_saved_companies', JSON.stringify(updated));
    if (buyerNit === nit && updated.length > 0) {
      setBuyerNit(updated[0].nit);
      setBuyerName(updated[0].nombre);
    }
    showToast('Empresa eliminada de la lista', 'warning');

    // Sincronizar eliminación en Supabase
    try {
      await fetch('/api/empresas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nit }),
      });
    } catch (e) {
      console.warn('Error eliminando empresa de BD:', e);
    }
  };

  // Batch Delete Actions
  const handleDeleteSelected = async (targetIds?: string[]) => {
    const idsToDelete = targetIds || selectedInvoiceIds;
    if (idsToDelete.length === 0) {
      showToast('Selecciona al menos una factura para eliminar', 'warning');
      return;
    }

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

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al eliminar registros.');
      }

      showToast(data.message || 'Factura(s) eliminada(s) con éxito', 'success');
      setSelectedInvoiceIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar las facturas', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getPageHeaderInfo = () => {
    switch (activeTab) {
      case 'uploader':
        return {
          title: 'Analizador de Facturas con IA',
        };
      case 'history':
        return {
          title: 'Historial de Compras Integradas',
        };
      case 'dashboard':
      default:
        return {
          title: 'Panel de Control Contable',
        };
    }
  };

  const headerInfo = getPageHeaderInfo();

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row text-foreground antialiased transition-colors duration-200">
      {/* SaaS Sidebar */}
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeBuyerName={buyerName}
        activeBuyerNit={buyerNit}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        userRole={userRole}
        userName={userName}
        tenantName={tenantName}
      />

      {/* Main Workspace */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Sticky Header */}
        <AppHeader
          title={headerInfo.title}
          activeBuyerName={buyerName}
          activeBuyerNit={buyerNit}
          onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
          onOpenUploader={() => setActiveTab('uploader')}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          userRole={userRole}
          userName={userName}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto animate-fade-in">
          {/* Top KPI Metrics (Always visible or in Dashboard) */}
          <DashboardStats history={history} activeBuyerName={buyerName} />

          {/* View: Dashboard or Uploader */}
          {(activeTab === 'dashboard' || activeTab === 'uploader') && (
            <div className="space-y-6">
              {/* Duplicate Notice (if applicable) */}
              {duplicateNotice && duplicateNotice.isDuplicate && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300 animate-fade-in shadow-xs">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold m-0">
                    {duplicateNotice.message}
                  </p>
                </div>
              )}

              {/* Top Row: Uploader + Invoice Summary / Loading */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Upload Dropzone & Preview */}
                <div className="lg:col-span-4 space-y-4">
                  <InvoiceUploader
                    selectedFile={selectedFile}
                    previewUrl={previewUrl}
                    isProcessing={isProcessing}
                    hasResults={!!fields}
                    optimizationStats={optimizationStats}
                    onFileSelect={handleFileSelect}
                    onClearFile={() => {
                      setSelectedFile(null);
                      setPreviewUrl('');
                      setOptimizationStats(null);
                    }}
                    onProcessInvoice={processInvoice}
                  />
                </div>

                {/* Right Column: Invoice Details, Scanning Animation or Empty State */}
                <div className="lg:col-span-8">
                  {fields ? (
                    <InvoiceDetailCard
                      fields={fields}
                      buyerName={buyerName}
                      buyerNit={buyerNit}
                      zipFilename={zipFilename}
                      onDownloadZip={() => {
                        if (!fields || !xmlContent) return;
                        downloadSiigoZipPackage(fields, xmlContent, zipFilename, xmlFilenameInside, pdfFilenameInside);
                        showToast(`¡Paquete ${zipFilename} descargado!`, 'success');
                      }}
                      onDownloadXml={() => {
                        downloadXmlBlob(xmlContent, xmlFilenameInside || 'factura_dian.xml');
                        showToast('Archivo XML descargado', 'success');
                      }}
                      onCopyXml={() => {
                        if (!xmlContent) return;
                        navigator.clipboard.writeText(xmlContent);
                        showToast('XML copiado al portapapeles', 'success');
                      }}
                      onDownloadCsv={() => {
                        if (!fields) return;
                        downloadSiigoCsvTemplate(fields, productos);
                        showToast('Plantilla CSV descargada', 'success');
                      }}
                    />
                  ) : isProcessing ? (
                    <InvoiceLoadingCard buyerNit={buyerNit} />
                  ) : (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center h-full min-h-[360px] flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#292C35] text-[#E09145] flex items-center justify-center mb-3">
                        <Receipt className="w-7 h-7" />
                      </div>
                      <h3 className="text-base font-bold text-foreground mb-1">Sin Factura Procesada</h3>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Carga o arrastra una imagen de factura en el panel izquierdo para extraer automáticamente los datos contables y generar el archivo XML.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Full-Width Row: Extracted Products Table */}
              {fields && productos && (
                <div className="animate-fade-in w-full">
                  <InvoiceProductTable productos={productos} />
                </div>
              )}
            </div>
          )}

          {/* View: History Table */}
          {(activeTab === 'dashboard' || activeTab === 'history') && (
            <div className="pt-2">
              <HistoryTable
                history={history}
                selectedInvoiceIds={selectedInvoiceIds}
                isDeleting={isDeleting}
                buyerNit={buyerNit}
                onSelectAll={() => {
                  if (selectedInvoiceIds.length === history.length) {
                    setSelectedInvoiceIds([]);
                  } else {
                    setSelectedInvoiceIds(history.map((item) => item.id));
                  }
                }}
                onToggleSelect={(id) => {
                  setSelectedInvoiceIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  );
                }}
                onDeleteSelected={handleDeleteSelected}
                onRefreshHistory={() => loadHistory()}
                onDownloadXml={downloadHistoryXml}
              />
            </div>
          )}
        </main>
      </div>

      {/* Company Selector Modal */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        savedCompanies={savedCompanies}
        activeBuyerNit={buyerNit}
        onSelectCompany={(comp) => {
          setBuyerNit(comp.nit);
          setBuyerName(comp.nombre);
          showToast(`Empresa activa: ${comp.nombre}`, 'success');
        }}
        onSaveNewCompany={handleSaveCompany}
        onDeleteCompany={handleDeleteCompany}
      />

      {/* Floating Toast Notification */}
      <ToastNotification toast={toast} />
    </div>
  );
}
