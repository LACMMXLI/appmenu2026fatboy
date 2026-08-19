import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrintDocumentType, PrintJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM_LEASE_MS = 60_000;
const PRINTING_LEASE_MS = 180_000;
const FAILURE_RETRY_MS = 15_000;
const MAX_STATION_NAME_LENGTH = 120;
const MAX_RESULT_LENGTH = 500;
const MAX_LIST_LIMIT = 100;

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

@Injectable()
export class PrintJobService {
  constructor(private readonly prisma: PrismaService) {}

  async claimNext(branchId: string, stationIdValue: unknown, stationNameValue: unknown) {
    const stationId = this.stationId(stationIdValue);
    const stationName = this.stationName(stationNameValue);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Once Electron said "printing" we cannot know whether paper came out
      // if it disappears before acknowledging. Expired PRINTING jobs are
      // deliberately UNCERTAIN and require a human retry; they are never
      // printed again automatically.
      await tx.orderPrintJob.updateMany({
        where: {
          branchId,
          status: PrintJobStatus.PRINTING,
          leaseExpiresAt: { lte: now },
        },
        data: {
          status: PrintJobStatus.UNCERTAIN,
          uncertainAt: now,
          leaseExpiresAt: null,
          lastError: 'La estación no confirmó si Windows recibió el trabajo de impresión.',
        },
      });

      const claimable = await tx.orderPrintJob.findFirst({
        where: {
          branchId,
          documentType: PrintDocumentType.PRODUCTION,
          OR: [
            { status: PrintJobStatus.PENDING },
            {
              status: PrintJobStatus.FAILED,
              OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
            },
            {
              status: PrintJobStatus.CLAIMED,
              leaseExpiresAt: { lte: now },
            },
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!claimable) return null;

      const claimed = await tx.orderPrintJob.updateMany({
        where: {
          id: claimable.id,
          branchId,
          OR: [
            { status: PrintJobStatus.PENDING },
            {
              status: PrintJobStatus.FAILED,
              OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
            },
            {
              status: PrintJobStatus.CLAIMED,
              leaseExpiresAt: { lte: now },
            },
          ],
        },
        data: {
          status: PrintJobStatus.CLAIMED,
          claimedByStationId: stationId,
          claimedByStationName: stationName,
          claimedAt: now,
          leaseExpiresAt: addMilliseconds(now, CLAIM_LEASE_MS),
          nextAttemptAt: null,
          printingStartedAt: null,
          uncertainAt: null,
          lastError: null,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count === 0) return null;

      return tx.orderPrintJob.findUniqueOrThrow({ where: { id: claimable.id } });
    });
  }

  async startPrinting(jobId: string, branchId: string, stationIdValue: unknown) {
    const stationId = this.stationId(stationIdValue);
    const now = new Date();
    const updated = await this.prisma.orderPrintJob.updateMany({
      where: {
        id: jobId,
        branchId,
        status: PrintJobStatus.CLAIMED,
        claimedByStationId: stationId,
      },
      data: {
        status: PrintJobStatus.PRINTING,
        printingStartedAt: now,
        leaseExpiresAt: addMilliseconds(now, PRINTING_LEASE_MS),
      },
    });
    if (updated.count === 0) throw new ConflictException('El trabajo ya no está reclamado por esta estación.');
    return this.prisma.orderPrintJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  async complete(jobId: string, branchId: string, stationIdValue: unknown, resultValue: unknown) {
    const stationId = this.stationId(stationIdValue);
    const result = this.optionalMessage(resultValue);
    const now = new Date();
    const updated = await this.prisma.orderPrintJob.updateMany({
      where: {
        id: jobId,
        branchId,
        status: PrintJobStatus.PRINTING,
        claimedByStationId: stationId,
      },
      data: {
        status: PrintJobStatus.PRINTED,
        printedAt: now,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        lastError: null,
        lastResult: result,
      },
    });
    if (updated.count === 0) throw new ConflictException('No se pudo confirmar el trabajo de esta estación.');
    return this.prisma.orderPrintJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  async fail(jobId: string, branchId: string, stationIdValue: unknown, errorValue: unknown) {
    const stationId = this.stationId(stationIdValue);
    const error = this.requiredMessage(errorValue, 'Motivo de error');
    const now = new Date();
    const updated = await this.prisma.orderPrintJob.updateMany({
      where: {
        id: jobId,
        branchId,
        status: { in: [PrintJobStatus.CLAIMED, PrintJobStatus.PRINTING] },
        claimedByStationId: stationId,
      },
      data: {
        status: PrintJobStatus.FAILED,
        leaseExpiresAt: null,
        nextAttemptAt: addMilliseconds(now, FAILURE_RETRY_MS),
        lastError: error,
        lastResult: null,
      },
    });
    if (updated.count === 0) throw new ConflictException('El trabajo ya no pertenece a esta estación.');
    return this.prisma.orderPrintJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  async retry(jobId: string, branchId: string) {
    const updated = await this.prisma.orderPrintJob.updateMany({
      where: {
        id: jobId,
        branchId,
        status: { in: [PrintJobStatus.FAILED, PrintJobStatus.UNCERTAIN] },
      },
      data: {
        status: PrintJobStatus.PENDING,
        claimedByStationId: null,
        claimedByStationName: null,
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        printingStartedAt: null,
        uncertainAt: null,
        lastError: null,
        lastResult: null,
      },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.orderPrintJob.findFirst({ where: { id: jobId, branchId } });
      if (!existing) throw new NotFoundException('Trabajo de impresión no encontrado.');
      throw new ConflictException('Sólo se pueden reintentar trabajos con error o resultado incierto.');
    }
    return this.prisma.orderPrintJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  listRecent(branchId: string, limitValue: unknown) {
    const parsedLimit = Number(limitValue);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(parsedLimit)))
      : 20;
    return this.prisma.orderPrintJob.findMany({
      where: { branchId },
      include: { order: { select: { folio: true, branchName: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  private stationId(value: unknown): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new BadRequestException('Identidad de estación inválida.');
    }
    return value;
  }

  private stationName(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('Nombre de estación requerido.');
    }
    return value.trim().slice(0, MAX_STATION_NAME_LENGTH);
  }

  private requiredMessage(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} requerido.`);
    return value.trim().slice(0, MAX_RESULT_LENGTH);
  }

  private optionalMessage(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    return this.requiredMessage(value, 'Resultado');
  }
}
