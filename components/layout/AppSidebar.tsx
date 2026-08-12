'use client';

import React from 'react';
import {
  FileText,
  Receipt,
  LayoutDashboard,
  History,
  Building2,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import { EmpresaGuardada } from '@/types/invoice';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AppSidebarProps {
  activeTab: 'dashboard' | 'uploader' | 'history';
  onTabChange: (tab: 'dashboard' | 'uploader' | 'history') => void;
  activeBuyerName: string;
  activeBuyerNit: string;
  onOpenCompanyModal: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onTabChange,
  activeBuyerName,
  activeBuyerNit,
  onOpenCompanyModal,
  isDark,
  onToggleTheme,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Panel Principal',
      description: 'Resumen y métricas',
      icon: LayoutDashboard,
    },
    {
      id: 'uploader' as const,
      label: 'Analizar Factura',
      description: 'Extracción con Gemini AI',
      icon: Sparkles,
      highlight: true,
    },
    {
      id: 'history' as const,
      label: 'Historial de Facturas',
      description: 'Compras y exportaciones',
      icon: History,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card border-r border-border text-card-foreground">
      {/* Brand Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-sky-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 ring-4 ring-primary/10">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-foreground">FacturaAI</span>
                <Badge variant="siigo" className="text-[9px] px-1.5 py-0">Siigo</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">UBL 2.1 • DIAN Colombia</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
          Navegación
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'}`} />
                <div className="text-left">
                  <div className="font-bold">{item.label}</div>
                  <div className={`text-[10px] ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/70'}`}>
                    {item.description}
                  </div>
                </div>
              </div>
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          );
        })}

        <div className="pt-4 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
          Integración
        </div>
        <div className="p-3 rounded-xl bg-muted/50 border border-border/80 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Motor UBL 2.1 Certificado</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Genera paquetes .ZIP con AttachedDocument XML y PDF válidos para importación en Siigo Nube.
          </p>
        </div>
      </div>

      {/* Active Company Switcher in Footer */}
      <div className="p-3 border-t border-border space-y-2 bg-muted/20">
        <button
          onClick={() => {
            onOpenCompanyModal();
            onCloseMobile();
          }}
          className="w-full p-2.5 rounded-xl border border-border bg-card hover:bg-accent text-left transition-all group flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:scale-105 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Empresa Activa
              </span>
              <span className="block text-xs font-bold text-foreground truncate">
                {activeBuyerName || 'MI EMPRESA SAS'}
              </span>
              <span className="block text-[10px] font-mono text-muted-foreground">
                NIT: {activeBuyerNit || '901584216'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Theme Toggle Button */}
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-[11px] font-medium text-muted-foreground">Modo Visual</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            className="h-7 px-2.5 text-xs gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span>Oscuro</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[85vw] h-full shadow-2xl animate-fade-in z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
