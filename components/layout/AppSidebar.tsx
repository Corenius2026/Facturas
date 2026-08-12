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
    <div className="flex flex-col h-full bg-background border-r border-border text-foreground">
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Receipt className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base tracking-tight text-foreground">FacturaAI</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 space-y-1 overflow-y-auto">
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Company Switcher in Footer */}
      <div className="p-4 space-y-4">
        <button
          onClick={() => {
            onOpenCompanyModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-accent flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-medium text-foreground truncate">
                {activeBuyerName || 'MI EMPRESA SAS'}
              </span>
              <span className="block text-xs text-muted-foreground">
                NIT: {activeBuyerNit || '901584216'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Theme Toggle Button */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Tema</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 text-muted-foreground"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
