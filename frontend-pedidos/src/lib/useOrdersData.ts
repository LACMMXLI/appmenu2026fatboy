import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminOrders, type Order } from './api';
import { playNewOrderChime } from './orderHelpers';

// Red de seguridad únicamente. Socket.IO es el mecanismo primario de
// sincronización; esto solo cubre el caso raro de un evento perdido que el
// socket no notó (Sección Dieciocho/Diecinueve).
const SAFETY_POLL_MS = 30_000;

/**
 * Consulta y mantiene sincronizada la lista de pedidos de una sucursal.
 * El socket (useOrdersSocket) solo dispara `refetch()` — nunca decide por
 * sí mismo qué mostrar; el estado real siempre viene de este GET (Sección
 * Nueve/Dieciocho: "no asumir que Socket.IO garantiza por sí mismo que la
 * pantalla esté sincronizada").
 */
export function useOrdersData(token: string, branchId: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const refetch = useCallback(
    async (showSpinner = false) => {
      if (!token || !branchId) return;
      try {
        if (showSpinner) setSyncing(true);
        const result = await getAdminOrders(token, { branchId, limit: 200 });

        // Chime solo por pedidos PENDING_APPROVAL vistos por primera vez —
        // nunca se repite para el mismo pedido (Sección Nueve).
        if (knownOrderIdsRef.current) {
          const freshlyPending = result.items.filter(
            (o) => o.status === 'PENDING_APPROVAL' && !knownOrderIdsRef.current!.has(o.id),
          );
          if (freshlyPending.length > 0) playNewOrderChime();
        }
        knownOrderIdsRef.current = new Set(result.items.map((o) => o.id));

        setOrders(result.items);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al sincronizar pedidos.');
      } finally {
        if (showSpinner) setSyncing(false);
      }
    },
    [token, branchId],
  );

  // Reinicia el "ya visto" al cambiar de sucursal (ADMIN cambiando de
  // sucursal no debe sonar la alerta por pedidos que ya existían ahí).
  useEffect(() => {
    knownOrderIdsRef.current = null;
    setOrders([]);
  }, [branchId]);

  useEffect(() => {
    if (!token || !branchId) return;
    refetch(true);
    const interval = window.setInterval(() => refetch(false), SAFETY_POLL_MS);
    return () => window.clearInterval(interval);
  }, [token, branchId, refetch]);

  /** Aplica localmente la respuesta ya confirmada por el backend de una acción — nunca un estado optimista previo a esa respuesta (Sección Once). */
  const applyUpdatedOrder = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  return { orders, syncing, error, setError, refetch, applyUpdatedOrder };
}
