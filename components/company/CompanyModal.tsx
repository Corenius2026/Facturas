'use client';

import React, { useState } from 'react';
import { Building2, X, Plus, Trash2, Check, ShieldCheck } from 'lucide-react';
import { EmpresaGuardada } from '@/types/invoice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedCompanies: EmpresaGuardada[];
  activeBuyerNit: string;
  onSelectCompany: (company: EmpresaGuardada) => void;
  onSaveNewCompany: (nit: string, name: string) => void;
  onDeleteCompany: (nit: string) => void;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({
  isOpen,
  onClose,
  savedCompanies,
  activeBuyerNit,
  onSelectCompany,
  onSaveNewCompany,
  onDeleteCompany,
}) => {
  const [newNit, setNewNit] = useState('');
  const [newName, setNewName] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNit.trim() || !newName.trim()) return;
    onSaveNewCompany(newNit.trim(), newName.trim());
    setNewNit('');
    setNewName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="relative w-full max-w-lg">
        <Card className="shadow-xl border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#292C35] text-[#E09145]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Gestión de Empresas</CardTitle>
                <CardDescription>Configura tus empresas para el aislamiento contable</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-5 pt-5">
            {/* Formulario para agregar nueva empresa */}
            <form onSubmit={handleAdd} className="p-4 rounded-xl border border-border/80 bg-muted/40 space-y-3">
              <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Agregar Nueva Empresa</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    NIT (Sin puntos ni DV)
                  </label>
                  <Input
                    placeholder="Ej: 901584216"
                    value={newNit}
                    onChange={(e) => setNewNit(e.target.value.replace(/[^0-9]/g, ''))}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Razón Social en Siigo
                  </label>
                  <Input
                    placeholder="Ej: MI EMPRESA SAS"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="w-full gap-1.5 font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90 border-0" disabled={!newNit || !newName}>
                <Plus className="w-3.5 h-3.5" />
                <span>Guardar en Mi Lista</span>
              </Button>
            </form>

            {/* Listado de Empresas Guardadas */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Empresas Disponibles ({savedCompanies.length})
              </label>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {savedCompanies.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No tienes empresas guardadas aún. Agrega una arriba.
                  </div>
                ) : (
                  savedCompanies.map((comp) => {
                    const isActive = comp.nit === activeBuyerNit;
                    return (
                      <div
                        key={comp.nit}
                        onClick={() => {
                          onSelectCompany(comp);
                          onClose();
                        }}
                        className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                          isActive
                            ? 'border-[#E09145] bg-[#E09145]/10 text-foreground'
                            : 'border-border bg-card hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-[#E09145] text-[#17181D]' : 'bg-muted text-muted-foreground'}`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold flex items-center gap-2">
                              <span>{comp.nombre}</span>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-[#E09145] text-[#17181D] px-1.5 py-0.5 rounded font-bold">
                                  <Check className="w-3 h-3" /> Activa
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              NIT: {comp.nit}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCompany(comp.nit);
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Eliminar de mi lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                Al seleccionar una empresa, todas las consultas y el historial se aislarán automáticamente bajo su NIT para Siigo Nube.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
