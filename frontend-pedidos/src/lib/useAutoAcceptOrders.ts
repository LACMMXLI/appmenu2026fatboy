import { useEffect, useRef, useState } from 'react';
import type { PrinterSettings } from '../desktop/desktop-types';
import { acceptOrder, type Order } from './api';
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

const RETRY_DELAY_MS = 15_000;

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
  const retryBlockedIdsRef = useRef(new Set<string>());
  const retryTimerRef = useRef<number | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!token || !branchId || !settings?.autoAcceptEnabled || settings.branchId !== branchId) return;

    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return;
    }

    let active = true;
    runningRef.current = true;

    void processAutomaticOrdersOnce({
      branchId,
      orders,
      storage: window.localStorage,
      processingIds: processingIdsRef.current,
      accept: (order) => acceptOrder(token, order.id),
      print: printOrder,
      onUpdated,
    }).then((events) => {
      if (!active || events.length === 0) return;

      const completed = events.filter(
        (event) => event.type === 'accepted-and-printed' || event.type === 'queued-print-completed',
      );
      const failures = events.filter(
        (event) => event.type === 'accept-failed' || event.type === 'print-failed',
      );

      if (completed.length > 0) {
        const last = completed.at(-1)!;
        onMessage(`Pedido ${last.order.folio}: aceptado e impreso automáticamente.`);
      }
      if (failures.length > 0) {
        const first = failures[0];
        onError(`Pedido ${first.order.folio}: ${first.message} Se reintentará automáticamente.`);
        for (const failure of failures) {
          retryBlockedIdsRef.current.add(failure.order.id);
          processingIdsRef.current.add(failure.order.id);
        }
        refetch();
        if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = window.setTimeout(() => {
          for (const orderId of retryBlockedIdsRef.current) processingIdsRef.current.delete(orderId);
          retryBlockedIdsRef.current.clear();
          setRetryVersion((version) => version + 1);
        }, RETRY_DELAY_MS);
      }
    }).finally(() => {
      runningRef.current = false;
      if (rerunRequestedRef.current) {
        rerunRequestedRef.current = false;
        setRetryVersion((version) => version + 1);
      }
    });

    return () => {
      active = false;
    };
  }, [branchId, onError, onMessage, onUpdated, orders, refetch, retryVersion, settings, token]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryBlockedIdsRef.current.clear();
  }, []);
}
