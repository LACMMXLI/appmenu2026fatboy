import { app, type BrowserWindow } from 'electron';
import log from 'electron-log/main';
import electronUpdater, {
  CancellationToken,
  type ProgressInfo,
  type UpdateInfo,
} from 'electron-updater';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  DESKTOP_CHANNELS,
  type DesktopUpdateState,
  type UpdateChannel,
  type UpdateInitiator,
  type UpdateInstallResult,
} from '../../src/desktop/desktop-types';
import {
  friendlyUpdateError,
  metadataChannel,
  parseUpdateChannel,
  UpdateSafetyGate,
} from '../../src/desktop/update-utils';

const { autoUpdater } = electronUpdater;
const AUTOMATIC_CHECK_DELAY_MS = 12_000;
const AUTOMATIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 45_000;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const SETTINGS_FILE_NAME = 'update-settings.json';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function safeLogValue(value: unknown): string {
  const raw = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  return raw
    .replace(/([?&](?:token|access_token|auth|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?\S+/gi, '$1[REDACTED]');
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      rejectPromise(new Error(`Tiempo de espera agotado después de ${timeoutMs} ms.`));
    }, timeoutMs);
    timer.unref();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        rejectPromise(error);
      },
    );
  });
}

export class UpdateManager {
  private state: DesktopUpdateState;
  private channel: UpdateChannel = 'stable';
  private checkPromise: Promise<DesktopUpdateState> | null = null;
  private downloadPromise: Promise<void> | null = null;
  private downloadCancellationToken: CancellationToken | null = null;
  private currentInitiator: UpdateInitiator | null = null;
  private safetyGate = new UpdateSafetyGate();
  private automaticChecksScheduled = false;
  private lastLoggedProgressBucket = -1;

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    this.state = {
      version: app.getVersion(),
      channel: 'stable',
      phase: app.isPackaged ? 'idle' : 'unsupported',
      initiator: null,
      availableVersion: null,
      percent: null,
      message: app.isPackaged
        ? ''
        : 'Las actualizaciones se comprueban únicamente en la aplicación instalada.',
    };
  }

  async initialize(): Promise<void> {
    this.configureLogging();
    this.channel = await this.loadChannel();
    this.state = { ...this.state, channel: this.channel };
    this.log('info', `Versión instalada: ${this.state.version}`);
    this.log('info', `Canal: ${this.channel}`);

    if (!app.isPackaged) return;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.disableWebInstaller = true;
    this.applyChannelToUpdater();
    this.registerUpdaterEvents();
  }

  getState(): DesktopUpdateState {
    return { ...this.state };
  }

  notifyRenderer(): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(DESKTOP_CHANNELS.updateStateChanged, this.getState());
  }

  scheduleAutomaticChecks(): void {
    if (!app.isPackaged || this.automaticChecksScheduled) return;
    this.automaticChecksScheduled = true;

    const firstCheck = setTimeout(() => {
      void this.checkForUpdates('automatic');
    }, AUTOMATIC_CHECK_DELAY_MS);
    firstCheck.unref();

    const interval = setInterval(() => {
      void this.checkForUpdates('automatic');
    }, AUTOMATIC_CHECK_INTERVAL_MS);
    interval.unref();
  }

  async checkForUpdates(initiator: UpdateInitiator): Promise<DesktopUpdateState> {
    if (!app.isPackaged) return this.getState();
    if (this.state.phase === 'ready' || this.state.phase === 'install-deferred') return this.getState();
    if (this.checkPromise) return this.checkPromise;

    this.currentInitiator = initiator;
    this.setState({
      phase: 'checking',
      initiator,
      availableVersion: null,
      percent: null,
      message: 'Buscando actualización…',
    });
    this.log('info', `Inicio de búsqueda (${initiator}).`);

    this.checkPromise = (async () => {
      try {
        const result = await withTimeout(autoUpdater.checkForUpdates(), CHECK_TIMEOUT_MS);
        if (!result?.isUpdateAvailable) {
          this.setState({
            phase: 'not-available',
            initiator,
            availableVersion: null,
            percent: null,
            message: 'La aplicación está actualizada.',
          });
          return this.getState();
        }

        this.setState({
          phase: 'available',
          initiator,
          availableVersion: result.updateInfo.version,
          percent: 0,
          message: 'Actualización encontrada. Iniciando descarga…',
        });
        this.log('info', `Versión disponible: ${safeLogValue(result.updateInfo.version)}`);
        void this.downloadUpdate(initiator);
        return this.getState();
      } catch (error) {
        this.failWithoutDisruptingApp(error, initiator, 'comprobación');
        return this.getState();
      } finally {
        this.checkPromise = null;
      }
    })();

    return this.checkPromise;
  }

  async setChannel(value: unknown): Promise<DesktopUpdateState> {
    const nextChannel = parseUpdateChannel(value);
    if (nextChannel === this.channel) return this.getState();

    this.cancelDownload();
    this.safetyGate.completeInstallRequest();
    this.channel = nextChannel;
    await this.saveChannel(nextChannel);
    if (app.isPackaged) this.applyChannelToUpdater();
    this.currentInitiator = null;
    this.setState({
      channel: nextChannel,
      phase: app.isPackaged ? 'idle' : 'unsupported',
      initiator: null,
      availableVersion: null,
      percent: null,
      message: app.isPackaged ? '' : this.state.message,
    });
    this.log('info', `Canal cambiado a ${nextChannel}.`);
    return this.getState();
  }

  async requestInstall(): Promise<UpdateInstallResult> {
    if (this.state.phase !== 'ready' && this.state.phase !== 'install-deferred') {
      return {
        accepted: false,
        deferred: false,
        message: 'Todavía no hay una actualización lista para instalar.',
      };
    }

    if (!this.safetyGate.requestInstall()) {
      this.setState({
        phase: 'install-deferred',
        message: 'La actualización se instalará al terminar la operación en curso.',
      });
      this.log('warn', `Instalación pospuesta: ${this.safetyGate.activeCount} operación(es) crítica(s).`);
      return {
        accepted: true,
        deferred: true,
        message: this.state.message,
      };
    }

    this.installNow();
    return {
      accepted: true,
      deferred: false,
      message: 'Reiniciando para instalar la actualización…',
    };
  }

  setCriticalOperation(operationId: string, active: boolean): void {
    this.safetyGate.setOperation(operationId, active);
    if (!active) this.installIfNowSafe();
  }

  clearRendererCriticalOperations(): void {
    this.safetyGate.clearOperationsWithPrefix('renderer:');
    this.installIfNowSafe();
  }

  async runCriticalOperation<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const operationId = `main:${label}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    this.setCriticalOperation(operationId, true);
    try {
      return await operation();
    } finally {
      this.setCriticalOperation(operationId, false);
    }
  }

  private configureLogging(): void {
    log.initialize();
    log.transports.file.level = 'info';
    log.transports.file.maxSize = 2 * 1024 * 1024;
    log.transports.file.resolvePathFn = () => join(app.getPath('logs'), 'updater.log');
    log.transports.console.level = 'info';
    autoUpdater.logger = {
      debug: (message) => this.log('debug', message),
      info: (message) => this.log('info', message),
      warn: (message) => this.log('warn', message),
      error: (message) => this.log('error', message),
    };
  }

  private registerUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => this.log('info', 'electron-updater inició la búsqueda.'));
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.log('info', `Actualización encontrada: ${safeLogValue(info.version)}`);
    });
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.log('info', `Sin actualización disponible. Versión remota: ${safeLogValue(info.version)}`);
    });
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const percent = Math.max(0, Math.min(100, progress.percent));
      const bucket = Math.floor(percent / 10);
      if (bucket !== this.lastLoggedProgressBucket) {
        this.lastLoggedProgressBucket = bucket;
        this.log('info', `Progreso de descarga: ${percent.toFixed(1)}%.`);
      }
      this.setState({
        phase: 'downloading',
        percent,
        message: `Descargando actualización… ${Math.round(percent)}%`,
      });
    });
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.downloadCancellationToken = null;
      this.lastLoggedProgressBucket = -1;
      this.log('info', `Descarga terminada. Actualización ${safeLogValue(info.version)} lista.`);
      this.setState({
        phase: 'ready',
        availableVersion: info.version,
        percent: 100,
        message: 'Hay una actualización lista para instalar.',
      });
    });
    autoUpdater.on('error', (error: Error) => {
      this.failWithoutDisruptingApp(error, this.currentInitiator ?? 'automatic', 'actualización');
    });
  }

  private async downloadUpdate(initiator: UpdateInitiator): Promise<void> {
    if (this.downloadPromise) return this.downloadPromise;

    this.currentInitiator = initiator;
    this.downloadCancellationToken = new CancellationToken();
    this.lastLoggedProgressBucket = -1;
    this.setState({
      phase: 'downloading',
      initiator,
      percent: 0,
      message: 'Descargando actualización… 0%',
    });
    this.log('info', 'Inicio de descarga.');

    this.downloadPromise = withTimeout(
      autoUpdater.downloadUpdate(this.downloadCancellationToken),
      DOWNLOAD_TIMEOUT_MS,
      () => this.downloadCancellationToken?.cancel(),
    ).then(() => undefined).catch((error: unknown) => {
      if (this.state.phase !== 'idle') {
        this.failWithoutDisruptingApp(error, initiator, 'descarga');
      }
    }).finally(() => {
      this.downloadPromise = null;
      this.downloadCancellationToken = null;
    });

    return this.downloadPromise;
  }

  private cancelDownload(): void {
    if (!this.downloadCancellationToken) return;
    this.log('warn', 'Descarga cancelada por cambio de canal.');
    this.downloadCancellationToken.cancel();
    this.downloadCancellationToken = null;
  }

  private applyChannelToUpdater(): void {
    autoUpdater.channel = metadataChannel(this.channel);
    autoUpdater.allowPrerelease = this.channel === 'pilot';
    // El setter de channel habilita downgrades automáticamente; los desactivamos
    // para impedir un regreso accidental a binarios anteriores.
    autoUpdater.allowDowngrade = false;
  }

  private installIfNowSafe(): void {
    if (!this.safetyGate.shouldInstallNow()) return;
    const timer = setTimeout(() => {
      if (this.safetyGate.shouldInstallNow()) this.installNow();
    }, 750);
    timer.unref();
  }

  private installNow(): void {
    this.safetyGate.completeInstallRequest();
    this.setState({ phase: 'installing', message: 'Reiniciando para instalar la actualización…' });
    this.log('info', 'Inicio de instalación solicitada por el usuario.');
    autoUpdater.quitAndInstall(false, true);
  }

  private failWithoutDisruptingApp(
    error: unknown,
    initiator: UpdateInitiator,
    stage: string,
  ): void {
    this.downloadCancellationToken?.cancel();
    this.downloadCancellationToken = null;
    this.lastLoggedProgressBucket = -1;
    this.log('error', `Error durante ${stage}: ${safeLogValue(error)}`);
    this.setState({
      phase: 'error',
      initiator,
      percent: null,
      message: friendlyUpdateError(),
    });
  }

  private setState(patch: Partial<DesktopUpdateState>): void {
    this.state = { ...this.state, ...patch, channel: this.channel };
    this.notifyRenderer();
  }

  private settingsPath(): string {
    return join(app.getPath('userData'), SETTINGS_FILE_NAME);
  }

  private async loadChannel(): Promise<UpdateChannel> {
    try {
      const payload = JSON.parse(await readFile(this.settingsPath(), 'utf8')) as { channel?: unknown };
      return parseUpdateChannel(payload.channel);
    } catch {
      return 'stable';
    }
  }

  private async saveChannel(channel: UpdateChannel): Promise<void> {
    const target = this.settingsPath();
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify({ channel }, null, 2)}\n`, 'utf8');
  }

  private log(level: LogLevel, message: unknown): void {
    log[level](`[updater] ${safeLogValue(message)}`);
  }
}
