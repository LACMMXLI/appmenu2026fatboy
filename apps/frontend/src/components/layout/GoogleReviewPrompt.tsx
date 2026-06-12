import React from 'react';
import { motion } from 'motion/react';
import { Star, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface GoogleReviewPromptProps {
  onClose: () => void;
  onRedirect: () => void;
}

export function GoogleReviewPrompt({ onClose, onRedirect }: GoogleReviewPromptProps) {
  return (
    <div className="absolute inset-0 bg-black/65 z-[9999] flex items-center justify-center p-6 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[300px] bg-white text-gray-900 rounded-2xl p-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)] flex flex-col items-center text-center relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Logo Container */}
        <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-100 bg-gray-50 p-1 mb-4 flex items-center justify-center shadow-inner">
          <img 
            src="/images/logo.png" 
            alt="Fatboy Logo" 
            className="w-full h-full object-contain" 
          />
        </div>

        {/* Text */}
        <h3 className="font-sans font-extrabold text-[15px] text-gray-900 mb-1.5 uppercase tracking-wide">
          ¿Te gusta Fatboy? 🍔
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-4 font-medium px-1">
          Déjanos una calificación en Google. Tu opinión nos ayuda a seguir preparando las mejores smash burgers.
        </p>

        {/* Stars */}
        <div className="flex gap-1.5 justify-center mb-5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star 
              key={s} 
              size={20} 
              fill="#fabd00" 
              stroke="#fabd00"
              className="text-[#fabd00]"
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full">
          <Button
            onClick={onRedirect}
            className="w-full h-10 bg-primary hover:bg-primary-hover text-white text-xs font-extrabold uppercase rounded-lg shadow-md border-none"
          >
            Calificar Ahora
          </Button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-400 hover:text-gray-600 text-xs font-bold uppercase transition-colors"
          >
            Después
          </button>
        </div>
      </motion.div>
    </div>
  );
}
