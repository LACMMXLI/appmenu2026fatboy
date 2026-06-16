import React, { useEffect, useState } from 'react';
import { Star, Flame, Phone, ChevronRight, Lock, CreditCard, LogOut, Store, Gift, Zap, ShieldCheck } from 'lucide-react';
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
    <div className={cn('flex flex-col gap-1.5 px-3 h-full overflow-hidden py-1.5 justify-start')}>
      {/* User Info Card */}
      {isAuthenticated ? (
        <div className="flex flex-col gap-1.5 h-full justify-start overflow-hidden">
          {/* User Info Card */}
          <div className="bg-surface border border-outline/50 p-2 rounded-lg flex items-center gap-2.5 relative overflow-hidden shrink-0">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>
            <div className="w-9 h-9 rounded-full border border-primary overflow-hidden shrink-0 relative z-10 p-[1px]">
              <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center font-display text-sm font-bold text-primary">
                {customer?.name ? customer.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
            <div className="relative z-10">
              <h2 className="font-display text-sm font-black tracking-wide leading-none mb-0.5 text-white uppercase">{customer?.name || 'Cliente Fatboy'}</h2>
              <div className="inline-flex items-center gap-0.5 bg-surface-light border border-accent/30 px-1 py-0.2 rounded-full">
                <Star size={6} className="text-accent" fill="currentColor" />
                <span className="text-[7.5px] font-bold text-accent uppercase">Miembro Fatboy</span>
              </div>
            </div>
          </div>

          {/* Points Card */}
          <div className="bg-surface border border-outline/50 p-2 rounded-lg shrink-0">
            <div className="flex justify-between items-start mb-1">
              <div>
                <h3 className="font-bold text-accent text-xs mb-0.5 leading-none">Puntos Fatboy</h3>
                <div className="flex items-baseline gap-0.5">
                  <span className="font-display text-xl leading-none">{points}</span>
                  <span className="text-gray-400 font-bold text-[10px]">pts</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Flame size={12} className="text-accent" />
              </div>
            </div>
            
            <div className="mb-1 w-full">
              <div className="flex justify-between text-[8.5px] font-bold text-gray-400 mb-0.5">
                <span>Progreso</span>
                <span>{missingPoints > 0 ? `${missingPoints} pts faltantes` : '¡Meta alcanzada!'}</span>
              </div>
              <div className="w-full h-1 bg-surface-light rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-primary relative animate-pulse" style={{ width: `${progressPercent}%` }}>
                  <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                </div>
              </div>
            </div>
            <p className="text-[9.5px] text-gray-400 flex items-center gap-0.5 font-semibold mb-1">
              <span className="text-primary tracking-widest text-[11px] leading-none">🎉</span> Bacon Burger gratis a los {targetPoints} pts
            </p>
            <Button onClick={() => onNavigate('rewards')} size="sm" className="w-full bg-accent text-black hover:bg-accent/90 shadow-[0_0_10px_rgba(250,189,0,0.3)] animate-pulse-glow flex gap-1 items-center justify-center py-1 text-[10px] h-7 shrink-0">
              <Gift size={13} />
              <span>CANJEAR PUNTOS</span>
            </Button>
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-1.5 shrink-0">
            <div className="bg-surface border border-outline/50 p-2 rounded-lg flex flex-col gap-0.5">
              <Phone size={12} className="text-gray-400" />
              <div>
                <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Teléfono</span>
                <span className="font-bold text-[10px] text-white leading-none">{customer?.phone || 'Sin registrar'}</span>
              </div>
            </div>
            <div className="bg-surface border border-outline/50 p-2 rounded-lg flex flex-col gap-0.5">
              <Store size={12} className="text-gray-400" />
              <div>
                <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Sucursal Favorita</span>
                <span className="font-bold text-[10px] leading-none block text-white">Fatboy {branchName}</span>
              </div>
            </div>
          </div>

          {/* Contacto & Ayuda */}
          <div className="w-full shrink-0">
            <h3 className="text-[9px] font-bold text-gray-400 tracking-wider mb-0.5 uppercase">Contacto & Ayuda</h3>
            <div className="bg-surface border border-outline/50 rounded-lg overflow-hidden divide-y divide-outline/50">
              <a href="https://wa.me/526861105191" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-[#25D366]" />
                  <span className="text-[10px] font-semibold text-white">WhatsApp Fatboy Venecia</span>
                </div>
                <ChevronRight size={12} className="text-gray-500" />
              </a>
              <a href="https://wa.me/526862761824" target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-[#25D366]" />
                  <span className="text-[10px] font-semibold text-white">WhatsApp Fatboy San Marcos</span>
                </div>
                <ChevronRight size={12} className="text-gray-500" />
              </a>
              <button onClick={() => onNavigate('google-review')} className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-2">
                  <Star size={12} className="text-accent" />
                  <span className="text-[10px] font-semibold text-white">Calificarnos en Google</span>
                </div>
                <ChevronRight size={12} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Configuration */}
          <div className="w-full shrink-0">
            <h3 className="text-[9px] font-bold text-gray-400 tracking-wider mb-0.5 uppercase">Configuración</h3>
            <div className="bg-surface border border-outline/50 rounded-lg overflow-hidden divide-y divide-outline/50">
              {[
                { icon: Lock, label: 'Cambiar Contraseña', action: () => onNavigate('change-password') },
                { icon: CreditCard, label: 'Métodos de Pago', action: () => onNavigate('payment-methods') },
              ].map((item, i) => (
                <button key={i} onClick={item.action} className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-surface-hover transition-colors">
                  <div className="flex items-center gap-2">
                    <item.icon size={12} className="text-gray-400" />
                    <span className="text-[10px] font-semibold text-white">{item.label}</span>
                  </div>
                  <ChevronRight size={12} className="text-gray-500" />
                </button>
              ))}
              <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-surface-hover transition-colors" onClick={handleLogout}>
                <div className="flex items-center gap-2 text-primary">
                  <LogOut size={12} />
                  <span className="text-[10px] font-semibold">Cerrar Sesión</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0 gap-1">
          <section className="relative shrink-0 overflow-hidden rounded-lg border border-white/12 bg-[radial-gradient(circle_at_50%_12%,rgba(232,0,10,0.22),transparent_30%),linear-gradient(135deg,rgba(232,0,10,0.1),rgba(255,255,255,0.025))] px-2.5 py-1.5 text-center shadow-[0_6px_16px_rgba(0,0,0,0.3)] flex flex-col justify-center">
            <div className="pointer-events-none absolute left-7 top-8 h-3 w-3 rounded-full border border-primary/35 bg-primary/25 shadow-[0_0_10px_rgba(232,0,10,0.28)] rotate-[-18deg]" />
            <div className="pointer-events-none absolute right-9 top-8 h-3 w-3 rounded-full border border-primary/35 bg-primary/25 shadow-[0_0_9px_rgba(232,0,10,0.28)] rotate-[18deg]" />
            <div className="pointer-events-none absolute right-16 bottom-8 h-2.5 w-2.5 rounded-full border border-primary/30 bg-primary/20 shadow-[0_0_8px_rgba(232,0,10,0.22)]" />

            <div className="relative mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-primary/70 bg-primary/10 shadow-[0_0_14px_rgba(232,0,10,0.34)] shrink-0">
              <div className="absolute inset-1 rounded-full border border-primary/40" />
              <Star size={14} className="relative text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]" strokeWidth={2.2} />
            </div>

            <h2 className="mx-auto max-w-[245px] text-[13px] font-black leading-[1.05] tracking-tight text-white drop-shadow-md">
              Gana puntos en cada compra
            </h2>
            <p className="mx-auto mt-0.5 max-w-[250px] text-[8.5px] font-semibold leading-tight text-gray-300">
              Regístrate para acumular puntos y obtener beneficios cada vez que ordenas en Fatboy.
            </p>
            <Button
              onClick={() => onNavigate('auth')}
              className="mt-1.5 h-6.5 w-full rounded-md bg-primary text-[8.5px] font-black uppercase tracking-wide text-white shadow-[0_0_12px_rgba(232,0,10,0.28)] animate-pulse-glow shrink-0"
            >
              INICIAR SESIÓN / REGISTRARSE
            </Button>
          </section>

          <div className="flex-1 grid grid-rows-4 gap-1 min-h-0">
            {[
              { icon: Star, title: 'Acumula puntos', description: 'Obtén puntos en cada compra que realices.', tone: 'text-primary' },
              { icon: Gift, title: 'Canjea beneficios', description: 'Usa tus puntos en futuras compras.', tone: 'text-primary' },
              { icon: Zap, title: 'Compra más rápido', description: 'Guarda tu cuenta y ordena más fácil.', tone: 'text-primary' },
              { icon: ShieldCheck, title: 'Registrarte es gratis', description: 'Puedes seguir explorando el menú sin crear una cuenta.', tone: 'text-primary' },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onNavigate('auth')}
                className="group flex w-full items-center gap-2 rounded-md border border-white/10 bg-surface/80 px-2 py-1 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-primary/35 hover:bg-surface-hover min-h-0"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-primary/10 shadow-[0_0_7px_rgba(232,0,10,0.14)]">
                  <item.icon size={12} className={item.tone} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 flex flex-col justify-center">
                  <span className="block text-[9.5px] font-black leading-tight text-white uppercase">{item.title}</span>
                  <span className="block text-[8px] font-semibold leading-tight text-gray-400 mt-0.5">{item.description}</span>
                </span>
                <ChevronRight size={12} className="shrink-0 text-gray-600 transition-colors group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
