import { contextBridge, ipcRenderer } from 'electron';
import type { FatboyDesktopApi } from '../src/desktop/desktop-types';
import { DESKTOP_CHANNELS } from '../src/desktop/desktop-types';

const desktopApi: FatboyDesktopApi = Object.freeze({
  isDesktop: true,
  getPrinters: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getPrinters),
  getPrinterSettings: (branchId) => ipcRenderer.invoke(DESKTOP_CHANNELS.getPrinterSettings, branchId),
  savePrinterSettings: (settings) => ipcRenderer.invoke(DESKTOP_CHANNELS.savePrinterSettings, settings),
  printOrder: (order) => ipcRenderer.invoke(DESKTOP_CHANNELS.printOrder, order),
  printTest: (branchId) => ipcRenderer.invoke(DESKTOP_CHANNELS.printTest, branchId),
});

contextBridge.exposeInMainWorld('fatboyDesktop', desktopApi);
