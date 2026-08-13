'use client';

import React from 'react';
import {
  FileText,
  Receipt,
  LayoutDashboard,
  History,
  Building2,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      icon: LayoutDashboard,
    },
    {
      id: 'uploader' as const,
      label: 'Analizar Factura',
      icon: Sparkles,
    },
    {
      id: 'history' as const,
      label: 'Historial',
      icon: History,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#17181D] border-r border-[#292C35] text-slate-100 select-none">
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E09145] text-[#17181D] flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block leading-none">
              FacturaAI
            </span>
            <span className="text-[10px] font-semibold text-[#FCD9B8]/80 tracking-wider uppercase mt-1 block">
              Contabilidad
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 space-y-1.5 overflow-y-auto">
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
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-[#E09145] text-[#17181D]'
                  : 'text-slate-400 hover:text-white hover:bg-[#292C35]'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-[#17181D]' : 'text-slate-400 group-hover:text-[#E09145]'
                }`}
              />
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Company Switcher in Footer */}
      <div className="p-4 space-y-3 border-t border-[#292C35]">
        <button
          onClick={() => {
            onOpenCompanyModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl border border-[#292C35] bg-[#292C35]/50 hover:bg-[#292C35] hover:border-[#E09145]/40 transition-all duration-200 text-left group hover:scale-[1.01] active:scale-[0.98] shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#17181D] text-[#E09145] flex items-center justify-center shrink-0 group-hover:bg-[#E09145]/15 transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-200 group-hover:text-[#FCD9B8] transition-colors truncate">
                {activeBuyerName || 'MI EMPRESA SAS'}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                NIT: {activeBuyerNit || '901584216'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#E09145] group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Theme Toggle Button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400 font-medium">Tema</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 text-slate-400 hover:text-[#FCD9B8] hover:bg-[#292C35] rounded-lg transition-transform active:scale-90"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#E09145]" /> : <Moon className="w-4 h-4" />}
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
