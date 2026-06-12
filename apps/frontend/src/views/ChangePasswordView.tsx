import React, { useState } from 'react';
import { ArrowLeft, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUser } from '@/context/UserContext';

interface ChangePasswordViewProps {
  onNavigate: (view: any) => void;
}

export function ChangePasswordView({ onNavigate }: ChangePasswordViewProps) {
  const { changePassword } = useUser();
  const [success, setSuccess] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        onNavigate('profile');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      <header className="px-6 py-4 flex items-center relative h-20 w-full mb-6 animate-fade-in-up stagger-1 border-b border-white/5 z-20">
        <button onClick={() => onNavigate('profile')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <div className="w-full flex flex-col items-center justify-center">
          <span className="font-display text-3xl tracking-wide text-white leading-none drop-shadow-md">CONTRASEÑA</span>
        </div>
      </header>

      <div className="flex-1 px-5 flex flex-col relative z-10 w-full overflow-y-auto pb-6 no-scrollbar">
        <div className="flex flex-col items-center justify-center mb-8 animate-fade-in-up stagger-2">
          <div className="w-16 h-16 bg-surface-light rounded-full flex items-center justify-center mb-4 border border-outline shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Lock size={28} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 text-center max-w-[280px]">Ingresa tu contraseña actual y la nueva contraseña que deseas usar.</p>
        </div>

        {error && <p className="w-full text-xs text-primary mb-4 text-center border border-primary/20 bg-primary/5 rounded-lg py-2">{error}</p>}

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center -mt-20 animate-fade-in-up">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4 relative">
               <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-pulse-glow"></div>
               <CheckCircle2 size={40} className="text-green-500 relative z-10" />
            </div>
            <h2 className="font-display text-3xl text-white tracking-wide">¡ACTUALIZADA!</h2>
            <p className="text-sm text-gray-400 mt-2">Tu contraseña se ha cambiado con éxito.</p>
          </div>
        ) : (
          <form className="w-full flex flex-col gap-5 animate-fade-in-up stagger-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              <Input 
                label="Contraseña actual" 
                type="password"
                placeholder="••••••••" 
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
              <Input 
                label="Nueva contraseña" 
                type="password"
                placeholder="••••••••" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Input 
                label="Confirmar nueva contraseña" 
                type="password"
                placeholder="••••••••" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full mt-6 bg-primary text-white rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.3)] hover:shadow-[0_0_20px_rgba(229,9,20,0.5)] transition-all hover:scale-[1.02] active:scale-95 animate-pulse-glow" isLoading={loading}>
              GUARDAR CAMBIOS
            </Button>
          </form>
        )}
      </div>

      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"></div>
    </div>
  );
}
