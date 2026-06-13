import React, { useState } from 'react';
import { ArrowLeft, Heart, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { defaultProductImage, type Product } from '@/lib/api';

interface ProductDetailViewProps {
  onNavigate: (view: string) => void;
  product: Product | null;
}

export function ProductDetailView({ onNavigate, product }: ProductDetailViewProps) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [meatPrep, setMeatPrep] = useState('Término medio');
  const [isLiked, setIsLiked] = useState(false);
  const [notes, setNotes] = useState('');
  
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>([]);

  const extras = [
    { name: 'Queso extra', price: 25 },
    { name: 'Tocino extra', price: 25 },
    { name: 'Aguacate', price: 30 },
    { name: 'Aros de cebolla', price: 25 },
  ];
  
  const removalsList = ['Sin tomate', 'Sin cebolla', 'Sin lechuga', 'Sin salsa'];
  
  const productPrice = product?.price ?? 0;
  const productImage = product?.imageUrl || defaultProductImage;
  
  const handleAddToCart = () => {
    if (!product) {
      onNavigate('menu');
      return;
    }

    const finalExtras = extras.filter(e => selectedExtras.includes(e.name));
    
    addItem({
      id: product.id,
      title: product.name,
      price: productPrice,
      qty,
      img: productImage,
      meatPrep,
      extras: finalExtras,
      removals: selectedRemovals,
      notes,
    });
    onNavigate('cart');
  };

  const toggleExtra = (name: string) => {
    setSelectedExtras(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  if (!product) {
    return (
      <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative px-6 py-8">
        <button onClick={() => onNavigate('menu')} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 hover:scale-105 active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="font-display text-3xl tracking-wide mb-3">PRODUCTO NO SELECCIONADO</h1>
          <p className="text-sm text-gray-400 mb-6">Regresa al menú para elegir un producto.</p>
          <Button onClick={() => onNavigate('menu')}>VER MENÚ</Button>
        </div>
      </div>
    );
  }
  
  const toggleRemoval = (name: string) => {
    setSelectedRemovals(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div className="h-full flex flex-col bg-background w-full max-w-md mx-auto relative overflow-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {/* Header Image Area */}
        <div className="relative h-[340px] bg-background w-full animate-fade-in">
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
          <button onClick={() => onNavigate('menu')} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 hover:scale-105 active:scale-95 transition-all">
            <ArrowLeft size={20} />
          </button>
          <button onClick={() => setIsLiked(!isLiked)} className={cn("w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 active:scale-95", isLiked ? "text-primary" : "text-white hover:bg-black/60")}>
            <Heart size={20} fill={isLiked ? "currentColor" : "none"} className={isLiked ? 'animate-zoom-in' : ''} />
          </button>
        </div>
        <img 
          src={productImage}
          alt={product.name}
          className="w-full h-full object-cover object-center animate-zoom-in group-hover:scale-105 transition-transform duration-700"
          style={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)' }}
        />
      </div>

      <div className="px-6 -mt-4 relative z-10 w-full animate-fade-in-up stagger-1">
        {product.isPromotion && (
          <span className="inline-block bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2 shadow-md">
            PROMO
          </span>
        )}
        
        <div className="flex justify-between items-start mb-2 group">
          <h1 className="font-display text-3xl tracking-wide max-w-[70%] leading-tight group-hover:text-gray-200 transition-colors">{product.name}</h1>
          <span className="font-display text-3xl text-accent tracking-wide drop-shadow-sm group-hover:drop-shadow-[0_0_10px_rgba(250,189,0,0.5)] transition-all">${productPrice}</span>
        </div>
        
        <p className="text-gray-400 text-sm leading-snug mb-8">
          {product.description || product.shortDescription || 'Producto Fatboy'}
        </p>

        {/* Options */}
        <div className="mb-8 w-full animate-fade-in-up stagger-2">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-4">ELIGE TU OPCIÓN DE CARNE</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {['Término medio', 'Bien cocido', '3/4'].map(opt => (
              <button
                key={opt}
                onClick={() => setMeatPrep(opt)}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm border whitespace-nowrap transition-all duration-300 hover:scale-[1.02] active:scale-95",
                  meatPrep === opt 
                    ? "bg-primary border-primary text-white font-semibold shadow-[0_0_15px_rgba(229,9,20,0.4)]" 
                    : "bg-surface border-outline text-gray-300 hover:border-gray-500 hover:text-white"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Removals */}
        <div className="mb-8 w-full animate-fade-in-up stagger-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-4">MODIFICACIONES</h3>
          <div className="flex flex-wrap gap-2">
            {removalsList.map((rem) => (
              <button
                key={rem}
                onClick={() => toggleRemoval(rem)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300",
                  selectedRemovals.includes(rem) 
                    ? "bg-primary/20 text-primary border border-primary/50" 
                    : "bg-surface text-gray-400 border border-outline hover:text-white hover:border-gray-500"
                )}
              >
                {rem}
              </button>
            ))}
          </div>
        </div>

        {/* Extras */}
        <div className="mb-8 w-full animate-fade-in-up stagger-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-4">EXTRAS</h3>
          <div className="flex flex-col border border-outline rounded-xl overflow-hidden bg-surface divide-y divide-outline shadow-lg transition-colors">
            {extras.map((extra, i) => (
              <label key={i} className="flex justify-between items-center p-4 cursor-pointer hover:bg-surface-hover hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded border border-gray-500 flex items-center justify-center relative overflow-hidden transition-colors group-hover:border-gray-300">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={selectedExtras.includes(extra.name)}
                      onChange={() => toggleExtra(extra.name)}
                    />
                    <div className="absolute inset-0 bg-primary opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                    <div className="w-2.5 h-2.5 bg-white opacity-0 peer-checked:opacity-100 transition-opacity rounded-[2px] z-10"></div>
                  </div>
                  <span className="text-sm text-gray-200 group-hover:text-white">{extra.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-400 group-hover:text-accent transition-colors">+${extra.price}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4 w-full animate-fade-in-up stagger-4">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-4">NOTAS ESPECIALES</h3>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribe aquí alguna nota..." 
            className="w-full bg-surface border border-outline rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_15px_rgba(229,9,20,0.1)] resize-none h-28 transition-all"
          ></textarea>
        </div>
      </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-[#1a1a1a] border-t border-white/5 flex items-center gap-4 z-50 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.6)] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <div className="flex items-center justify-between border border-outline hover:border-gray-500 transition-colors rounded-xl h-14 px-1 w-[120px] bg-surface">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors active:scale-95">
            <Minus size={18} />
          </button>
          <span className="font-bold text-lg w-6 text-center text-white">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors active:scale-95">
            <Plus size={18} />
          </button>
        </div>
        <Button size="lg" className="flex-1 text-[15px] animate-pulse-glow hover:scale-[1.02] active:scale-95 transition-transform" onClick={handleAddToCart}>
          AGREGAR AL CARRITO
        </Button>
      </div>
    </div>
  );
}
