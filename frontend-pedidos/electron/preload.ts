import { contextBridge, ipcRenderer } from 'electron';
import type { FatboyDesktopApi } from '../src/desktop/desktop-types';
import { DESKTOP_CHANNELS } from '../src/desktop/desktop-types';

const desktopApi: FatboyDesktopApi = Object.freeze({
  isDesktop: true,
  getPrinters: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getPrinters),
  getPrinterSettings: (branchId) => ipcRenderer.invoke(DESKTOP_CHANNELS.getPrinterSettings, branchId),
  savePrinterSettings: (settings) => ipcRenderer.invoke(DESKTOP_CHANNELS.savePrinterSettings, settings),
  printOrder: (order, documentType) => ipcRenderer.invoke(DESKTOP_CHANNELS.printOrder, order, documentType),
  printTest: (branchId) => ipcRenderer.invoke(DESKTOP_CHANNELS.printTest, branchId),
  getUpdateState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getUpdateState),
  checkForUpdates: () => ipcRenderer.invoke(DESKTOP_CHANNELS.checkForUpdates),
  installUpdate: () => ipcRenderer.invoke(DESKTOP_CHANNELS.installUpdate),
  setUpdateChannel: (channel) => ipcRenderer.invoke(DESKTOP_CHANNELS.setUpdateChannel, channel),
  setCriticalOperation: (operationId, active) => (
    ipcRenderer.invoke(DESKTOP_CHANNELS.setCriticalOperation, operationId, active)
  ),
  onUpdateState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state);
    ipcRenderer.on(DESKTOP_CHANNELS.updateStateChanged, handler);
    return () => ipcRenderer.removeListener(DESKTOP_CHANNELS.updateStateChanged, handler);
  },
});

contextBridge.exposeInMainWorld('fatboyDesktop', desktopApi);
