import React from 'react';
import { Home, UtensilsCrossed, Flame, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';

interface NavProps {
  currentView: string;
  onNavigate: (view: any) => void;
}

/* ─────────────────────────────────────────────────
   TOP BAR — Hamburger | Logo mascot | Cart badge
───────────────────────────────────────────────── */
export function TopBar({ onNavigate }: Omit<NavProps, 'currentView'>) {
  const { items } = useCart();
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <header className="topbar">
      {/* Hamburger — decorative only */}
      <button
        className="flex flex-col gap-[3.5px] p-1.5 rounded-md"
        aria-label="Menú"
      >
        <span className="block w-4 h-[1.5px] bg-white rounded-full" />
        <span className="block w-4 h-[1.5px] bg-white rounded-full" />
        <span className="block w-4 h-[1.5px] bg-white rounded-full" />
      </button>

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
        {cartCount > 0 && (
          <span className="nav-badge" style={{ top: 0, right: 0 }}>
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </header>
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
          <button
            key={id}
            id={`nav-${id}`}
            onClick={() => onNavigate(id)}
            className={cn('nav-tab', isActive && 'active')}
          >
            <div className="nav-icon-wrap">
              <Icon
                size={16}
                strokeWidth={isActive ? 2.2 : 1.7}
                className={isActive ? 'text-primary' : 'text-[#555]'}
                fill={isActive ? 'currentColor' : 'none'}
                style={{ color: isActive ? 'var(--color-primary)' : '#555' }}
              />
              {badge ? (
                <span className="nav-badge" style={{ top: -3, right: -6 }}>{badge > 9 ? '9+' : badge}</span>
              ) : null}
            </div>
            <span className="nav-tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
