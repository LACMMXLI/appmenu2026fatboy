import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useStaffSession } from '@/context/StaffSessionContext';

// Sección Seis del plan: al abrir sin sesión válida se muestra
// EXCLUSIVAMENTE el login de personal. Nada de catálogo, nada de acceso de
// clientes, nada de ADMIN_CATALOG_KEY.
export function LoginView() {
  const { login, error } = useStaffSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(username, password);
    } catch {
      // El mensaje de error ya queda expuesto por el contexto (`error`).
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#101010] px-5 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-white/10 bg-[#181818] p-5 shadow-2xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <KeyRound size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Acceso operativo</p>
            <h1 className="font-display text-3xl leading-none">FATBOY PEDIDOS</h1>
            <p className="mt-1 text-xs font-medium leading-relaxed text-gray-400">
              Recepción, aceptación, preparación y entrega — con tu cuenta de personal.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-primary">{error}</p>}
        <Button type="submit" size="lg" className="mt-5 w-full" isLoading={isLoading}>
          Iniciar sesión
        </Button>
      </form>
    </main>
  );
}
