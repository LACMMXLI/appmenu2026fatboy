import { app, BrowserWindow, type WebContents } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
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
const STATION_IDENTITY_FILE = 'print-station.json';
const SETTINGS_VERSION = 2;
const MICRONS_PER_CSS_PIXEL = 25_400 / 96;
const MIN_TICKET_HEIGHT_MICRONS = 50_000;
const MAX_TICKET_HEIGHT_MICRONS = 3_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface StationIdentity {
  stationId: string;
  stationName: string;
}

let stationIdentityPromise: Promise<StationIdentity> | null = null;

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

function stationIdentityPath(): string {
  return join(app.getPath('userData'), STATION_IDENTITY_FILE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readSettingsFile(): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(settingsPath(), 'utf8')) as unknown;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    console.error('No se pudo leer la configuración de impresora:', error);
    return null;
  }
}

async function readOrCreateStationIdentity(): Promise<StationIdentity> {
  try {
    const value = JSON.parse(await readFile(stationIdentityPath(), 'utf8')) as unknown;
    if (
      isRecord(value)
      && typeof value.stationId === 'string'
      && UUID_PATTERN.test(value.stationId)
      && typeof value.stationName === 'string'
      && value.stationName.trim()
    ) {
      return { stationId: value.stationId, stationName: value.stationName.trim().slice(0, 120) };
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error('No se pudo leer la identidad de la estación:', error);
  }

  const identity: StationIdentity = {
    stationId: randomUUID(),
    stationName: hostname().trim().slice(0, 120) || 'Receptor Fatboy',
  };
  await writeFile(stationIdentityPath(), `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  return identity;
}

function loadStationIdentity(): Promise<StationIdentity> {
  stationIdentityPromise ??= readOrCreateStationIdentity();
  return stationIdentityPromise;
}

function parseStoredSettings(
  value: unknown,
  branchId: string,
  identity: StationIdentity,
): PrinterSettings | null {
  if (!isRecord(value)) return null;
  try {
    // Compatibilidad con el archivo de la Fase 2, que guardaba una sola
    // impresora y todavía no conocía sucursales ni aceptación automática.
    const parsed = parsePrinterSettingsInput({
      ...value,
      branchId: value.branchId ?? branchId,
      branchName: value.branchName ?? 'Sucursal actual',
      autoAcceptEnabled: value.autoAcceptEnabled ?? false,
    });
    if (parsed.branchId !== branchId) return null;
    const displayName = typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim()
      : parsed.deviceName;
    return { ...parsed, displayName, ...identity };
  } catch {
    return null;
  }
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

export async function loadPrinterSettings(branchId: string): Promise<PrinterSettings | null> {
  const [raw, identity] = await Promise.all([readSettingsFile(), loadStationIdentity()]);
  if (!raw) return null;

  if (isRecord(raw) && raw.version === SETTINGS_VERSION && isRecord(raw.branches)) {
    return parseStoredSettings(raw.branches[branchId], branchId, identity);
  }

  return parseStoredSettings(raw, branchId, identity);
}

export async function savePrinterSettings(
  input: PrinterSettingsInput,
  printers: DesktopPrinter[],
): Promise<PrinterSettings> {
  const printer = printers.find((candidate) => candidate.name === input.deviceName);
  if (!printer) throw new Error('La impresora seleccionada ya no está disponible en Windows.');
  const identity = await loadStationIdentity();

  const settings: PrinterSettings = {
    branchId: input.branchId,
    branchName: input.branchName,
    deviceName: printer.name,
    displayName: printer.displayName,
    paperWidthMm: input.paperWidthMm,
    autoAcceptEnabled: input.autoAcceptEnabled,
    ...identity,
  };

  const current = await readSettingsFile();
  const branches: Record<string, unknown> = isRecord(current)
    && current.version === SETTINGS_VERSION
    && isRecord(current.branches)
    ? { ...current.branches }
    : {};
  branches[input.branchId] = settings;

  await writeFile(settingsPath(), `${JSON.stringify({ version: SETTINGS_VERSION, branches }, null, 2)}\n`, 'utf8');
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
    branchId: 'printer-test',
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
