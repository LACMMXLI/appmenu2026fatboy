import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Store,
  PackageSearch,
  Gift,
  Star,
  MessageCircle,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

const SUPPORT_WHATSAPP = '526861105191';

/* ─────────────────────────────────────────────────
   HAMBURGER BUTTON — morphs into an X while the
   menu is open.
───────────────────────────────────────────────── */
export function HamburgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-[3.5px] p-1.5 rounded-md w-7 h-7 active:scale-90 transition-transform"
      aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={open}
    >
      <motion.span
        className="block w-4 h-[1.5px] bg-white rounded-full"
        animate={open ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="block w-4 h-[1.5px] bg-white rounded-full"
        animate={open ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.span
        className="block w-4 h-[1.5px] bg-white rounded-full"
        animate={open ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      />
    </button>
  );
}

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

interface DrawerLink {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: () => void;
}

/* ─────────────────────────────────────────────────
   QUICK MENU — small dropdown anchored under the
   hamburger icon. No full-screen takeover, no dark
   backdrop: just an outside-click catcher so it
   doesn't compete with the rest of the layout.
───────────────────────────────────────────────── */
export function NavDrawer({ open, onClose, onNavigate }: NavDrawerProps) {
  const { isAuthenticated, customer, logout } = useUser();

  const go = (view: string) => {
    onClose();
    onNavigate(view);
  };

  const links: DrawerLink[] = [
    { id: 'branches', label: 'Sucursales', icon: Store, action: () => go('branches') },
    { id: 'order-tracking', label: 'Mi pedido', icon: PackageSearch, action: () => go('order-tracking') },
    { id: 'rewards', label: 'Recompensas', icon: Gift, action: () => go('rewards') },
    { id: 'google-review', label: 'Califícanos', icon: Star, action: () => go('google-review') },
    {
      id: 'support',
      label: 'Soporte',
      icon: MessageCircle,
      action: () => {
        onClose();
        window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hola, necesito ayuda con la app de Fatboy.')}`, '_blank');
      },
    },
  ];

  const handleLogout = async () => {
    onClose();
    await logout();
    onNavigate('home');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Invisible click-catcher, no visual dimming */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-transparent"
          />
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'top left' }}
            className="fixed top-[50px] left-2 z-[201] w-[210px] rounded-xl border border-outline bg-surface/98 backdrop-blur-xl shadow-[0_14px_34px_rgba(0,0,0,0.55)] overflow-hidden"
          >
            {isAuthenticated && (
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Miembro Fatboy</p>
                <p className="text-xs font-bold text-white truncate">{customer?.name ?? 'Cliente'}</p>
              </div>
            )}

            <div className="py-1">
              {links.map(({ id, label, icon: Icon, action }) => (
                <button
                  key={id}
                  onClick={action}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <Icon size={14} className="text-primary shrink-0" />
                  <span className="text-xs font-semibold text-white">{label}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-white/5 py-1">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <LogOut size={14} className="text-primary shrink-0" />
                  <span className="text-xs font-semibold text-white">Cerrar sesión</span>
                </button>
              ) : (
                <button
                  onClick={() => go('auth')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <LogIn size={14} className="text-primary shrink-0" />
                  <span className="text-xs font-semibold text-white">Iniciar sesión</span>
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
