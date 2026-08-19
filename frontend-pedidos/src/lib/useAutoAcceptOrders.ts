import { useEffect, useRef, useState } from 'react';
import type { PrinterSettings } from '../desktop/desktop-types';
import {
  acceptOrder,
  claimNextPrintJob,
  completePrintJob,
  failPrintJob,
  startPrintJob,
  type Order,
} from './api';
import { processAutomaticOrdersOnce } from './autoAcceptOrders';
import { printOrder } from './printOrder';

interface UseAutoAcceptOrdersOptions {
  token: string;
  branchId: string;
  settings: PrinterSettings | null;
  orders: Order[];
  onUpdated: (order: Order) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
  refetch: () => void;
}

const QUEUE_POLL_MS = 15_000;

export function useAutoAcceptOrders({
  token,
  branchId,
  settings,
  orders,
  onUpdated,
  onMessage,
  onError,
  refetch,
}: UseAutoAcceptOrdersOptions) {
  const processingIdsRef = useRef(new Set<string>());
  const runningRef = useRef(false);
  const rerunRequestedRef = useRef(false);
  const [pollVersion, setPollVersion] = useState(0);
  const enabled = Boolean(
    token
    && branchId
    && settings?.autoAcceptEnabled
    && settings.branchId === branchId
    && settings.stationId
    && settings.stationName,
  );

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setPollVersion((version) => version + 1), QUEUE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !settings) return;

    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return;
    }

    let active = true;
    runningRef.current = true;

    void processAutomaticOrdersOnce({
      branchId,
      orders,
      processingIds: processingIdsRef.current,
      accept: (order) => acceptOrder(token, order.id, { createProductionPrintJob: true }),
      claim: () => claimNextPrintJob(token, {
        branchId,
        stationId: settings.stationId,
        stationName: settings.stationName,
      }),
      start: (job) => startPrintJob(token, job.id, { branchId, stationId: settings.stationId }),
      print: printOrder,
      complete: (job, result) => completePrintJob(token, job.id, {
        branchId,
        stationId: settings.stationId,
        result: result.message,
      }),
      fail: (job, error) => failPrintJob(token, job.id, {
        branchId,
        stationId: settings.stationId,
        error,
      }),
      onUpdated,
    }).then((events) => {
      if (!active || events.length === 0) return;

      const printed = events.filter((event) => event.type === 'printed');
      const uncertain = events.find((event) => event.type === 'ack-failed');
      const failure = events.find(
        (event) => event.type === 'accept-failed'
          || event.type === 'print-failed'
          || event.type === 'queue-failed',
      );
      const accepted = events.filter((event) => event.type === 'accepted');

      if (printed.length > 0) {
        const last = printed.at(-1)!;
        onMessage(`Pedido ${last.order.folio}: aceptado e impreso automáticamente.`);
      } else if (accepted.length > 0) {
        const last = accepted.at(-1)!;
        onMessage(`Pedido ${last.order.folio}: aceptado y agregado a la cola de impresión.`);
      }

      if (uncertain) {
        onError(
          `Pedido ${uncertain.order.folio}: impresión con resultado incierto. `
          + 'Revísala en Impresora antes de reintentar para evitar un duplicado.',
        );
      } else if (failure) {
        onError(`Pedido ${failure.order.folio}: ${failure.message} La cola volverá a intentarlo.`);
      }

      if (accepted.length > 0 || failure || uncertain) refetch();
    }).catch((error) => {
      if (active) onError(error instanceof Error ? error.message : 'No se pudo procesar la cola de impresión.');
    }).finally(() => {
      runningRef.current = false;
      if (rerunRequestedRef.current) {
        rerunRequestedRef.current = false;
        setPollVersion((version) => version + 1);
      }
    });

    return () => {
      active = false;
    };
  }, [branchId, enabled, onError, onMessage, onUpdated, orders, pollVersion, refetch, settings, token]);
}
