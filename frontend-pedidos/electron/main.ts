import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  type IpcMainInvokeEvent,
} from 'electron';
import { pathToFileURL } from 'node:url';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  DESKTOP_CHANNELS,
  type DesktopResponse,
  type PrinterSettings,
  type PrintResult,
} from '../src/desktop/desktop-types';
import {
  listPrinters,
  loadPrinterSettings,
  printOrderTicket,
  printTestTicket,
  savePrinterSettings,
} from './printing/print-service';
import { parsePrintableOrder, parsePrinterSettingsInput } from './printing/validation';

const RENDERER_SCHEME = 'fatboy';
let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: RENDERER_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
app.enableSandbox();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function trustedSender(event: IpcMainInvokeEvent): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender.id === mainWindow.webContents.id);
}

function requireTrustedSender(event: IpcMainInvokeEvent): BrowserWindow {
  if (!trustedSender(event) || !mainWindow) throw new Error('Solicitud de escritorio no autorizada.');
  return mainWindow;
}

async function configuredPrinter(window: BrowserWindow): Promise<PrinterSettings> {
  const settings = await loadPrinterSettings();
  if (!settings) throw new Error('Configura una impresora antes de imprimir.');
  const printers = await listPrinters(window.webContents);
  if (!printers.some((printer) => printer.name === settings.deviceName)) {
    throw new Error('La impresora configurada no está disponible en Windows.');
  }
  return settings;
}

function registerIpcHandlers() {
  ipcMain.handle(DESKTOP_CHANNELS.getPrinters, async (event): Promise<DesktopResponse<Awaited<ReturnType<typeof listPrinters>>>> => {
    try {
      const window = requireTrustedSender(event);
      return { ok: true, data: await listPrinters(window.webContents) };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(DESKTOP_CHANNELS.getPrinterSettings, async (event): Promise<DesktopResponse<PrinterSettings | null>> => {
    try {
      requireTrustedSender(event);
      return { ok: true, data: await loadPrinterSettings() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(DESKTOP_CHANNELS.savePrinterSettings, async (event, value): Promise<DesktopResponse<PrinterSettings>> => {
    try {
      const window = requireTrustedSender(event);
      const input = parsePrinterSettingsInput(value);
      const printers = await listPrinters(window.webContents);
      return { ok: true, data: await savePrinterSettings(input, printers) };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(DESKTOP_CHANNELS.printOrder, async (event, value): Promise<PrintResult> => {
    try {
      const window = requireTrustedSender(event);
      const order = parsePrintableOrder(value);
      return await printOrderTicket(order, await configuredPrinter(window));
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  });

  ipcMain.handle(DESKTOP_CHANNELS.printTest, async (event): Promise<PrintResult> => {
    try {
      const window = requireTrustedSender(event);
      return await printTestTicket(await configuredPrinter(window));
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  });
}

async function registerRendererProtocol() {
  const rendererRoot = resolve(__dirname, '../renderer');
  await protocol.handle(RENDERER_SCHEME, (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const target = resolve(rendererRoot, `.${pathname}`);
    const pathFromRoot = relative(rendererRoot, target);
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      return new Response('Ruta no permitida.', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101010',
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    const allowed = devUrl
      ? targetUrl.startsWith(new URL(devUrl).origin)
      : targetUrl.startsWith(`${RENDERER_SCHEME}://app`);
    if (!allowed) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadURL(`${RENDERER_SCHEME}://app/index.html`);
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpcHandlers();
  if (!process.env.ELECTRON_RENDERER_URL) await registerRendererProtocol();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}).catch((error) => {
  console.error('No se pudo iniciar Fatboy Pedidos:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
