import { describe, expect, it } from 'vitest';
import { metadataChannel, parseUpdateChannel, UpdateSafetyGate, validCriticalOperationId } from './update-utils';

describe('update utilities', () => {
  it('uses stable for missing or invalid persisted values', () => {
    expect(parseUpdateChannel(undefined)).toBe('stable');
    expect(parseUpdateChannel('beta')).toBe('stable');
    expect(parseUpdateChannel('stable')).toBe('stable');
  });

  it('maps the user-facing channels to electron-updater metadata names', () => {
    expect(metadataChannel('stable')).toBe('latest');
    expect(metadataChannel('pilot')).toBe('pilot');
  });

  it('rejects malformed critical-operation identifiers', () => {
    expect(validCriticalOperationId('api:POST:123')).toBe(true);
    expect(validCriticalOperationId('')).toBe(false);
    expect(validCriticalOperationId('x'.repeat(161))).toBe(false);
    expect(validCriticalOperationId(123)).toBe(false);
  });

  it('defers installation until every critical operation finishes', () => {
    const gate = new UpdateSafetyGate();
    gate.setOperation('renderer:api:POST:1', true);
    gate.setOperation('main:print-order:1', true);

    expect(gate.requestInstall()).toBe(false);
    gate.setOperation('renderer:api:POST:1', false);
    expect(gate.shouldInstallNow()).toBe(false);
    gate.setOperation('main:print-order:1', false);
    expect(gate.shouldInstallNow()).toBe(true);
  });

  it('clears stale renderer operations without clearing main-process printing', () => {
    const gate = new UpdateSafetyGate();
    gate.setOperation('renderer:api:PATCH:1', true);
    gate.setOperation('main:print-order:1', true);
    gate.clearOperationsWithPrefix('renderer:');

    expect(gate.activeCount).toBe(1);
  });
});
