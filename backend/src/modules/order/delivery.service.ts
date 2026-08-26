import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryTaskStatus, OrderStatus, StaffRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isAmericasBranch, OrderService } from './order.service.js';
import { OrdersGateway } from './orders.gateway.js';

const TASK_INCLUDE = {
  driver: { select: { id: true, name: true, username: true } },
  order: { include: { items: true } },
  events: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async listDrivers(branchId: string) {
    return this.prisma.staff.findMany({
      where: { branchId, role: StaffRole.DRIVER, active: true },
      select: { id: true, name: true, username: true, branchId: true },
      orderBy: { name: 'asc' },
    });
  }

  async listMine(driverId: string) {
    const tasks = await this.prisma.deliveryTask.findMany({
      where: { driverId, status: { not: DeliveryTaskStatus.DELIVERED } },
      include: TASK_INCLUDE,
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
    });
    return tasks.map((task) => this.serializeTask(task));
  }

  async assign(orderId: string, driverId: string, actor: { id: string; role: StaffRole; branchId: string | null }) {
    const task = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { deliveryTask: true } });
      if (!order) throw new NotFoundException('Pedido no encontrado.');
      this.assertBranchAccess(actor, order.branchId);
      if (order.deliveryType !== 'delivery' || !isAmericasBranch(order.branchName)) {
        throw new BadRequestException('Este pedido no pertenece al reparto a domicilio de Américas.');
      }
      if (order.status !== OrderStatus.READY) {
        throw new BadRequestException('El pedido debe estar listo antes de asignarlo a reparto.');
      }

      const driver = await tx.staff.findUnique({ where: { id: driverId } });
      if (!driver || !driver.active || driver.role !== StaffRole.DRIVER || driver.branchId !== order.branchId) {
        throw new BadRequestException('Selecciona un repartidor activo de la misma sucursal.');
      }
      if (order.deliveryTask?.status === DeliveryTaskStatus.DELIVERED) {
        throw new ConflictException('Esta entrega ya fue finalizada.');
      }

      const previousStatus = order.deliveryTask?.status ?? null;
      const saved = order.deliveryTask
        ? await tx.deliveryTask.update({
            where: { id: order.deliveryTask.id },
            data: {
              driverId,
              assignedByStaffId: actor.id,
              status: DeliveryTaskStatus.ASSIGNED,
              assignedAt: new Date(),
              startedAt: null,
              incidentReason: null,
            },
          })
        : await tx.deliveryTask.create({
            data: {
              id: randomUUID(),
              orderId,
              branchId: order.branchId,
              driverId,
              assignedByStaffId: actor.id,
            },
          });

      await tx.deliveryTaskEvent.create({
        data: {
          id: randomUUID(),
          taskId: saved.id,
          fromStatus: previousStatus,
          toStatus: DeliveryTaskStatus.ASSIGNED,
          staffId: actor.id,
          note: order.deliveryTask ? 'Entrega reasignada.' : 'Entrega asignada.',
        },
      });
      return tx.deliveryTask.findUniqueOrThrow({ where: { id: saved.id }, include: TASK_INCLUDE });
    });

    this.notify(task);
    return this.serializeTask(task);
  }

  async start(taskId: string, driverId: string) {
    return this.changeDriverStatus(taskId, driverId, DeliveryTaskStatus.EN_ROUTE);
  }

  async reportIncident(taskId: string, driverId: string, reason: string) {
    const note = reason.trim().slice(0, 300);
    if (note.length < 3) throw new BadRequestException('Describe brevemente el problema con la entrega.');
    return this.changeDriverStatus(taskId, driverId, DeliveryTaskStatus.INCIDENT, note);
  }

  async complete(taskId: string, driverId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.deliveryTask.findUnique({ where: { id: taskId }, include: { order: true } });
      if (!current) throw new NotFoundException('Entrega no encontrada.');
      this.assertAssignedDriver(current.driverId, driverId);
      if (current.status !== DeliveryTaskStatus.EN_ROUTE) {
        throw new BadRequestException('Primero marca la entrega como “En camino”.');
      }
      if (current.order.status !== OrderStatus.READY) {
        throw new ConflictException('El pedido ya no está disponible para finalizar la entrega.');
      }

      const updated = await tx.deliveryTask.updateMany({
        where: { id: taskId, driverId, status: DeliveryTaskStatus.EN_ROUTE },
        data: { status: DeliveryTaskStatus.DELIVERED, deliveredAt: new Date(), incidentReason: null },
      });
      if (updated.count === 0) throw new ConflictException('La entrega fue actualizada por otra operación.');

      await tx.deliveryTaskEvent.create({
        data: {
          id: randomUUID(),
          taskId,
          fromStatus: DeliveryTaskStatus.EN_ROUTE,
          toStatus: DeliveryTaskStatus.DELIVERED,
          staffId: driverId,
          note: 'Entrega confirmada por el repartidor.',
        },
      });
      const order = await this.orderService.transitionOrderInTransaction(tx, current.orderId, OrderStatus.COMPLETED, {
        staffId: driverId,
        metadata: { deliveryTaskId: taskId },
      });
      const task = await tx.deliveryTask.findUniqueOrThrow({ where: { id: taskId }, include: TASK_INCLUDE });
      return { task, order };
    });

    this.orderService.notifyCommittedTransition(result.order);
    this.notify(result.task);
    return this.serializeTask(result.task);
  }

  private async changeDriverStatus(taskId: string, driverId: string, to: DeliveryTaskStatus, note?: string) {
    const task = await this.prisma.$transaction(async (tx) => {
      const current = await tx.deliveryTask.findUnique({ where: { id: taskId } });
      if (!current) throw new NotFoundException('Entrega no encontrada.');
      this.assertAssignedDriver(current.driverId, driverId);

      const allowed = to === DeliveryTaskStatus.EN_ROUTE
        ? current.status === DeliveryTaskStatus.ASSIGNED || current.status === DeliveryTaskStatus.INCIDENT
        : to === DeliveryTaskStatus.INCIDENT
          ? current.status === DeliveryTaskStatus.ASSIGNED || current.status === DeliveryTaskStatus.EN_ROUTE || current.status === DeliveryTaskStatus.INCIDENT
          : false;
      if (!allowed) throw new BadRequestException('Ese cambio no está permitido para la entrega actual.');

      const updated = await tx.deliveryTask.updateMany({
        where: { id: taskId, driverId, status: current.status },
        data: {
          status: to,
          ...(to === DeliveryTaskStatus.EN_ROUTE ? { startedAt: current.startedAt ?? new Date(), incidentReason: null } : {}),
          ...(to === DeliveryTaskStatus.INCIDENT ? { incidentReason: note } : {}),
        },
      });
      if (updated.count === 0) throw new ConflictException('La entrega fue actualizada por otra operación.');
      await tx.deliveryTaskEvent.create({
        data: { id: randomUUID(), taskId, fromStatus: current.status, toStatus: to, staffId: driverId, note },
      });
      return tx.deliveryTask.findUniqueOrThrow({ where: { id: taskId }, include: TASK_INCLUDE });
    });

    this.notify(task);
    return this.serializeTask(task);
  }

  private assertAssignedDriver(assignedDriverId: string, actorId: string) {
    if (assignedDriverId !== actorId) throw new ForbiddenException('Esta entrega está asignada a otro repartidor.');
  }

  private assertBranchAccess(actor: { role: StaffRole; branchId: string | null }, branchId: string) {
    if (actor.role !== StaffRole.ADMIN && actor.branchId !== branchId) {
      throw new ForbiddenException('No tienes permiso para asignar entregas de otra sucursal.');
    }
  }

  private notify(task: { id: string; orderId: string; branchId: string; driverId: string; status: DeliveryTaskStatus }) {
    this.ordersGateway.notifyDeliveryChanged(task);
  }

  private serializeTask(task: any) {
    return {
      ...task,
      order: {
        ...task.order,
        total: Number(task.order.total),
        deliveryFee: task.order.deliveryFee != null ? Number(task.order.deliveryFee) : 0,
        items: task.order.items.map((item: any) => ({ ...item, price: Number(item.price) })),
      },
    };
  }
}
