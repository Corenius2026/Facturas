'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Receipt, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasValidSession(true);
        } else {
          // Escuchar evento de recuperación de contraseña si Supabase procesa el hash
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
              setHasValidSession(true);
            }
          });
          return () => subscription.unsubscribe();
        }
      } catch (err) {
        console.warn('Error verificando sesión de recuperación:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password || !confirmPassword) {
      setErrorMessage('Por favor, completa ambos campos de contraseña.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMessage(error.message || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);

      // Cerrar la sesión temporal por seguridad y redirigir a login tras 2 segundos
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      setErrorMessage('Ocurrió un error inesperado al actualizar la contraseña.');
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
          Establece una nueva clave para tu cuenta
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#292C35]/60 border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
        {isSuccess ? (
          /* Success Screen */
          <div className="text-center py-4 space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#E09145]/10 text-[#E09145] flex items-center justify-center mx-auto border border-[#E09145]/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Contraseña actualizada</h2>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                Tu contraseña ha sido restablecida exitosamente. Redirigiendo al inicio de sesión...
              </p>
            </div>

            <div className="pt-2">
              <Link href="/login">
                <Button className="w-full h-10 font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90 border-0">
                  Ir al inicio de sesión ahora
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Reset Password Form */
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">Crear nueva contraseña</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ingresa y confirma tu nueva clave de acceso
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-fade-in font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 h-10 bg-[#17181D] border-border text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    placeholder="Repite la nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
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
                    <span>Actualizando...</span>
                  </>
                ) : (
                  <>
                    <span>Actualizar contraseña</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/80 text-center">
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-[#E09145] font-semibold transition-colors"
              >
                Cancelar y volver
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
