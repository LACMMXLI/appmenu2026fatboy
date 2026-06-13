import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '@/context/UserContext';

interface AuthViewProps {
  onNavigate: (view: any) => void;
  onLogin: () => void;
}

export function AuthView({ onNavigate, onLogin }: AuthViewProps) {
  const { login } = useUser();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError('Por favor, ingresa teléfono y contraseña.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(phone, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      <header className="px-6 py-2 flex items-center relative h-12 w-full shrink-0">
        <button onClick={() => onNavigate('home')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface">
          <ArrowLeft size={22} />
        </button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-3 overflow-hidden">
        <img 
          src="/images/logo.png" 
          alt="FATBOY" 
          className="h-20 w-auto object-contain mb-4 animate-fade-in-up stagger-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
        />
        
        <h2 className="font-display text-3xl tracking-wide mb-0.5 animate-fade-in-up stagger-2">BIENVENIDO</h2>
        <p className="text-gray-400 text-xs mb-5 animate-fade-in-up stagger-4">Inicia sesión para continuar</p>

        {error && <p className="w-full text-xs text-primary mb-4 text-center border border-primary/20 bg-primary/5 rounded-lg py-2">{error}</p>}

        <form className="w-full flex flex-col gap-3 animate-fade-in-up stagger-5" onSubmit={handleSubmit}>
          <Input 
            label="Teléfono" 
            placeholder="686 123 4567" 
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input 
            label="Contraseña" 
            placeholder="........" 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <div className="w-full flex justify-end">
            <button type="button" className="text-primary text-xs font-semibold hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <Button type="submit" size="lg" className="w-full mt-2 bg-primary text-white rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.3)] animate-pulse-glow" isLoading={loading}>
            INICIAR SESIÓN
          </Button>
        </form>

        <div className="mt-6 w-full text-center animate-fade-in-up stagger-6">
          <p className="text-sm text-gray-400">
            ¿No tienes cuenta?{' '}
            <button onClick={() => onNavigate('register')} className="text-primary font-semibold hover:underline">
              Regístrate
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
