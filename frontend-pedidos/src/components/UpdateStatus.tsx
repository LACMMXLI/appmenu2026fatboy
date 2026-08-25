import { useCallback, useEffect, useState } from 'react';
import { DownloadCloud, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { getDesktopApi } from '../desktop/desktop-bridge';
import type { DesktopUpdateState, UpdateChannel } from '../desktop/desktop-types';
import { Button } from './ui/Button';

function useDesktopUpdateState() {
  const desktopApi = getDesktopApi();
  const [state, setState] = useState<DesktopUpdateState | null>(null);

  useEffect(() => {
    if (!desktopApi) return;
    let active = true;
    void desktopApi.getUpdateState().then((value) => {
      if (active) setState(value);
    }).catch(() => undefined);
    const unsubscribe = desktopApi.onUpdateState((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [desktopApi]);

  return { desktopApi, state, setState };
}

function channelLabel(channel: UpdateChannel): string {
  return channel === 'pilot' ? 'Pilot' : 'Stable';
}

export function UpdateStatusBanner() {
  const { desktopApi, state } = useDesktopUpdateState();
  const install = useCallback(() => {
    void desktopApi?.installUpdate();
  }, [desktopApi]);

  if (!desktopApi || !state) return null;
  const visible = state.phase === 'checking'
    || state.phase === 'available'
    || state.phase === 'downloading'
    || state.phase === 'ready'
    || state.phase === 'install-deferred'
    || state.phase === 'installing';
  if (!visible) return null;

  const ready = state.phase === 'ready' || state.phase === 'install-deferred';
  return (
    <aside className="fixed bottom-3 right-3 z-[90] w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-[#181818]/95 p-3 text-white shadow-2xl backdrop-blur-xl" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {ready ? <ShieldCheck size={17} /> : <DownloadCloud size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black">{state.message}</p>
          {state.phase === 'downloading' && state.percent !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${state.percent}%` }} />
            </div>
          )}
          {ready && (
            <Button type="button" size="sm" className="mt-2" onClick={install}>
              <RotateCcw size={14} className="mr-1.5" /> Reiniciar y actualizar
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function UpdateSettingsPanel({ canChangeChannel }: { canChangeChannel: boolean }) {
  const { desktopApi, state, setState } = useDesktopUpdateState();
  const [localError, setLocalError] = useState('');
  if (!desktopApi || !state) return null;

  const busy = state.phase === 'checking' || state.phase === 'available' || state.phase === 'downloading' || state.phase === 'installing';
  const ready = state.phase === 'ready' || state.phase === 'install-deferred';

  async function check() {
    setLocalError('');
    try {
      const response = await desktopApi!.checkForUpdates();
      if (response.ok === false) throw new Error(response.error);
      setState(response.data);
    } catch {
      setLocalError('No se pudo buscar la actualización. Puedes seguir usando la aplicación.');
    }
  }

  async function changeChannel(channel: UpdateChannel) {
    setLocalError('');
    try {
      const response = await desktopApi!.setUpdateChannel(channel);
      if (response.ok === false) throw new Error(response.error);
      setState(response.data);
    } catch {
      setLocalError('No se pudo guardar el canal de actualización.');
    }
  }

  async function install() {
    setLocalError('');
    try {
      const response = await desktopApi!.installUpdate();
      if (response.ok === false) throw new Error(response.error);
    } catch {
      setLocalError('No se pudo iniciar la instalación. La aplicación puede seguir utilizándose.');
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#101010] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-300">Aplicación de escritorio</h3>
          <p className="mt-1 text-[11px] font-semibold text-gray-500">
            Versión instalada: <span className="text-gray-200">{state.version}</span>
            {' · '}Canal: <span className="text-gray-200">{channelLabel(state.channel)}</span>
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void check()} isLoading={busy} disabled={ready || state.phase === 'unsupported'}>
          <RefreshCw size={14} className="mr-1" /> Buscar actualizaciones
        </Button>
      </div>

      {canChangeChannel && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="desktop-update-channel" className="text-[10px] font-black uppercase tracking-wide text-gray-500">Canal</label>
          <select
            id="desktop-update-channel"
            value={state.channel}
            onChange={(event) => void changeChannel(event.target.value as UpdateChannel)}
            disabled={busy || ready}
            className="h-9 rounded-md border border-white/10 bg-[#181818] px-2 text-xs font-black text-white outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="stable">Stable</option>
            <option value="pilot">Pilot</option>
          </select>
          <span className="text-[10px] font-semibold text-gray-500">Sólo administradores deben cambiarlo.</span>
        </div>
      )}

      {state.message && state.phase !== 'idle' && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-xs font-bold ${state.phase === 'error' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/[0.025] text-gray-300'}`}>
          {state.message}
        </p>
      )}
      {state.phase === 'downloading' && state.percent !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${state.percent}%` }} />
        </div>
      )}
      {ready && (
        <Button type="button" size="sm" className="mt-3" onClick={() => void install()}>
          <RotateCcw size={14} className="mr-1.5" /> Reiniciar y actualizar
        </Button>
      )}
      {localError && <p className="mt-2 text-xs font-bold text-amber-200">{localError}</p>}
    </section>
  );
}
