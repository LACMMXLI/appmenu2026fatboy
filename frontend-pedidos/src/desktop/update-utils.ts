import type { UpdateChannel } from './desktop-types';

export const DEFAULT_UPDATE_CHANNEL: UpdateChannel = 'stable';

export function parseUpdateChannel(value: unknown): UpdateChannel {
  return value === 'pilot' ? 'pilot' : DEFAULT_UPDATE_CHANNEL;
}

export function metadataChannel(channel: UpdateChannel): 'latest' | 'pilot' {
  return channel === 'pilot' ? 'pilot' : 'latest';
}

export function friendlyUpdateError(): string {
  return 'No se pudo completar la actualización. La versión instalada puede seguir utilizándose normalmente.';
}

export function validCriticalOperationId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160;
}

export class UpdateSafetyGate {
  private readonly operations = new Set<string>();
  private installPending = false;

  get activeCount(): number {
    return this.operations.size;
  }

  setOperation(operationId: string, active: boolean): void {
    if (active) this.operations.add(operationId);
    else this.operations.delete(operationId);
  }

  clearOperationsWithPrefix(prefix: string): void {
    for (const operationId of this.operations) {
      if (operationId.startsWith(prefix)) this.operations.delete(operationId);
    }
  }

  requestInstall(): boolean {
    this.installPending = true;
    return this.operations.size === 0;
  }

  shouldInstallNow(): boolean {
    return this.installPending && this.operations.size === 0;
  }

  completeInstallRequest(): void {
    this.installPending = false;
  }
}
