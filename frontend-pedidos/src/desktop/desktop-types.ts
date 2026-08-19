export type PaperWidthMm = 58 | 80;

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
}

export type DesktopResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface PrintResult {
  ok: boolean;
  message: string;
}

export interface FatboyDesktopApi {
  readonly isDesktop: true;
  getPrinters: () => Promise<DesktopResponse<DesktopPrinter[]>>;
  getPrinterSettings: (branchId: string) => Promise<DesktopResponse<PrinterSettings | null>>;
  savePrinterSettings: (settings: PrinterSettingsInput) => Promise<DesktopResponse<PrinterSettings>>;
  printOrder: (order: PrintableOrder) => Promise<PrintResult>;
  printTest: (branchId: string) => Promise<PrintResult>;
}

export const DESKTOP_CHANNELS = {
  getPrinters: 'desktop:get-printers',
  getPrinterSettings: 'desktop:get-printer-settings',
  savePrinterSettings: 'desktop:save-printer-settings',
  printOrder: 'desktop:print-order',
  printTest: 'desktop:print-test',
} as const;
