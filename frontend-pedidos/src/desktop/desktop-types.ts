export type PaperWidthMm = 58 | 80;
export type PrintDocumentType = 'PRODUCTION' | 'CUSTOMER';

export interface PrintableOrderItem {
  productName: string;
  price: number;
  quantity: number;
  meatPrep: string | null;
  extras: string | null;
  removals: string | null;
}

export interface PrintableOrder {
  id: string;
  folio: string;
  branchId: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  total: number;
  pointsRedeemed: number;
  deliveryType: string;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  deliveryFee: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  items: PrintableOrderItem[];
}

export interface DesktopPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface PrinterSettingsInput {
  branchId: string;
  branchName: string;
  deviceName: string;
  paperWidthMm: PaperWidthMm;
  autoAcceptEnabled: boolean;
}

export interface PrinterSettings extends PrinterSettingsInput {
  displayName: string;
  stationId: string;
  stationName: string;
}

export type DesktopResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface PrintResult {
  ok: boolean;
  message: string;
}

export type UpdateChannel = 'stable' | 'pilot';
export type UpdateInitiator = 'automatic' | 'manual';
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'install-deferred'
  | 'installing'
  | 'not-available'
  | 'error'
  | 'unsupported';

export interface DesktopUpdateState {
  version: string;
  channel: UpdateChannel;
  phase: UpdatePhase;
  initiator: UpdateInitiator | null;
  availableVersion: string | null;
  percent: number | null;
  message: string;
}

export interface UpdateInstallResult {
  accepted: boolean;
  deferred: boolean;
  message: string;
}

export interface FatboyDesktopApi {
  readonly isDesktop: true;
  getPrinters: () => Promise<DesktopResponse<DesktopPrinter[]>>;
  getPrinterSettings: (branchId: string) => Promise<DesktopResponse<PrinterSettings | null>>;
  savePrinterSettings: (settings: PrinterSettingsInput) => Promise<DesktopResponse<PrinterSettings>>;
  printOrder: (order: PrintableOrder, documentType: PrintDocumentType) => Promise<PrintResult>;
  printTest: (branchId: string) => Promise<PrintResult>;
  getUpdateState: () => Promise<DesktopUpdateState>;
  checkForUpdates: () => Promise<DesktopResponse<DesktopUpdateState>>;
  installUpdate: () => Promise<DesktopResponse<UpdateInstallResult>>;
  setUpdateChannel: (channel: UpdateChannel) => Promise<DesktopResponse<DesktopUpdateState>>;
  setCriticalOperation: (operationId: string, active: boolean) => Promise<void>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
}

export const DESKTOP_CHANNELS = {
  getPrinters: 'desktop:get-printers',
  getPrinterSettings: 'desktop:get-printer-settings',
  savePrinterSettings: 'desktop:save-printer-settings',
  printOrder: 'desktop:print-order',
  printTest: 'desktop:print-test',
  getUpdateState: 'desktop:update:get-state',
  checkForUpdates: 'desktop:update:check',
  installUpdate: 'desktop:update:install',
  setUpdateChannel: 'desktop:update:set-channel',
  setCriticalOperation: 'desktop:update:set-critical-operation',
  updateStateChanged: 'desktop:update:state-changed',
} as const;
