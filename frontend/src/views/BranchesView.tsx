import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Store, Navigation, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getBranches, type Branch } from '@/lib/api';

interface BranchesViewProps {
  onNavigate: (view: any) => void;
}

export function BranchesView({ onNavigate }: BranchesViewProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBranches() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getBranches();

        if (!isMounted) return;

        setBranches(response);
        setActiveBranch((current) => current || response[0]?.id || '');
      } catch {
        if (isMounted) {
          setError('No se pudieron cargar las sucursales. Verifica que el backend esté encendido.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBranches();

    return () => {
      isMounted = false;
    };
  }, []);

  const current = branches.find(b => b.id === activeBranch) || branches[0];
  const phoneHref = current?.phone ? `tel:${current.phone.replace(/[^\d+]/g, '')}` : '';
  const mapsHref = current?.mapsUrl || (current?.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(current.address)}` : '');

  const branchPins = useMemo(
    () => branches.map((branch, index) => ({
      ...branch,
      coords: index % 2 === 0 ? { top: '40%', left: '42%' } : { top: '65%', left: '55%' },
    })),
    [branches],
  );

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      <header className="absolute top-0 left-0 w-full px-6 py-4 flex items-center h-20 z-50 animate-fade-in-up stagger-1">
        <button onClick={() => onNavigate('home')} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 hover:scale-105 active:scale-95 transition-all outline-none">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <span className="font-display text-3xl tracking-wide text-white leading-none drop-shadow-md">SUCURSALES</span>
        </div>
      </header>

      <div className="relative w-full h-[280px] overflow-hidden bg-[#0a0a0a] animate-fade-in flex items-center justify-center z-10 transition-all duration-700" style={{ perspective: '1000px' }}>
        <div className="absolute inset-0 z-30 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, #09090b 70%)' }}></div>
        
        <div className="w-[180%] h-[180%] absolute top-[-40%] left-[-40%] transition-transform duration-1000 ease-out group" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(55deg) rotateZ(-25deg)' }}>
          {/* Map Image Stylized */}
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1200&auto=format&fit=crop" alt="Map Map" className="w-full h-full object-cover opacity-[0.35] invert-[0.85] sepia-[0.3] hue-rotate-[320deg] contrast-[1.3] saturate-[2.5]" />
          
          {/* Street grid overlay lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(229,9,20,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(229,9,20,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

          {/* Pins */}
          {branchPins.map(b => (
            <div 
              key={b.id} 
              className={cn(
                "absolute transition-all duration-700 ease-out cursor-pointer",
                activeBranch === b.id ? "scale-[1.3] z-50" : "scale-100 z-40 grayscale-[0.8] opacity-50 hover:grayscale-0 hover:opacity-100"
              )}
              style={{ 
                top: b.coords.top, 
                left: b.coords.left, 
                // Inverse rotation for the pin so it stands upright relative to the rotated map
                transform: `translate(-50%, -50%) rotateZ(25deg) rotateX(-55deg)`,
                transformOrigin: 'center center'
              }}
              onClick={() => setActiveBranch(b.id)}
            >
              <div className="relative flex flex-col items-center">
                {activeBranch === b.id && (
                  <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping" style={{ transform: 'scale(1.5)' }}></div>
                )}
                
                <div className="absolute -bottom-2 w-4 h-1 bg-black/80 blur-[2px] rounded-full"></div>
                
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center relative shadow-[0_15px_30px_rgba(229,9,20,0.6)] transition-all overflow-hidden border-[3px]",
                  activeBranch === b.id ? "bg-primary border-white" : "bg-surface border-primary"
              )}>
                  {activeBranch === b.id ? (
                     <Store size={24} className="text-white relative z-10 animate-zoom-in" />
                  ) : (
                     <Store size={22} className="text-primary relative z-10" />
                  )}
                  {activeBranch === b.id && <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20"></div>}
                </div>
                
                {/* Custom tooltip-like label */}
                <div className={cn(
                  "mt-3 bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-center whitespace-nowrap transition-all duration-300",
                  activeBranch === b.id ? "opacity-100 translate-y-0 shadow-[0_5px_15px_rgba(0,0,0,0.7)]" : "opacity-0 -translate-y-2 pointer-events-none"
                )}>
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">{b.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="flex-1 bg-background relative z-20 -mt-10 rounded-t-[32px] border-t border-white/10 p-6 flex flex-col overflow-y-auto shadow-[0_-15px_40px_rgba(0,0,0,0.7)] pb-6 no-scrollbar">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0"></div>

        {isLoading && (
          <div className="rounded-xl bg-surface border border-outline p-5 text-sm text-gray-300">
            Cargando sucursales...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-surface border border-primary/40 p-5 text-sm text-primary">
            {error}
          </div>
        )}
        
        {!isLoading && !error && current && <div className="flex-1 flex flex-col animate-fade-in-up stagger-3" key={activeBranch}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-display text-4xl text-white tracking-wide mb-1 leading-none drop-shadow-sm">Fatboy {current.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> ABIERTO
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-outline hover:border-gray-500 transition-colors group cursor-default">
              <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors shadow-inner">
                <MapPin size={18} className="text-primary" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">DIRECCIÓN</span>
                <p className="text-sm text-gray-200 leading-snug">{current.address || 'Ubicación pendiente de configurar'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-outline hover:border-gray-500 transition-colors group cursor-default">
              <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors shadow-inner">
                <Store size={18} className="text-accent" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">HORARIO</span>
                <p className="text-sm text-gray-200 leading-snug">{current.hours || 'Horario pendiente de configurar'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-outline hover:border-gray-500 transition-colors group cursor-default">
              <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors shadow-inner">
                <Phone size={18} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">TELÉFONO</span>
                <p className="text-sm text-gray-200 leading-snug">{current.phone || 'Pendiente'}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 flex gap-3">
             {phoneHref ? (
             <a
               href={phoneHref}
               className="inline-flex flex-1 h-14 items-center justify-center rounded-lg bg-surface text-white border border-outline hover:bg-surface-hover hover:border-gray-500 gap-2 font-semibold shadow-none transition-all active:scale-95"
             >
               <Phone size={18} /> LLAMAR
             </a>
             ) : (
             <Button disabled className="flex-1 h-14 bg-surface text-white border border-outline gap-2 font-semibold shadow-none">
               <Phone size={18} /> LLAMAR
             </Button>
             )}
             {mapsHref ? (
             <a
               href={mapsHref}
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex flex-[2] h-14 items-center justify-center rounded-lg gap-2 text-[15px] font-semibold bg-primary text-white shadow-[0_0_20px_rgba(229,9,20,0.3)] animate-pulse-glow hover:scale-[1.02] active:scale-95 transition-transform"
             >
               <Navigation size={18} className="fill-current" /> CÓMO LLEGAR
             </a>
             ) : (
             <Button disabled className="flex-[2] h-14 gap-2 text-[15px] font-semibold bg-primary text-white shadow-[0_0_20px_rgba(229,9,20,0.3)]">
               <Navigation size={18} className="fill-current" /> CÓMO LLEGAR
             </Button>
             )}
          </div>
        </div>}
      </div>
    </div>
  );
}
