import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
    <div className="h-full flex flex-col px-6 py-8 pt-16 bg-background w-full max-w-md mx-auto relative overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center z-10 pb-8">
        <img 
          src="/images/logo.png" 
          alt="FATBOY" 
          className="h-24 w-auto object-contain mb-6 animate-fade-in-up stagger-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
        />
        
        <h2 className="font-display text-3xl tracking-wide mb-1 animate-fade-in-up stagger-2">BIENVENIDO</h2>
        <p className="text-gray-400 text-sm mb-8 animate-fade-in-up stagger-4">Inicia sesión para continuar</p>

        {error && <p className="w-full text-xs text-primary mb-4 text-center border border-primary/20 bg-primary/5 rounded-lg py-2">{error}</p>}

        <form className="w-full flex flex-col gap-4 animate-fade-in-up stagger-5" onSubmit={handleSubmit}>
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

          <Button type="submit" size="lg" className="w-full mt-4 bg-primary text-white rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.3)] animate-pulse-glow" isLoading={loading}>
            INICIAR SESIÓN
          </Button>
        </form>

        <div className="mt-12 w-full text-center animate-fade-in-up stagger-6">
          <p className="text-sm text-gray-400 mb-6">
            ¿No tienes cuenta?{' '}
            <button onClick={() => onNavigate('register')} className="text-primary font-semibold hover:underline">
              Regístrate
            </button>
          </p>

          <div className="relative flex items-center py-5">
            <div className="flex-grow border-t border-outline"></div>
            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase font-semibold">O continúa con</span>
            <div className="flex-grow border-t border-outline"></div>
          </div>

          <div className="flex justify-center gap-4 mt-4">
            <button className="w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <img src="https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9z_hELisAlapwE9LUPh6fcXIfb5vwpbMl4xl9H9TRFPc5NOO8Sb3VSgIBrfRYvW6cUA" alt="Google" className="w-6 h-6" />
            </button>
            <button className="w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.09 2.31-.86 3.59-.8 1.51.05 2.53.53 3.22 1.43-2.61 1.51-2.14 4.88.4 5.91-.71 1.83-1.63 3.84-3.29 5.63zm-4.13-14.86c-.22-1.92 1.48-3.5 3.32-3.77.29 2 55.43 3.8-3.32 3.77z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
