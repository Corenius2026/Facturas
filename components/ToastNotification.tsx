'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ToastNotification as ToastType } from '@/types/invoice';

interface ToastProps {
  toast: ToastType | null;
}

export const ToastNotification: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-lg text-sm font-bold transition-all ${
        toast.type === 'error'
          ? 'bg-[#17181D] border-destructive text-destructive'
          : toast.type === 'warning'
          ? 'bg-[#17181D] border-[#E09145] text-[#E09145]'
          : 'bg-[#17181D] border-[#292C35] text-[#FCD9B8]'
      }`}
    >
      {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
      {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#E09145] shrink-0" />}
      {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#E09145] shrink-0" />}
      <span>{toast.message}</span>
    </div>
  );
};
