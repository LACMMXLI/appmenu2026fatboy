import React, { useEffect, useState } from 'react';
import { Star, Flame, MapPin, Phone, ChevronRight, Lock, CreditCard, LogOut, Store, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/Button';
import { getBranches, type Branch } from '@/lib/api';

interface ProfileViewProps {
  onNavigate: (view: any) => void;
}

export function ProfileView({ onNavigate }: ProfileViewProps) {
  const { points, customer, logout, isAuthenticated } = useUser();
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const list = await getBranches();
        setBranches(list);
      } catch (err) {
        // Ignorar
      }
    }
    loadBranches();
  }, []);

  const handleLogout = async () => {
    await logout();
    onNavigate('home');
  };

  const favoriteBranch = branches.find(b => b.id === customer?.favoriteBranchId);
  const branchName = favoriteBranch ? favoriteBranch.name : 'Ninguna seleccionada';

  // Points progress
  const targetPoints = 500;
  const progressPercent = Math.min(100, (points / targetPoints) * 100);
  const missingPoints = Math.max(0, targetPoints - points);

  return (
    <div className="flex-1 overflow-y-auto pt-[20px] pb-[42px] px-3">
      {/* User Info Card */}
      {isAuthenticated ? (
        <div className="bg-surface border border-outline/50 p-3 rounded-xl flex items-center gap-3 mb-2 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl"></div>
          <div className="w-12 h-12 rounded-full border border-primary overflow-hidden shrink-0 relative z-10 p-[1.5px]">
            <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center font-display text-xl font-bold text-primary">
              {customer?.name ? customer.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
          <div className="relative z-10">
            <h2 className="font-display text-lg tracking-wide leading-none mb-1 text-white uppercase">{customer?.name || 'Cliente Fatboy'}</h2>
            <div className="inline-flex items-center gap-1 bg-surface-light border border-accent/30 px-1.5 py-0.5 rounded-full">
              <Star size={8} className="text-accent" fill="currentColor" />
              <span className="text-[8.5px] font-bold text-accent uppercase">Miembro Fatboy</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-outline/50 p-4 rounded-xl flex flex-col items-center justify-center text-center mb-3">
          <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mb-3 text-primary">
            <Star size={32} />
          </div>
          <h2 className="font-display text-xl mb-1 text-white">Únete a la familia</h2>
          <p className="text-xs text-gray-400 mb-4">Inicia sesión para acumular puntos y obtener recompensas gratis.</p>
          <Button onClick={() => onNavigate('auth')} className="w-full bg-primary text-white shadow-[0_0_15px_rgba(229,9,20,0.3)] animate-pulse-glow">
            INICIAR SESIÓN / REGISTRARSE
          </Button>
        </div>
      )}

      {isAuthenticated && (
        <>
          {/* Points Card */}
          <div className="bg-surface border border-outline/50 p-3 rounded-xl mb-2">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-accent text-md mb-0.5 leading-none">Puntos Fatboy</h3>
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-3xl leading-none">{points}</span>
              <span className="text-gray-400 font-bold text-xs">pts</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
            <Flame size={16} className="text-accent" />
          </div>
        </div>
        
        <div className="mb-2 w-full">
          <div className="flex justify-between text-[9.5px] font-bold text-gray-400 mb-1">
            <span>Progreso</span>
            <span>{missingPoints > 0 ? `${missingPoints} pts faltantes` : '¡Meta alcanzada!'}</span>
          </div>
          <div className="w-full h-1.5 bg-surface-light rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-primary relative animate-pulse" style={{ width: `${progressPercent}%` }}>
              <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
            </div>
          </div>
        </div>
        <p className="text-[10.5px] text-gray-400 flex items-center gap-1 font-semibold mb-3">
          <span className="text-primary tracking-widest text-[14px] leading-none mb-0.5">🎉</span> Bacon Burger gratis a los {targetPoints} pts
        </p>
        <Button onClick={() => onNavigate('rewards')} size="sm" className="w-full bg-accent text-black hover:bg-accent/90 shadow-[0_0_10px_rgba(250,189,0,0.3)] animate-pulse-glow flex gap-1.5 items-center justify-center py-2 text-xs">
            <Gift size={15} />
            <span>CANJEAR PUNTOS</span>
          </Button>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-surface border border-outline/50 p-3 rounded-lg flex flex-col gap-1.5">
             <Phone size={16} className="text-gray-400" />
             <div>
               <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Teléfono</span>
               <span className="font-bold text-xs text-white">{customer?.phone || 'Sin registrar'}</span>
             </div>
          </div>
          <div className="bg-surface border border-outline/50 p-3 rounded-lg flex flex-col gap-1.5">
             <Store size={16} className="text-gray-400" />
             <div>
               <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Sucursal Favorita</span>
               <span className="font-bold text-xs leading-tight block text-white">Fatboy {branchName}</span>
             </div>
          </div>
        </div>
        </>
      )}

      {/* Contacto & Ayuda */}
      <div className="w-full mb-3">
        <h3 className="font-display text-lg tracking-wide mb-2">CONTACTO & AYUDA</h3>
        <div className="bg-surface border border-outline/50 rounded-xl overflow-hidden divide-y divide-outline/50">
          <a href="https://wa.me/526861234567" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-2.5">
              <Phone size={16} className="text-[#25D366]" />
              <span className="text-xs font-semibold text-white">WhatsApp Fatboy Venecia</span>
            </div>
            <ChevronRight size={16} className="text-gray-500" />
          </a>
          <a href="https://wa.me/526867654321" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-2.5">
              <Phone size={16} className="text-[#25D366]" />
              <span className="text-xs font-semibold text-white">WhatsApp Fatboy San Marcos</span>
            </div>
            <ChevronRight size={16} className="text-gray-500" />
          </a>
          <button onClick={() => onNavigate('google-review')} className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-2.5">
              <Star size={16} className="text-accent" />
              <span className="text-xs font-semibold text-white">Calificarnos en Google</span>
            </div>
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Configuration */}
      {isAuthenticated && (
        <div className="w-full mb-4">
          <h3 className="font-display text-lg tracking-wide mb-2">CONFIGURACIÓN</h3>
        <div className="bg-surface border border-outline/50 rounded-xl overflow-hidden divide-y divide-outline/50">
          {[
            { icon: Lock, label: 'Cambiar Contraseña', action: () => onNavigate('change-password') },
            { icon: CreditCard, label: 'Métodos de Pago', action: () => onNavigate('payment-methods') },
          ].map((item, i) => (
             <button key={i} onClick={item.action} className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors">

               <div className="flex items-center gap-2.5">
                 <item.icon size={16} className="text-gray-400" />
                 <span className="text-xs font-semibold text-white">{item.label}</span>
               </div>
               <ChevronRight size={16} className="text-gray-500" />
             </button>
          ))}
          <button className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-colors" onClick={handleLogout}>
            <div className="flex items-center gap-2.5 text-primary">
              <LogOut size={16} />
              <span className="text-xs font-semibold">Cerrar Sesión</span>
            </div>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
