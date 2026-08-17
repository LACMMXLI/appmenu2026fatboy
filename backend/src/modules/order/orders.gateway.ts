import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { StaffRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { StaffAuthService } from '../staff/staff-auth.service.js';
import { resolveCorsOrigin } from '../../lib/cors.js';

interface SocketAuthState {
  customerId?: string;
  staffId?: string;
  staffRole?: StaffRole;
  staffBranchId?: string | null;
}

interface SocketData {
  auth?: SocketAuthState;
}

type AuthedSocket = Socket<any, any, any, SocketData>;

/**
 * Real-time order events (TRECE/CATORCE/QUINCE). PostgreSQL remains the
 * source of truth — this gateway only ever *announces* changes that OrderService
 * already committed; it never accepts writes itself (DIECISÉIS).
 *
 * Auth: the handshake must carry the same opaque session token used for HTTP
 * (customer `Session` or `StaffSession`) — never a bare `userId`/`branchId`
 * supplied by the client (QUINCE). Authentication runs in a Socket.IO
 * middleware (`server.use`) so it completes *before* the connection is
 * accepted — a handler that authenticated inside `handleConnection` instead
 * would race with the client's very first message, since `connect` already
 * fires client-side once the transport is up, regardless of how long an
 * async `handleConnection` takes to resolve.
 *
 * Rooms:
 *   user:{customerId}   — only that customer's own socket joins it.
 *   branch:{branchId}   — only staff assigned to that branch (or ADMIN, on request).
 */
@WebSocketGateway({
  path: '/api/socket.io',
  cors: { origin: resolveCorsOrigin(), credentials: true },
})
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly staffAuthService: StaffAuthService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      const token = this.extractToken(socket);
      if (!token) {
        next(new Error('Falta el token de sesión.'));
        return;
      }

      const customer = await this.authService.validateSession(token).catch(() => null);
      if (customer) {
        socket.data.auth = { customerId: customer.id };
        next();
        return;
      }

      const staff = await this.staffAuthService.tryValidateSession(token);
      if (staff) {
        socket.data.auth = { staffId: staff.id, staffRole: staff.role, staffBranchId: staff.branchId };
        next();
        return;
      }

      next(new Error('Sesión inválida o expirada.'));
    });
  }

  // By the time this runs, `afterInit`'s middleware has already authenticated
  // the socket and populated socket.data.auth — connection is only accepted
  // for authenticated sockets in the first place.
  handleConnection(client: AuthedSocket) {
    const auth = client.data.auth;
    if (!auth) {
      client.disconnect(true);
      return;
    }

    if (auth.customerId) {
      client.join(`user:${auth.customerId}`);
    }
    if (auth.staffId && auth.staffBranchId) {
      client.join(`branch:${auth.staffBranchId}`);
    }
  }

  // Lets an ADMIN (who has no fixed branchId) opt into a specific branch's
  // room from the UI — still authorized server-side, never trusted blindly.
  @SubscribeMessage('branch:watch')
  handleBranchWatch(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { branchId?: string }) {
    const auth = client.data.auth;
    if (!auth?.staffId) return { ok: false, error: 'No autorizado.' };

    const branchId = body?.branchId;
    if (!branchId) return { ok: false, error: 'branchId requerido.' };

    if (auth.staffRole !== StaffRole.ADMIN && auth.staffBranchId !== branchId) {
      return { ok: false, error: 'No tienes permiso para esa sucursal.' };
    }

    client.join(`branch:${branchId}`);
    return { ok: true };
  }

  /** Called by OrderService right after a new order's transaction commits. */
  notifyOrderCreated(order: { id: string; branchId: string }) {
    this.server.to(`branch:${order.branchId}`).emit('order.created', { orderId: order.id, branchId: order.branchId });
  }

  /** Called by OrderService right after a status transition commits. */
  notifyOrderStatusChanged(order: { id: string; branchId: string; customerId: string | null; status: string }) {
    const payload = { orderId: order.id, branchId: order.branchId, status: order.status };
    this.server.to(`branch:${order.branchId}`).emit('order.status_changed', payload);
    if (order.customerId) {
      this.server.to(`user:${order.customerId}`).emit('order.status_changed', payload);
    }
  }

  private extractToken(client: AuthedSocket): string {
    const authToken = (client.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof authToken === 'string' && authToken) return authToken;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string') {
      const parts = header.split(' ');
      return parts.length === 2 ? parts[1] : parts[0];
    }
    return '';
  }
}
