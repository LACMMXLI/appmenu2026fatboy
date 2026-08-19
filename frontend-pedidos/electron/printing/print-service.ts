import { app, BrowserWindow, type WebContents } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DesktopPrinter,
  PaperWidthMm,
  PrintableOrder,
  PrinterSettings,
  PrinterSettingsInput,
  PrintResult,
} from '../../src/desktop/desktop-types';
import { buildTicketHtml } from '../../src/lib/ticketTemplate';
import { parsePrinterSettingsInput } from './validation';

const SETTINGS_FILE = 'printer-settings.json';
const MICRONS_PER_CSS_PIXEL = 25_400 / 96;
const MIN_TICKET_HEIGHT_MICRONS = 50_000;
const MAX_TICKET_HEIGHT_MICRONS = 3_000_000;

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

export async function listPrinters(contents: WebContents): Promise<DesktopPrinter[]> {
  const printers = await contents.getPrintersAsync();
  return printers
    .map((printer) => {
      const status = Number(printer.options?.['printer-status'] ?? 0);
      const isDefault = printer.options?.['is-default'] === 'true';
      return {
        name: printer.name,
        displayName: printer.displayName || printer.name,
        description: printer.description || '',
        status: Number.isFinite(status) ? status : 0,
        isDefault,
      };
    })
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.displayName.localeCompare(right.displayName, 'es'));
}

export async function loadPrinterSettings(): Promise<PrinterSettings | null> {
  try {
    const raw = JSON.parse(await readFile(settingsPath(), 'utf8')) as unknown;
    const parsed = parsePrinterSettingsInput(raw);
    const displayName = typeof (raw as Record<string, unknown>).displayName === 'string'
      ? (raw as Record<string, string>).displayName
      : parsed.deviceName;
    return { ...parsed, displayName };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    console.error('No se pudo leer la configuración de impresora:', error);
    return null;
  }
}

export async function savePrinterSettings(
  input: PrinterSettingsInput,
  printers: DesktopPrinter[],
): Promise<PrinterSettings> {
  const printer = printers.find((candidate) => candidate.name === input.deviceName);
  if (!printer) throw new Error('La impresora seleccionada ya no está disponible en Windows.');

  const settings: PrinterSettings = {
    deviceName: printer.name,
    displayName: printer.displayName,
    paperWidthMm: input.paperWidthMm,
  };
  await writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return settings;
}

async function printHtml(
  html: string,
  settings: PrinterSettings,
): Promise<PrintResult> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const contentHeightPx = await printWindow.webContents.executeJavaScript(
      'Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))',
      true,
    ) as number;
    const height = Math.min(
      MAX_TICKET_HEIGHT_MICRONS,
      Math.max(MIN_TICKET_HEIGHT_MICRONS, Math.ceil(contentHeightPx * MICRONS_PER_CSS_PIXEL) + 8_000),
    );

    const result = await new Promise<{ success: boolean; reason: string }>((resolve) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          color: false,
          deviceName: settings.deviceName,
          margins: { marginType: 'none' },
          landscape: false,
          copies: 1,
          pageSize: {
            width: settings.paperWidthMm * 1_000,
            height,
          },
        },
        (success, failureReason) => resolve({ success, reason: failureReason }),
      );
    });

    if (!result.success) {
      return { ok: false, message: result.reason || 'Windows rechazó el trabajo de impresión.' };
    }
    return {
      ok: true,
      message: `Trabajo enviado a ${settings.displayName} (${settings.paperWidthMm} mm).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo imprimir el ticket.',
    };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
  }
}

export function printOrderTicket(order: PrintableOrder, settings: PrinterSettings): Promise<PrintResult> {
  return printHtml(buildTicketHtml(order, settings.paperWidthMm), settings);
}

export function buildTestOrder(): PrintableOrder {
  return {
    id: 'printer-test',
    folio: 'PRUEBA',
    branchName: 'Configuración de impresora',
    customerName: 'Ticket de prueba',
    customerPhone: '—',
    total: 0,
    pointsRedeemed: 0,
    deliveryType: 'pickup',
    paymentMethod: 'cash',
    notes: 'Si puedes leer este ticket, la impresión silenciosa está configurada.',
    createdAt: new Date().toISOString(),
    items: [
      {
        productName: 'Impresora térmica lista',
        price: 0,
        quantity: 1,
        meatPrep: null,
        extras: null,
        removals: null,
      },
    ],
  };
}

export async function printTestTicket(settings: PrinterSettings): Promise<PrintResult> {
  return printOrderTicket(buildTestOrder(), settings);
}
