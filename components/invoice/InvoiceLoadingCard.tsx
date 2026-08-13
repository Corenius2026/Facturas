'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ScanLine, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

interface InvoiceLoadingCardProps {
  buyerNit?: string;
}

const STEPS = [
  { id: 1, text: 'Optimizando resolución y ángulo...' },
  { id: 2, text: 'Extrayendo proveedor, NIT y fecha...' },
  { id: 3, text: 'Discriminando ítems, precios e IVA...' },
  { id: 4, text: 'Generando estructura contable y XML...' },
];

export const InvoiceLoadingCard: React.FC<InvoiceLoadingCardProps> = ({ buyerNit }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-border rounded-xl bg-card p-6 sm:p-8 flex flex-col items-center justify-center min-h-[360px] animate-fade-in shadow-xs relative overflow-hidden">
      {/* Background Subtle Grid Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(#292C35_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* Animated Invoice Scanning Illustration */}
      <div className="relative w-48 h-56 bg-[#17181D] border border-[#292C35] rounded-xl p-4 shadow-xl flex flex-col justify-between overflow-hidden mb-6 group">
        {/* Laser Scanning Beam */}
        <div className="absolute left-0 right-0 h-1 bg-[#E09145] shadow-[0_0_10px_#E09145] animate-laser-scan z-10" />

        {/* Invoice Top Header Skeleton */}
        <div className="space-y-2 border-b border-[#292C35] pb-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-2 bg-[#E09145]/60 rounded-full animate-pulse" />
            <div className="w-12 h-2 bg-[#292C35] rounded-full" />
          </div>
          <div className="w-24 h-2.5 bg-[#292C35] rounded-full mx-auto" />
          <div className="w-16 h-1.5 bg-[#292C35]/70 rounded-full mx-auto" />
        </div>

        {/* Invoice Body Items Skeleton */}
        <div className="space-y-2 py-2 flex-1">
          <div className="flex justify-between items-center">
            <div className="w-20 h-2 bg-[#292C35] rounded-full" />
            <div className="w-8 h-2 bg-[#E09145]/40 rounded-full animate-pulse" />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-16 h-2 bg-[#292C35] rounded-full" />
            <div className="w-10 h-2 bg-[#E09145]/40 rounded-full animate-pulse" />
          </div>
          <div className="flex justify-between items-center">
            <div className="w-24 h-2 bg-[#292C35] rounded-full" />
            <div className="w-7 h-2 bg-[#E09145]/40 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Invoice Bottom Total Skeleton */}
        <div className="border-t border-[#292C35] pt-2 flex justify-between items-center">
          <div className="w-10 h-2.5 bg-[#292C35] rounded-full" />
          <div className="w-14 h-3 bg-[#E09145] rounded-full animate-pulse" />
        </div>
      </div>

      {/* Main Title & Rotating Step */}
      <div className="text-center space-y-2 relative z-10 max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E09145]/10 border border-[#E09145]/20 text-[#E09145] text-xs font-bold mb-1">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Analizando Factura con Inteligencia Artificial</span>
        </div>

        <h3 className="text-sm font-bold text-foreground transition-all duration-300">
          {STEPS[currentStep].text}
        </h3>

        {buyerNit && (
          <p className="text-[11px] text-muted-foreground font-mono">
            Integrando datos para NIT: {buyerNit}
          </p>
        )}
      </div>

      {/* Progress Dots */}
      <div className="flex items-center gap-2 mt-4 relative z-10">
        {STEPS.map((step, idx) => (
          <div
            key={step.id}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === currentStep
                ? 'w-6 bg-[#E09145]'
                : idx < currentStep
                ? 'w-2 bg-[#E09145]/40'
                : 'w-2 bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
