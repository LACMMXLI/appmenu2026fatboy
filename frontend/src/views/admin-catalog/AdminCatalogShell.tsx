import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Gift,
  Image,
  MonitorSmartphone,
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
  { id: 'visits', label: 'Visitas', description: 'Vistas del menú', icon: MonitorSmartphone },
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
  headerControls?: React.ReactNode;
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
  headerControls,
}: AdminCatalogShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const activeItem = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab) ?? ADMIN_NAV_ITEMS[0];

  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-[radial-gradient(circle_at_12%_8%,rgba(232,0,10,0.15),transparent_30%),radial-gradient(circle_at_84%_0%,rgba(250,189,0,0.10),transparent_28%),var(--color-background)] text-white">
      <div
        className={cn(
          'mx-auto grid min-h-[100dvh] w-full max-w-[1680px] gap-0 transition-[grid-template-columns] duration-300 md:grid-cols-[286px_minmax(0,1fr)]',
          isSidebarCollapsed && 'md:grid-cols-[88px_minmax(0,1fr)]',
        )}
      >
        {/* ── Sidebar ─────────────────────── */}
        <aside className="min-w-0 border-b border-outline bg-[#111111]/95 backdrop-blur-xl md:sticky md:top-0 md:h-[100dvh] md:border-b-0 md:border-r md:border-r-outline/60">
          <div className="flex h-full flex-col">
            {/* Logo Area */}
            <div className={cn('border-b border-outline/60 px-5 py-5', isSidebarCollapsed && 'md:px-3')}>
              <div className="flex items-start gap-3">
                <div className={cn('min-w-0 flex-1 transition-opacity duration-200', isSidebarCollapsed && 'md:hidden')}>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Fatboy POS</p>
                  <h1 className="admin-shimmer font-display text-4xl leading-none tracking-wide">ADMIN</h1>
                  <p className="mt-1 text-xs font-medium text-gray-400">Panel global de control</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((value) => !value)}
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline bg-surface text-gray-300 transition-colors hover:border-primary/45 hover:text-white md:flex"
                  aria-label={isSidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
                  title={isSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
                <span className={cn('hidden h-10 w-10 items-center justify-center rounded-lg bg-primary font-black text-white', isSidebarCollapsed && 'md:flex')}>
                  A
                </span>
              </div>
            </div>

            {/* Navigation */}
            <nav className={cn('grid gap-1.5 overflow-x-auto px-3 py-3 md:overflow-y-auto md:overflow-x-hidden', isSidebarCollapsed && 'md:px-2')}>
              <div className="flex gap-2 md:grid md:gap-1.5">
                {ADMIN_NAV_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                      className={cn(
                        'group relative flex md:grid md:grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 md:gap-3 rounded-lg border px-2 py-1.5 md:px-3 md:py-2.5 text-left transition-all duration-200 min-w-[110px] md:min-w-0 shrink-0',
                        isSidebarCollapsed && 'md:min-w-0 md:grid-cols-1 md:justify-items-center md:px-2',
                        isActive
                          ? 'border-primary/50 bg-primary/15 text-white shadow-[0_0_20px_rgba(232,0,10,0.12),inset_3px_0_0_var(--color-primary)]'
                          : 'border-transparent bg-transparent text-gray-400 hover:translate-x-0.5 hover:border-outline hover:bg-surface hover:shadow-[inset_3px_0_0_rgba(232,0,10,0.3)]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-md border transition-all duration-200',
                          isActive
                            ? 'border-primary/40 bg-primary text-white shadow-[0_0_12px_rgba(232,0,10,0.3)]'
                            : 'border-outline bg-background text-gray-500 group-hover:border-primary/30 group-hover:text-gray-300',
                        )}
                      >
                        <Icon size={14} className="md:w-[17px] md:h-[17px]" />
                      </span>
                      <span className={cn('min-w-0 flex-1 md:flex-initial', isSidebarCollapsed && 'md:hidden')}>
                        <span className="block truncate text-[10px] md:text-xs font-black uppercase tracking-wide">{item.label}</span>
                        <span className="hidden md:block truncate text-[10px] font-semibold text-gray-500">{item.description}</span>
                      </span>
                      <motion.span
                        key={`${item.id}-${counts[item.id]}`}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[9px] md:text-[10px] font-black transition-colors duration-200 shrink-0',
                          isSidebarCollapsed && 'md:absolute md:right-1 md:top-1 md:px-1.5',
                          isActive ? 'bg-white text-background' : 'bg-surface-2 text-gray-500 group-hover:bg-surface-2/80 group-hover:text-gray-400',
                        )}
                      >
                        {counts[item.id]}
                      </motion.span>
                    </motion.button>
                  );
                })}
              </div>
            </nav>

            {/* Footer */}
            <div className={cn('mt-auto hidden border-t border-outline/60 px-5 py-4 md:block', isSidebarCollapsed && 'md:px-3')}>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green animate-pulse-dot" />
                <p className={cn('text-[10px] font-bold uppercase tracking-widest text-gray-500', isSidebarCollapsed && 'md:hidden')}>Modo administrador</p>
              </div>
              <p className={cn('mt-1 text-xs text-gray-400', isSidebarCollapsed && 'md:hidden')}>Diseñado para escritorio y tabletas.</p>
            </div>
          </div>
        </aside>

        {/* ── Content Area ─────────────────── */}
        <section className="flex min-h-0 min-w-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_220px)] md:h-[100dvh] md:overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-20 border-b border-outline bg-background/92 px-4 py-2 backdrop-blur-lg md:px-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              {/* Row 1 / Left side */}
              <div className="flex items-center justify-between w-full md:w-auto md:mr-auto">
                <div className="min-w-0">
                  {/* Breadcrumb */}
                  <div className="hidden sm:flex mb-0.5 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    <span>Admin</span>
                    <ChevronRight size={10} className="text-gray-600" />
                    <span className="text-primary">{activeItem.label}</span>
                  </div>
                  <h2 className="text-lg md:text-xl font-black uppercase tracking-wide text-white leading-tight">{activeItem.label}</h2>
                  <p className="hidden md:block text-xs font-medium text-gray-400 mt-0.5">{activeItem.description}</p>
                </div>
                
                {/* Refresh button on mobile */}
                <div className="flex items-center gap-2 md:hidden">
                  <Button variant="outline" size="sm" onClick={onRefresh} isLoading={isLoading} className="h-9 px-2.5">
                    <RefreshCw size={14} className={cn('transition-transform duration-500', isLoading && 'animate-spin')} />
                  </Button>
                </div>
              </div>

              {/* Row 2 / Right side controls */}
              <div className="flex items-center gap-1.5 w-full md:w-auto md:justify-end">
                {headerControls}

                {/* Refresh button on desktop */}
                <div className="hidden md:flex items-center">
                  <Button variant="outline" size="sm" onClick={onRefresh} isLoading={isLoading} className="h-9 px-3">
                    <RefreshCw size={14} className={cn('mr-1.5 transition-transform duration-500', isLoading && 'animate-spin')} />
                    Actualizar
                  </Button>
                </div>
              </div>
            </div>

            {/* Floating absolute toast alerts (replaces inline elements to save space) */}
            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  key="message"
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-green-500/25 bg-[#181818]/95 px-4 py-2 text-xs font-bold text-green-300 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-md"
                >
                  <Check size={14} className="text-green-400" /> {message}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/30 bg-[#181818]/95 px-4 py-2 text-xs font-bold text-primary shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-md"
                >
                  <AlertCircle size={14} className="text-primary" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading progress bar */}
            {isLoading && <div className="admin-progress-bar" />}
          </header>

          <div className="mx-auto min-h-0 w-full max-w-[1360px] flex-1 overflow-y-auto px-4 py-5 md:px-6 xl:px-8">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
