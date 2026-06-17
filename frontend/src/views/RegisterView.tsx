import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Store, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/UserContext';
import { getBranches, type Branch } from '@/lib/api';

interface RegisterViewProps {
  onNavigate: (view: any) => void;
  onRegister: () => void;
}

export function RegisterView({ onNavigate, onRegister }: RegisterViewProps) {
  const { register } = useUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadBranches() {
      try {
        const list = await getBranches();
        setBranches(list);
        if (list.length > 0) {
          setSelectedBranchId(list[0].id);
        }
      } catch (err) {
        // Ignorar
      }
    }
    loadBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name, phone, password, selectedBranchId || undefined);
      onRegister();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto pb-safe overflow-hidden relative px-5">
      {/* Premium ambient glows */}
      <div className="absolute top-[-10%] right-[-15%] w-[80%] h-[40%] rounded-full bg-primary/10 blur-[80px] pointer-events-none z-0 animate-pulse" style={{ animationDuration: '9s' }}></div>
      <div className="absolute bottom-[-10%] left-[-15%] w-[80%] h-[40%] rounded-full bg-gold/5 blur-[90px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="py-4 flex items-center relative h-16 w-full shrink-0 z-10">
        <button 
          onClick={() => onNavigate('auth')} 
          className="text-white/80 hover:text-white transition-all p-2 rounded-xl bg-surface/60 border border-white/5 shadow-md active:scale-95 flex items-center justify-center backdrop-blur-md"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 flex justify-center items-center -ml-9">
          <img 
            src="/images/logo.png" 
            alt="FATBOY" 
            className="h-7 w-auto object-contain relative drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-4 pb-8 z-10">
        <div className="text-center mb-6 animate-fade-in-up s1">
          <span className="text-[9px] font-black tracking-[0.25em] text-primary uppercase mb-1 block">
            Únete al Club
          </span>
          <h1 className="font-display text-4xl tracking-wider text-white uppercase leading-none mb-1">
            CREAR CUENTA
          </h1>
          <p className="text-gray-400 text-xs font-semibold leading-tight">
            Únete a la familia Fatboy y empieza a ganar puntos
          </p>
        </div>

        {error && (
          <div className="w-full flex items-center gap-2 text-xs text-primary border border-primary/20 bg-primary/5 rounded-xl px-4 py-3 mb-4 animate-fade-in-up">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></div>
            <p className="font-bold">{error}</p>
          </div>
        )}

        {/* Form in Glass Card */}
        <div className="w-full bg-surface/55 border border-white/5 backdrop-blur-xl rounded-2xl p-5 shadow-[0_15px_30px_rgba(0,0,0,0.5)] animate-fade-in-up s2">
          <form className="flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
            <Input 
              label="Nombre completo" 
              placeholder="Ej. Juan Pérez" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 text-xs h-11"
            />
            
            <Input 
              label="Teléfono" 
              placeholder="10 dígitos" 
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 text-xs h-11"
            />
            
            <Input 
              label="Contraseña" 
              placeholder="Mínimo 8 caracteres" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 text-xs h-11"
            />
            
            <Input 
              label="Confirmar contraseña" 
              placeholder="Repite tu contraseña" 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-black/35 border-white/5 text-white placeholder:text-gray-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 text-xs h-11"
            />

            {/* Favorite Branch Selection */}
            <div className="mt-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">
                SUCURSAL FAVORITA
              </label>
              <p className="text-[10.5px] text-gray-500 mb-3 leading-snug font-medium">Selecciona la sucursal de donde normalmente pedirás.</p>
              
              <div className="grid grid-cols-2 gap-3">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all h-24 backdrop-blur-md active:scale-95",
                      selectedBranchId === branch.id 
                        ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(232,0,10,0.1)]" 
                        : "border-white/5 bg-black/20 hover:bg-surface-hover hover:border-white/10"
                    )}
                  >
                    {selectedBranchId === branch.id && (
                      <CheckCircle2 size={14} className="absolute top-2 right-2 text-primary" />
                    )}
                    <Store size={20} className={cn("mb-1.5", selectedBranchId === branch.id ? 'text-primary' : 'text-gray-500')} />
                    <span className="font-extrabold text-center text-xs leading-tight text-white uppercase tracking-wide">Fatboy<br/>{branch.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full mt-4 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white rounded-xl shadow-[0_4px_15px_rgba(232,0,10,0.3)] active:scale-[0.98] transition-all duration-200 py-3 uppercase font-extrabold tracking-wider text-xs flex items-center justify-center gap-2" 
              isLoading={loading}
            >
              REGISTRARME <span className="text-sm">→</span>
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 animate-fade-in-up s3 font-semibold">
          ¿Ya tienes cuenta?{' '}
          <button 
            type="button" 
            onClick={() => onNavigate('auth')} 
            className="text-primary font-extrabold hover:underline ml-1"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}
