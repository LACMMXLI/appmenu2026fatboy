import React from 'react';
import {
  Check,
  FileText,
  Gift,
  Image,
  RefreshCw,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { AdminNavItem, AdminTabCounts, Tab } from './adminCatalogTypes';

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'products', label: 'Productos', description: 'Catálogo y precios', icon: ShoppingBag },
  { id: 'categories', label: 'Categorías', description: 'Orden y visibilidad', icon: Store },
  { id: 'promotions', label: 'Promociones', description: 'Etiquetas comerciales', icon: Tag },
  { id: 'rewards', label: 'Canjeables', description: 'Puntos y premios', icon: Gift },
  { id: 'banners', label: 'Banners inicio', description: 'Contenido principal', icon: Image },
  { id: 'customers', label: 'Clientes', description: 'Datos y puntos', icon: Users },
  { id: 'orders', label: 'Pedidos', description: 'Operación web', icon: FileText },
  { id: 'settings', label: 'Configuración', description: 'Canales y reseñas', icon: Settings },
  { id: 'feedback', label: 'Reseñas', description: 'Opiniones internas', icon: Star },
];

interface AdminCatalogShellProps {
  activeTab: Tab;
  counts: AdminTabCounts;
  children: React.ReactNode;
  message: string;
  error: string;
  isLoading: boolean;
  onRefresh: () => void;
  onTabChange: (tab: Tab) => void;
}

export function AdminCatalogShell({
  activeTab,
  counts,
  children,
  message,
  error,
  isLoading,
  onRefresh,
  onTabChange,
}: AdminCatalogShellProps) {
  const activeItem = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab) ?? ADMIN_NAV_ITEMS[0];

  return (
    <main className="min-h-[100dvh] bg-background text-white">
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1560px] gap-0 md:grid-cols-[286px_minmax(0,1fr)]">
        <aside className="border-b border-outline bg-[#111111] md:sticky md:top-0 md:h-[100dvh] md:border-b-0 md:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-outline px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Fatboy POS</p>
              <h1 className="font-display text-4xl leading-none tracking-wide">ADMIN</h1>
              <p className="mt-1 text-xs font-medium text-gray-400">Panel global de control</p>
            </div>

            <nav className="grid gap-1.5 overflow-x-auto px-3 py-3 md:overflow-y-auto md:overflow-x-hidden">
              <div className="flex gap-2 md:grid md:gap-1.5">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        'group grid min-w-[190px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors md:min-w-0',
                        isActive
                          ? 'border-primary/50 bg-primary/15 text-white shadow-[inset_3px_0_0_var(--color-primary)]'
                          : 'border-transparent bg-transparent text-gray-400 hover:border-outline hover:bg-surface',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-md border',
                          isActive ? 'border-primary/40 bg-primary text-white' : 'border-outline bg-background text-gray-500',
                        )}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black uppercase tracking-wide">{item.label}</span>
                        <span className="block truncate text-[10px] font-semibold text-gray-500">{item.description}</span>
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-black',
                          isActive ? 'bg-white text-background' : 'bg-surface-2 text-gray-500',
                        )}
                      >
                        {counts[item.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="mt-auto hidden border-t border-outline px-5 py-4 md:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Modo administrador</p>
              <p className="mt-1 text-xs text-gray-400">Diseñado para escritorio y tabletas.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(232,0,10,0.10),transparent_34%),var(--color-background)]">
          <header className="sticky top-0 z-20 border-b border-outline bg-background/92 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto min-w-[220px]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Área activa</p>
                <h2 className="text-xl font-black uppercase tracking-wide text-white">{activeItem.label}</h2>
                <p className="text-xs font-medium text-gray-400">{activeItem.description}</p>
              </div>

              <div className="flex min-h-9 flex-wrap items-center justify-end gap-3">
                {message && (
                  <span className="flex items-center gap-1 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                    <Check size={14} /> {message}
                  </span>
                )}
                {error && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {error}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={onRefresh} isLoading={isLoading}>
                  <RefreshCw size={15} className="mr-2" /> Actualizar
                </Button>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 md:px-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
