import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectOrdersSocket } from './socket';

/**
 * Conexión de tiempo real para el tablero operativo (Sección Dieciocho del
 * plan). Se une automáticamente al room `branch:{branchId}` del lado del
 * servidor en cuanto el token es válido — el ADMIN sin sucursal fija se
 * suscribe explícitamente con `branch:watch`.
 *
 * Este hook expone solo la señal de conexión y los eventos crudos; el
 * refetch HTTP que decide qué mostrar vive en quien lo consuma (Fase
 * dos/tres) — Socket.IO nunca es la fuente de verdad, solo avisa que algo
 * cambió (Sección Nueve/Dieciocho: "no asumir que Socket.IO garantiza por
 * sí mismo que la pantalla esté sincronizada").
 */
export function useOrdersSocket(
  token: string,
  branchId: string,
  isAdmin: boolean,
  onOrderEvent: () => void,
) {
  const [connected, setConnected] = useState(false);
  const onOrderEventRef = useRef(onOrderEvent);
  onOrderEventRef.current = onOrderEvent;

  useEffect(() => {
    if (!token || !branchId) return;

    const socket: Socket = connectOrdersSocket(token);
    const notify = () => onOrderEventRef.current();

    socket.on('connect', () => {
      setConnected(true);
      if (isAdmin) socket.emit('branch:watch', { branchId });
      notify(); // regla de reconexión: siempre resincronizar por HTTP
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('order.created', notify);
    socket.on('order.status_changed', notify);
    socket.on('orders.purged', notify);

    return () => {
      socket.disconnect();
    };
  }, [token, branchId, isAdmin]);

  return { connected };
}
