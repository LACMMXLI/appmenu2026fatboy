import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const DISMISSED_KEY = 'fatboy-pedidos-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Deja que el operador vea el tablero primero — no interrumpir el instante
// del login con un banner.
const SHOW_DELAY_MS = 1800;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Sección Veintisiete del plan: instalación como PWA en la tablet de
// sucursal. El navegador decide cuándo dispara `beforeinstallprompt`
// (criterios de Chrome/Android); esto solo lo captura y ofrece un botón
// explícito en vez de depender de que el operador encuentre el menú del
// navegador por su cuenta.
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (isStandalone) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
      if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

      setInstallEvent(event as BeforeInstallPromptEvent);
      window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    function handleAppInstalled() {
      setVisible(false);
      setInstallEvent(null);
      localStorage.removeItem(DISMISSED_KEY);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  }

  async function install() {
    if (!installEvent) return;
    setVisible(false);
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    }
    setInstallEvent(null);
  }

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-[#181818] p-4 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Smartphone size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">Instalar Fatboy Pedidos</p>
          <p className="text-xs font-semibold text-gray-400">Ábrela como app desde la pantalla de la tablet, sin buscar el navegador.</p>
        </div>
        <Button type="button" size="sm" onClick={install}>
          <Download size={14} className="mr-1" /> Instalar
        </Button>
        <button type="button" onClick={dismiss} className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
