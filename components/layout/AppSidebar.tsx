'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
  LogOut,
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
  userRole?: string | null;
  userName?: string | null;
  tenantName?: string | null;
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
  userRole,
  userName,
  tenantName,
}) => {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
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
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E09145] text-[#17181D] flex items-center justify-center font-bold shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-base tracking-tight text-white block leading-none truncate">
              {tenantName || 'Mi Organización'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#292C35] text-[#FCD9B8] border border-[#292C35]">
                {userRole ? userRole.toUpperCase() : 'OWNER'}
              </span>
            </div>
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

        {/* Actions: Theme Toggle & Logout */}
        <div className="flex items-center justify-between pt-2 border-t border-[#292C35]/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-8 px-2.5 text-xs text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg gap-2"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 text-slate-400 hover:text-[#FCD9B8] hover:bg-[#292C35] rounded-lg transition-transform active:scale-90"
            title="Cambiar tema"
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
