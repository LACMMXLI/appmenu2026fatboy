import React from 'react';
import { motion } from 'motion/react';

export function AppSplash() {
  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
      aria-label="Iniciando Fatboy"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(232,0,10,0.18),transparent_55%)]" />
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.86, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <img
          src="/images/logo.png"
          alt="Fatboy"
          className="h-28 w-auto object-contain drop-shadow-[0_0_28px_rgba(232,0,10,0.45)]"
        />
        <motion.div
          className="mt-6 h-1 w-32 overflow-hidden rounded-full bg-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.25 }}
        >
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ delay: 0.2, duration: 0.8, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
