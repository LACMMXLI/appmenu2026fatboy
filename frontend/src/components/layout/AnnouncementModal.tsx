import React from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Sparkles, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AnnouncementModalProps {
  onClose: () => void;
}

export function AnnouncementModal({ onClose }: AnnouncementModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#141414] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Glow Effects */}
        <div className="absolute -top-[40%] -left-[30%] w-[160%] h-[160%] rounded-full bg-[radial-gradient(circle_at_center,rgba(232,0,10,0.18),transparent_55%)] pointer-events-none z-0" />
        <div className="absolute -bottom-[30%] -right-[30%] w-[100%] h-[100%] rounded-full bg-[radial-gradient(circle_at_center,rgba(250,189,0,0.06),transparent_60%)] pointer-events-none z-0" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/5 bg-white/5 p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white z-10 active:scale-95 cursor-pointer"
          aria-label="Cerrar anuncio"
        >
          <X size={16} />
        </button>

        {/* Modal Content */}
        <div className="relative z-10 flex flex-col items-center text-center mt-2">
          {/* Party Icon Container */}
          <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/50 bg-primary/15 shadow-[0_0_24px_rgba(232,0,10,0.3)] animate-bounce" style={{ animationDuration: '3.5s' }}>
            <PartyPopper size={30} className="text-primary drop-shadow-[0_2px_8px_rgba(232,0,10,0.3)]" />
            <Sparkles size={16} className="absolute -top-1 -right-1 text-accent animate-pulse" />
          </div>

          {/* Eyebrow Label */}
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
            Noticias de último momento
          </span>

          {/* Large display title */}
          <h3 className="font-display text-4xl mt-1.5 mb-3 text-white tracking-wider uppercase leading-none drop-shadow-lg">
            ¡TERCERA SUCURSAL!
          </h3>

          {/* Small separator line */}
          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full mb-4" />

          {/* Main Body Message */}
          <div className="space-y-3 px-1 text-center">
            <p className="text-sm font-black text-white leading-snug uppercase tracking-wide">
              Se cumplió lo prometido
            </p>
            <p className="text-xs text-gray-300 font-semibold leading-relaxed">
              Nos emociona anunciar que Fatboy abrirá su <span className="text-primary font-black uppercase">tercera ubicación</span> gracias a todo su apoyo.
            </p>
            
            {/* Branch address card */}
            <div className="inline-flex items-center gap-2 bg-black/45 border border-white/5 px-4 py-2.5 rounded-2xl text-xs text-accent font-extrabold my-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
              <MapPin size={15} className="text-primary shrink-0 animate-pulse" />
              <span className="uppercase tracking-wider">Calzada de las Américas</span>
            </div>
            
            <p className="text-xs text-gray-400 font-semibold leading-relaxed mt-2">
              Muchas gracias por su apoyo incondicional. ¡Esperamos verlos pronto en esta nueva ubicación!
            </p>
            
            <p className="text-xs font-black text-white uppercase tracking-widest mt-4 animate-pulse">
              ¡Los esperamos muy pronto!
            </p>
          </div>

          {/* Primary CTA Action Button */}
          <Button
            onClick={onClose}
            size="lg"
            className="w-full mt-6 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white rounded-xl shadow-[0_4px_15px_rgba(232,0,10,0.3)] active:scale-[0.98] transition-all py-3.5 uppercase font-black tracking-wider text-xs cursor-pointer"
          >
            ¡EXCELENTE!
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
