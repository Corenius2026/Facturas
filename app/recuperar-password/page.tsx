'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Receipt, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Por favor, ingresa tu correo electrónico.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      // Solicitar reseteo de contraseña con redirección segura a /auth/reset-password
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/reset-password`,
      });

      // REGLA DE SEGURIDAD: Siempre mostrar mensaje genérico para evitar enumeración de usuarios
      setIsSubmitted(true);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error procesando solicitud de recuperación:', err);
      // Mantener respuesta neutra y segura incluso ante excepciones
      setIsSubmitted(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#17181D] flex flex-col justify-center items-center p-4 sm:p-6 text-foreground antialiased selection:bg-[#E09145]/20 selection:text-[#E09145]">
      {/* Brand Header */}
      <div className="w-full max-w-md mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#292C35] text-[#E09145] mb-3 border border-border">
          <Receipt className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">FacturaAI</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Recuperación segura de acceso a tu cuenta
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#292C35]/60 border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
        {isSubmitted ? (
          /* Confirmation Screen */
          <div className="text-center py-4 space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#E09145]/10 text-[#E09145] flex items-center justify-center mx-auto border border-[#E09145]/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Instrucciones enviadas</h2>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#17181D] border border-border text-[11px] text-muted-foreground text-left space-y-1">
              <p className="font-semibold text-white">¿Qué hacer ahora?</p>
              <p>1. Revisa tu bandeja de entrada o carpeta de spam.</p>
              <p>2. Haz clic en el enlace seguro de restablecimiento.</p>
              <p>3. El enlace tiene un tiempo limitado de validez.</p>
            </div>

            <div className="pt-2">
              <Link href="/login">
                <Button className="w-full h-10 font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90 border-0 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al inicio de sesión</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Request Form Screen */
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">Recupera tu contraseña</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ingresa tu correo para recibir un enlace de restablecimiento
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-fade-in font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="email"
                    placeholder="ejemplo@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-10 bg-[#17181D] border-border text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90 border-0 mt-2 gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar instrucciones</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Footer Link to Login */}
            <div className="mt-6 pt-5 border-t border-border/80 text-center">
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-[#E09145] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al inicio de sesión</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
