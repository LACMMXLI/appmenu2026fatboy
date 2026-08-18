import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminOrders, type Order } from './api';

const TERMINAL_STATUSES = ['COMPLETED', 'REJECTED', 'CANCELLED'] as const;
const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Historial de la sucursal (Sección Veinte/Veintiuno del plan): pedidos
 * terminales, con búsqueda por folio/cliente/teléfono y paginación por
 * cursor — nunca se descargan miles de pedidos al frontend para filtrar
 * localmente, el backend hace el filtrado (mismo patrón que
 * CatalogService ya usa para productos/clientes).
 */
export function useOrderHistory(token: string, branchId: string) {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // Debounce: no disparar una consulta por cada tecla.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(rawQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [rawQuery]);

  // Evita aplicar la respuesta de una búsqueda que ya quedó obsoleta si el
  // operador siguió escribiendo (o cambió de sucursal) antes de que
  // regresara.
  const requestIdRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    if (!token || !branchId) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError('');
    try {
      const result = await getAdminOrders(token, {
        branchId,
        limit: PAGE_SIZE,
        query: debouncedQuery || undefined,
        statuses: [...TERMINAL_STATUSES],
      });
      if (requestId !== requestIdRef.current) return;
      setItems(result.items);
      setCursor(result.nextCursor);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al consultar el historial.');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [token, branchId, debouncedQuery]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!token || !branchId || !cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await getAdminOrders(token, {
        branchId,
        limit: PAGE_SIZE,
        cursor,
        query: debouncedQuery || undefined,
        statuses: [...TERMINAL_STATUSES],
      });
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar más pedidos.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [token, branchId, cursor, debouncedQuery, isLoadingMore]);

  return {
    query: rawQuery,
    setQuery: setRawQuery,
    items,
    hasMore: cursor !== null,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
  };
}
