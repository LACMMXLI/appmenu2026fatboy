import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Printer, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/Button';
import { getDesktopApi } from '../desktop/desktop-bridge';
import type { DesktopPrinter, PaperWidthMm, PrinterSettings } from '../desktop/desktop-types';

export function PrinterSettingsDialog() {
  const desktopApi = getDesktopApi();
  const [open, setOpen] = useState(false);
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [deviceName, setDeviceName] = useState('');
  const [paperWidthMm, setPaperWidthMm] = useState<PaperWidthMm>(80);
  const [savedSettings, setSavedSettings] = useState<PrinterSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!desktopApi) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [printerResponse, settingsResponse] = await Promise.all([
        desktopApi.getPrinters(),
        desktopApi.getPrinterSettings(),
      ]);
      if (printerResponse.ok === false) throw new Error(printerResponse.error);
      if (settingsResponse.ok === false) throw new Error(settingsResponse.error);

      const available = printerResponse.data;
      const current = settingsResponse.data;
      setPrinters(available);
      setSavedSettings(current);
      setPaperWidthMm(current?.paperWidthMm ?? 80);

      if (current && available.some((printer) => printer.name === current.deviceName)) {
        setDeviceName(current.deviceName);
      } else {
        setDeviceName(available.find((printer) => printer.isDefault)?.name ?? available[0]?.name ?? '');
        if (current) setError('La impresora guardada ya no está disponible. Selecciona otra.');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron consultar las impresoras.');
    } finally {
      setLoading(false);
    }
  }, [desktopApi]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!desktopApi) return null;

  async function persistSettings(): Promise<boolean> {
    if (!deviceName) {
      setError('Selecciona una impresora.');
      return false;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await desktopApi.savePrinterSettings({ deviceName, paperWidthMm });
      if (response.ok === false) throw new Error(response.error);
      setSavedSettings(response.data);
      setMessage(`Configurada: ${response.data.displayName}, ${response.data.paperWidthMm} mm.`);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la impresora.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!(await persistSettings())) return;
    setTesting(true);
    setError('');
    try {
      const result = await desktopApi.printTest();
      if (!result.ok) throw new Error(result.message);
      setMessage(result.message);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'No se pudo imprimir la prueba.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} title={savedSettings?.displayName ?? 'Configurar impresora'}>
        <Printer size={15} className="mr-1" /> Impresora
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="printer-settings-title"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#181818] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h2 id="printer-settings-title" className="font-display text-3xl leading-none tracking-wide text-white">Impresión térmica</h2>
                <p className="mt-1 text-xs font-semibold text-gray-400">Configuración local de esta computadora.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar">
                <X size={20} />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label htmlFor="printer-device" className="text-xs font-black uppercase tracking-wider text-gray-300">Impresora de Windows</label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()} isLoading={loading}>
                    <RefreshCw size={14} className="mr-1" /> Actualizar
                  </Button>
                </div>
                <select
                  id="printer-device"
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  disabled={loading || printers.length === 0}
                  className="h-12 w-full rounded-lg border border-white/10 bg-[#101010] px-3 text-sm font-bold text-white outline-none focus:border-primary disabled:opacity-50"
                >
                  {printers.length === 0 && <option value="">No se encontraron impresoras</option>}
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.displayName}{printer.isDefault ? ' — Predeterminada' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-black uppercase tracking-wider text-gray-300">Ancho del papel</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([58, 80] as const).map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => setPaperWidthMm(width)}
                      className={`h-14 rounded-xl border text-sm font-black transition-colors ${paperWidthMm === width ? 'border-primary bg-primary/15 text-white' : 'border-white/10 bg-[#101010] text-gray-400 hover:text-white'}`}
                    >
                      {width} mm
                    </button>
                  ))}
                </div>
              </fieldset>

              {error && (
                <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs font-bold text-primary">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                </p>
              )}
              {message && (
                <p className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-300">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> {message}
                </p>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-white/10 p-5">
              <Button type="button" variant="outline" onClick={() => void handleTest()} isLoading={testing || saving} disabled={!deviceName}>
                <Printer size={15} className="mr-2" /> Imprimir prueba
              </Button>
              <Button type="button" onClick={() => void persistSettings()} isLoading={saving} disabled={!deviceName}>
                Guardar
              </Button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
