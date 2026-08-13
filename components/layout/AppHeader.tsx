'use client';

import React from 'react';
import { Menu, Building2, Sparkles, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  title: string;
  activeBuyerName: string;
  activeBuyerNit: string;
  onOpenCompanyModal: () => void;
  onOpenUploader: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
  userRole?: string | null;
  userName?: string | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  activeBuyerName,
  activeBuyerNit,
  onOpenCompanyModal,
  onOpenUploader,
  isDark,
  onToggleTheme,
  onOpenMobileNav,
  userRole,
  userName,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-border bg-background px-6 py-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileNav}
          className="lg:hidden h-9 w-9 text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* User & Role Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span className="text-foreground font-semibold truncate max-w-[120px]">{userName || 'Usuario'}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E09145]/15 text-[#E09145] border border-[#E09145]/30">
            {userRole ? userRole.toUpperCase() : 'OWNER'}
          </span>
        </div>

        {/* Company Quick Pill */}
        <button
          onClick={onOpenCompanyModal}
          className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Building2 className="w-4 h-4 text-[#E09145]" />
          <span className="max-w-[140px] truncate">{activeBuyerName || 'MI EMPRESA'}</span>
        </button>

        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Cambiar tema"
        >
          {isDark ? <Sun className="w-4 h-4 text-[#E09145]" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* CTA Button */}
        <Button
          onClick={onOpenUploader}
          className="h-9 px-4 font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90"
        >
          <Sparkles className="w-4 h-4 mr-2 text-[#17181D]" />
          <span className="hidden xs:inline">Analizar Factura</span>
        </Button>
      </div>
    </header>
  );
};

