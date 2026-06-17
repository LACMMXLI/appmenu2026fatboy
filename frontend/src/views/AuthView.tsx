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
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden px-5 justify-between">
      {/* Premium ambient glows */}
      <div className="absolute top-[-15%] left-[-20%] w-[90%] h-[45%] rounded-full bg-primary/10 blur-[90px] pointer-events-none z-0 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] right-[-15%] w-[80%] h-[40%] rounded-full bg-gold/5 blur-[100px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="py-4 flex items-center relative h-16 w-full shrink-0 z-10">
        <button 
          onClick={() => onNavigate('home')} 
          className="text-white/80 hover:text-white transition-all p-2 rounded-xl bg-surface/60 border border-white/5 shadow-md active:scale-95 flex items-center justify-center backdrop-blur-md"
        >
          <ArrowLeft size={18} />
        </button>
      </header>

      {/* Form Content */}
      <div className="flex-1 flex flex-col justify-center items-center z-10 w-full max-w-sm mx-auto py-2">
        {/* Brand/Logo Section */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="relative mb-3.5">
            <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl scale-125"></div>
            <img 
              src="/images/logo.png" 
              alt="FATBOY" 
              className="h-20 w-auto object-contain relative drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] animate-fade-in s1"
            />
          </div>
          <span className="text-[9px] font-black tracking-[0.25em] text-primary uppercase mb-1 animate-fade-in-up s2">
            Club de Beneficios
          </span>
          <h2 className="font-display text-4xl tracking-wider text-white uppercase leading-none mb-1 animate-fade-in-up s2">
            BIENVENIDO
          </h2>
          <p className="text-gray-400 text-xs font-semibold leading-tight animate-fade-in-up s2">
            Inicia sesión para continuar
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full flex items-center gap-2 text-xs text-primary border border-primary/20 bg-primary/5 rounded-xl px-4 py-3 mb-4 animate-fade-in-up">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></div>
            <p className="font-bold">{error}</p>
          </div>
        )}

        {/* Glass Card Container */}
        <div className="w-full bg-surface/55 border border-white/5 backdrop-blur-xl rounded-2xl p-5 shadow-[0_15px_30px_rgba(0,0,0,0.5)] animate-fade-in-up s3">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input 
              label="Teléfono" 
              placeholder="686 123 4567" 
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 text-xs h-12"
            />
            
            <Input 
              label="Contraseña" 
              placeholder="••••••••" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 text-xs h-12"
            />
            
            <div className="w-full flex justify-end">
              <button 
                type="button" 
                className="text-primary text-[11px] font-bold hover:underline transition-colors py-0.5"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full mt-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white rounded-xl shadow-[0_4px_15px_rgba(232,0,10,0.3)] active:scale-[0.98] transition-all duration-200 py-3 uppercase font-extrabold tracking-wider text-xs flex items-center justify-center gap-2" 
              isLoading={loading}
            >
              INICIAR SESIÓN
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-5 text-center z-10 shrink-0 border-t border-white/5 mt-auto animate-fade-in-up s4">
        <p className="text-xs text-gray-400 font-semibold">
          ¿No tienes cuenta?{' '}
          <button 
            onClick={() => onNavigate('register')} 
            className="text-primary font-extrabold hover:underline transition-colors ml-1"
          >
            Regístrate
          </button>
        </p>
      </footer>
    </div>
  );
}

