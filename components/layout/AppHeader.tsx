'use client';

import React from 'react';
import { Menu, Building2, Sparkles, Moon, Sun, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
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
  subtitle,
  activeBuyerName,
  activeBuyerNit,
  onOpenCompanyModal,
  onOpenUploader,
  isDark,
  onToggleTheme,
  onOpenMobileNav,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenMobileNav}
          className="lg:hidden h-9 w-9 rounded-xl border-border"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </Button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">{title}</h1>
            <Badge variant="success" className="hidden sm:inline-flex text-[9px] px-1.5 py-0">
              En línea
            </Badge>
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Company Quick Pill */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCompanyModal}
          className="hidden sm:flex items-center gap-2 rounded-xl bg-background border-border hover:border-primary/50 text-xs font-semibold px-3 py-1.5 h-9"
        >
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <span className="max-w-[140px] truncate text-foreground">{activeBuyerName || 'MI EMPRESA'}</span>
          <span className="text-[10px] text-muted-foreground font-mono">({activeBuyerNit || '901584216'})</span>
        </Button>

        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
          title="Cambiar tema"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </Button>

        {/* CTA Button */}
        <Button
          onClick={onOpenUploader}
          size="sm"
          className="rounded-xl gap-1.5 shadow-sm shadow-primary/20 h-9 font-bold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Analizar Factura</span>
        </Button>
      </div>
    </header>
  );
};
