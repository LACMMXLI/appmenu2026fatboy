import React, { useEffect, useState } from 'react';
import { ArrowLeft, Flame, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { getRedeemableProducts, type RedeemableProduct } from '@/lib/api';

interface RewardsViewProps {
  onNavigate: (view: any) => void;
}

export function RewardsView({ onNavigate }: RewardsViewProps) {
  const { points, redeemReward } = useUser();
  const [rewardsItems, setRewardsItems] = useState<RedeemableProduct[]>([]);
  const [redeemedId, setRedeemedId] = useState<string | null>(null);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    getRedeemableProducts()
      .then((items) => {
        if (isMounted) setRewardsItems(items);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'No se pudieron cargar los canjeables.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingRewards(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRedeem = async (item: RedeemableProduct) => {
    try {
      setError('');
      setRedeemingId(item.id);
      await redeemReward(item.id);
      setRedeemedId(item.id);
      setTimeout(() => setRedeemedId(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el canje.');
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      <header className="px-6 py-4 flex items-center relative h-20 w-full mb-2 animate-fade-in-up stagger-1 border-b border-white/5">
        <button onClick={() => onNavigate('profile')} className="absolute left-6 text-white hover:text-gray-300 transition-colors p-2 -ml-2 rounded-full hover:bg-surface active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <div className="w-full flex flex-col items-center justify-center">
          <span className="font-display text-3xl tracking-wide text-accent leading-none drop-shadow-[0_0_10px_rgba(250,189,0,0.5)] text-center">RECOMPENSAS</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 pt-2 px-5">
        {/* Legend */}
        <div className="bg-surface/50 border border-accent/20 rounded-xl p-4 mb-6 flex gap-3 items-start animate-fade-in-up stagger-2 shadow-[0_4px_20px_rgba(250,189,0,0.05)]">
          <Info size={20} className="text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300 leading-relaxed">
            <strong className="text-white">¿Cómo ganar puntos?</strong> Los puntos se generan con las compras realizadas y registradas en el sistema. 
            <span className="text-accent font-semibold block mt-1">Cada 10 pesos de compra = 1 punto.</span>
          </p>
        </div>

        {/* Current Points */}
        <div className="flex items-center justify-between bg-surface border border-outline rounded-2xl p-5 mb-8 animate-fade-in-up stagger-3 shadow-lg relative overflow-hidden group hover:border-accent/10 transition-colors">
           <div className="relative z-10">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">TUS PUNTOS ACTUALES</span>
             <div className="flex items-baseline gap-1.5">
               <span className="font-display text-4xl text-white drop-shadow-sm transition-all">{points}</span>
               <span className="text-gray-400 font-bold text-sm">pts</span>
             </div>
           </div>
           <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center relative z-10 animate-pulse-glow shadow-[0_0_15px_rgba(250,189,0,0.3)] group-hover:scale-110 transition-transform">
             <Flame size={24} className="text-accent" />
           </div>
        </div>

        {/* Rewards List */}
        <div className="flex flex-col gap-4">
          {error && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center text-sm font-semibold text-primary">
              {error}
            </div>
          )}

          {isLoadingRewards && (
            <div className="bg-surface border border-outline rounded-2xl p-8 text-center text-gray-400 font-semibold">
              Cargando canjeables...
            </div>
          )}

          {rewardsItems.map((item, i) => {
            const canAfford = points >= item.pointsCost;
            const isRedeemed = redeemedId === item.id;
            
            return (
              <div key={item.id} className="bg-surface rounded-2xl p-4 flex gap-4 border border-outline/50 relative overflow-hidden group hover:border-accent/40 hover:shadow-[0_8px_20px_rgba(250,189,0,0.1)] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${0.1 * (i + 4)}s` }}>
                <div className="w-[80px] h-[80px] rounded-xl overflow-hidden shrink-0 shadow-md">
                  <img
                    src={item.imageUrl || '/images/logo.png'}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-bold text-[14px] leading-tight text-white mb-1">{item.name}</h3>
                    {item.description && <p className="text-xs text-gray-400 leading-tight mb-1">{item.description}</p>}
                    <span className="font-display text-xl text-accent tracking-wide block leading-none">{item.pointsCost} PTS</span>
                  </div>
                  
                  <div className="mt-2 flex">
                    {isRedeemed ? (
                      <div className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-400/10 px-2 py-1.5 rounded-lg w-fit border border-green-400/20">
                        <CheckCircle2 size={14} /> CANJEADO
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        disabled={!canAfford}
                        onClick={() => handleRedeem(item)}
                        isLoading={redeemingId === item.id}
                        className={cn(
                          "text-xs font-semibold h-8 px-4 rounded-lg shadow-none flex-1 max-w-[120px]",
                          canAfford 
                            ? "bg-accent text-black hover:bg-accent/90 shadow-[0_0_10px_rgba(250,189,0,0.4)] animate-pulse-glow" 
                            : "bg-surface-light text-gray-500 border border-outline pointer-events-none"
                        )}
                      >
                        {canAfford ? 'CANJEAR' : 'FALTAN PUNTOS'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!isLoadingRewards && rewardsItems.length === 0 && (
            <div className="bg-surface border border-outline rounded-2xl p-8 text-center text-gray-500 font-semibold">
              No hay productos canjeables activos por el momento.
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none z-0"></div>
    </div>
  );
}
