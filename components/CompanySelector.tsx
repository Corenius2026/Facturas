'use client';

import React from 'react';
import { Building, Building2, Plus, BookmarkCheck, Trash2 } from 'lucide-react';
import { EmpresaGuardada } from '@/types/invoice';

interface CompanySelectorProps {
  buyerNit: string;
  buyerName: string;
  savedCompanies: EmpresaGuardada[];
  onBuyerNitChange: (val: string) => void;
  onBuyerNameChange: (val: string) => void;
  onSaveCompany: () => void;
  onSelectCompany: (comp: EmpresaGuardada) => void;
  onDeleteCompany: (nit: string, e: React.MouseEvent) => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({
  buyerNit,
  buyerName,
  savedCompanies,
  onBuyerNitChange,
  onBuyerNameChange,
  onSaveCompany,
  onSelectCompany,
  onDeleteCompany,
}) => {
  return (
    <section className="bg-white border-2 border-[#0A4174]/20 hover:border-[#0A4174]/40 rounded-2xl p-5 shadow-sm transition-all">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#001D39] text-[#7BBDE8] rounded-xl shadow-inner">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-[#001D39] text-sm">Tu Empresa en Siigo</h3>
            <p className="text-[11px] text-[#49769F]">
              Ingresa el NIT y Razón Social de tu empresa para que el XML y ZIP sean 100% compatibles con Siigo Nube.
            </p>
          </div>
        </div>

        {/* Botón de Guardar en tu lista */}
        <button
          onClick={onSaveCompany}
          className="bg-[#0A4174] hover:bg-[#001D39] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 text-[#7BBDE8]" />
          <span>Guardar en mi Lista</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input NIT Comprador */}
        <div>
          <label className="block text-[11px] font-bold text-[#001D39] uppercase mb-1">
            NIT de Tu Empresa (Sin dígito de verificación ni puntos):
          </label>
          <input
            type="text"
            value={buyerNit}
            onChange={(e) => onBuyerNitChange(e.target.value)}
            placeholder="Ej: 901584216"
            className="w-full bg-[#EAF2F8]/70 border border-[#BDD8E9] focus:border-[#0A4174] focus:bg-white text-[#001D39] font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
          />
        </div>

        {/* Input Nombre Comprador */}
        <div>
          <label className="block text-[11px] font-bold text-[#001D39] uppercase mb-1">
            Razón Social / Nombre de Tu Empresa:
          </label>
          <input
            type="text"
            value={buyerName}
            onChange={(e) => onBuyerNameChange(e.target.value)}
            placeholder="Ej: DISTRIBUIDORA AHORRA MAX SAS"
            className="w-full bg-[#EAF2F8]/70 border border-[#BDD8E9] focus:border-[#0A4174] focus:bg-white text-[#001D39] font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
          />
        </div>
      </div>

      {/* Selector de Empresas Guardadas */}
      {savedCompanies.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#BDD8E9]/60">
          <div className="text-[11px] font-bold text-[#49769F] uppercase mb-2 flex items-center gap-1.5">
            <BookmarkCheck className="w-3.5 h-3.5 text-[#0A4174]" />
            <span>Empresas Guardadas (Haz clic para alternar al instante):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedCompanies.map((comp) => {
              const isSelected = buyerNit === comp.nit;
              return (
                <div
                  key={comp.nit}
                  onClick={() => onSelectCompany(comp)}
                  className={`cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#001D39] text-white border-[#001D39] shadow-sm'
                      : 'bg-[#EAF2F8] hover:bg-[#BDD8E9] text-[#001D39] border-[#BDD8E9]'
                  }`}
                >
                  <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-[#7BBDE8]' : 'text-[#0A4174]'}`} />
                  <span>
                    {comp.nombre} <strong className="opacity-75">({comp.nit})</strong>
                  </span>
                  <button
                    onClick={(e) => onDeleteCompany(comp.nit, e)}
                    className="ml-1 text-red-400 hover:text-red-600 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Eliminar de mi lista"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
