import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home, UtensilsCrossed, Flame, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { HamburgerButton, NavDrawer } from './NavDrawer';

interface NavProps {
  currentView: string;
  onNavigate: (view: any) => void;
}

/* ─────────────────────────────────────────────────
   TOP BAR — Hamburger (opens quick-access drawer) |
   Logo mascot | Cart badge
───────────────────────────────────────────────── */
export function TopBar({ onNavigate }: Omit<NavProps, 'currentView'>) {
  const { items } = useCart();
  const cartCount = items.reduce((s, i) => s + i.qty, 0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
    <header className="topbar">
      <HamburgerButton open={drawerOpen} onClick={() => setDrawerOpen((prev) => !prev)} />

      {/* Logo — mascot image */}
      <button
        onClick={() => onNavigate('home')}
        className="flex items-center h-full py-0.5"
        aria-label="Ir a inicio"
      >
        <img
          src="/images/logo.png"
          alt="FATBOY"
          className="h-10 w-auto object-contain"
          style={{ maxWidth: 140 }}
        />
      </button>

      {/* Cart icon + badge */}
      <button
        onClick={() => onNavigate('cart')}
        className="relative p-1.5"
        aria-label="Carrito"
      >
        <ShoppingBag size={18} className="text-white" strokeWidth={1.8} />
        <AnimatePresence>
          {cartCount > 0 && (
            <motion.span
              key={cartCount}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="nav-badge"
              style={{ top: 0, right: 0 }}
            >
              {cartCount > 9 ? '9+' : cartCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

    </header>
    <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNavigate={onNavigate} />
    </>
  );
}

/* ─────────────────────────────────────────────────
   BOTTOM NAV — Inicio | Menú | Promos | Pedidos | Perfil
───────────────────────────────────────────────── */
export function BottomNav({ currentView, onNavigate }: NavProps) {
  const { items } = useCart();
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  const tabs = [
    { id: 'home',    label: 'Inicio',  Icon: Home,           FilledIcon: Home, badge: undefined },
    { id: 'menu',    label: 'Menú',    Icon: UtensilsCrossed, FilledIcon: UtensilsCrossed, badge: undefined },
    { id: 'promos',  label: 'Promos',  Icon: Flame,           FilledIcon: Flame, badge: undefined },
    { id: 'cart',    label: 'Pedidos', Icon: ShoppingBag,     FilledIcon: ShoppingBag, badge: cartCount },
    { id: 'profile', label: 'Perfil',  Icon: User,            FilledIcon: User, badge: undefined },
  ] as const;

  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, label, Icon, badge }) => {
        const isActive = currentView === id;
        return (
          <motion.button
            key={id}
            id={`nav-${id}`}
            onClick={() => onNavigate(id)}
            whileTap={{ scale: 0.88 }}
            className={cn('nav-tab', isActive && 'active')}
          >
            <div className="nav-icon-wrap">
              <motion.div
                animate={isActive ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.2 : 1.7}
                  className={isActive ? 'text-primary' : 'text-[#555]'}
                  fill={isActive ? 'currentColor' : 'none'}
                  style={{ color: isActive ? 'var(--color-primary)' : '#555' }}
                />
              </motion.div>
              {badge ? (
                <span className="nav-badge" style={{ top: -3, right: -6 }}>{badge > 9 ? '9+' : badge}</span>
              ) : null}
            </div>
            <span className="nav-tab-label">{label}</span>
            {isActive && (
              <motion.span
                layoutId="bottom-nav-indicator"
                className="nav-indicator"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              />
            )}
          </motion.button>
        );
      })}
    </nav>
  );
}
