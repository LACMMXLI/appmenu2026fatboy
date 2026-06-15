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
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto pb-safe overflow-hidden relative">
      <header className="px-6 py-4 flex items-center relative h-16 w-full shrink-0">
        <button onClick={() => onNavigate('auth')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface">
          <ArrowLeft size={24} />
        </button>
        <div className="w-full flex justify-center items-center">
          <img 
            src="/images/logo.png" 
            alt="FATBOY" 
            className="h-8 w-auto object-contain"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-10 no-scrollbar">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wide mb-2 text-white">CREAR CUENTA</h1>
          <p className="text-gray-400 text-sm">Únete a la familia Fatboy.</p>
        </div>

        {error && <p className="w-full text-xs text-primary mb-4 text-center border border-primary/20 bg-primary/5 rounded-lg py-2">{error}</p>}

        <form className="flex flex-col gap-5 w-full" onSubmit={handleSubmit}>
          <Input 
            label="NOMBRE COMPLETO" 
            placeholder="Ej. Juan Pérez" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input 
            label="TELÉFONO" 
            placeholder="10 dígitos" 
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input 
            label="CONTRASEÑA" 
            placeholder="Mínimo 8 caracteres" 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input 
            label="CONFIRMAR CONTRASEÑA" 
            placeholder="Repite tu contraseña" 
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              SUCURSAL FAVORITA
            </label>
            <p className="text-xs text-gray-500 mb-3">Selecciona la sucursal de donde normalmente pedirás.</p>
            
            <div className="grid grid-cols-2 gap-3">
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all h-28",
                    selectedBranchId === branch.id 
                      ? "border-primary bg-surface/50 shadow-[0_0_15px_rgba(229,9,20,0.15)]" 
                      : "border-outline bg-surface hover:bg-surface-hover"
                  )}
                >
                  {selectedBranchId === branch.id && (
                    <CheckCircle2 size={16} className="absolute top-2 right-2 text-primary" />
                  )}
                  <Store size={24} className={cn("mb-2", selectedBranchId === branch.id ? 'text-white' : 'text-gray-400')} />
                  <span className="font-bold text-center text-sm leading-tight text-white">Fatboy<br/>{branch.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <Button type="submit" size="lg" className="w-full flex items-center justify-center gap-2" isLoading={loading}>
              REGISTRARME <span className="text-xl">→</span>
            </Button>
            <p className="text-center text-sm text-gray-400 mt-6 pb-2">
              ¿Ya tienes cuenta? <button type="button" onClick={() => onNavigate('auth')} className="text-white font-semibold hover:underline">Inicia sesión</button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
