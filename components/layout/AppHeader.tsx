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
}) => {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-border bg-background/95 backdrop-blur-md px-6 py-4 flex items-center justify-between transition-colors">
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

      <div className="flex items-center gap-4">
        {/* Company Quick Pill */}
        <button
          onClick={onOpenCompanyModal}
          className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Building2 className="w-4 h-4" />
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
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* CTA Button */}
        <Button
          onClick={onOpenUploader}
          className="h-9 px-4 font-semibold"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          <span className="hidden xs:inline">Analizar Factura</span>
        </Button>
      </div>
    </header>
  );
};

