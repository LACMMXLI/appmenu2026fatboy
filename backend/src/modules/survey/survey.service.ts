import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

const ALLOWED_BRANCHES = ['Venecia', 'San Marcos', 'Américas'] as const;
const ALLOWED_RETURN_VALUES = ['yes', 'no', 'maybe'] as const;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export interface SurveyResponseBody {
  branch?: unknown;
  ratingGeneral?: unknown;
  ratingFood?: unknown;
  ratingService?: unknown;
  ratingWaitTime?: unknown;
  ratingCleanliness?: unknown;
  wouldReturn?: unknown;
  comment?: unknown;
}

export interface SurveyFilters {
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
  ratingGeneral?: string;
  hasComment?: string;
}

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: SurveyResponseBody, ip: string, userAgent?: string) {
    const data = this.validateBody(body);
    const branch = await this.prisma.branch.findFirst({
      where: { name: { equals: data.branch, mode: 'insensitive' } },
      select: { name: true },
    });
    if (!branch) {
      throw new BadRequestException('La sucursal seleccionada no está disponible.');
    }

    const ipHash = this.hashIp(ip);
    const recentCount = await this.prisma.surveyResponse.count({
      where: {
        ipHash,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      throw new HttpException('Has enviado varias respuestas. Intenta de nuevo en unos minutos.', 429);
    }

    const response = await this.prisma.surveyResponse.create({
      data: {
        ...data,
        branch: branch.name,
        ipHash,
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : null,
      },
      select: { id: true, createdAt: true },
    });
    return { ok: true, ...response };
  }

  async list(filters: SurveyFilters) {
    const where = this.buildFilters(filters);
    const [responses, aggregate, returnCount] = await Promise.all([
      this.prisma.surveyResponse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          branch: true,
          ratingGeneral: true,
          ratingFood: true,
          ratingService: true,
          ratingWaitTime: true,
          ratingCleanliness: true,
          wouldReturn: true,
          comment: true,
          createdAt: true,
        },
      }),
      this.prisma.surveyResponse.aggregate({
        where,
        _count: { _all: true },
        _avg: {
          ratingGeneral: true,
          ratingFood: true,
          ratingService: true,
          ratingWaitTime: true,
          ratingCleanliness: true,
        },
      }),
      this.prisma.surveyResponse.count({ where: { ...where, wouldReturn: 'yes' } }),
    ]);

    const total = aggregate._count._all;
    return {
      metrics: {
        total,
        averageGeneral: aggregate._avg.ratingGeneral ?? 0,
        averageFood: aggregate._avg.ratingFood ?? 0,
        averageService: aggregate._avg.ratingService ?? 0,
        averageWaitTime: aggregate._avg.ratingWaitTime ?? 0,
        averageCleanliness: aggregate._avg.ratingCleanliness ?? 0,
        wouldReturnPercent: total ? (returnCount / total) * 100 : 0,
      },
      recentComments: responses.filter((response) => response.comment).slice(0, 8),
      responses,
    };
  }

  private validateBody(body: SurveyResponseBody) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Respuesta inválida.');
    }
    const branch = typeof body.branch === 'string' ? body.branch.trim() : '';
    if (!ALLOWED_BRANCHES.includes(branch as (typeof ALLOWED_BRANCHES)[number])) {
      throw new BadRequestException('Selecciona una sucursal válida.');
    }

    const ratingGeneral = this.rating(body.ratingGeneral, 'calificación general');
    const ratingFood = this.rating(body.ratingFood, 'calidad de comida');
    const ratingService = this.rating(body.ratingService, 'atención del personal');
    const ratingWaitTime = this.rating(body.ratingWaitTime, 'tiempo de espera');
    const ratingCleanliness = this.rating(body.ratingCleanliness, 'limpieza');
    const wouldReturn = typeof body.wouldReturn === 'string' ? body.wouldReturn : '';
    if (!ALLOWED_RETURN_VALUES.includes(wouldReturn as (typeof ALLOWED_RETURN_VALUES)[number])) {
      throw new BadRequestException('Indica si volverías a comprar.');
    }

    if (body.comment !== undefined && body.comment !== null && typeof body.comment !== 'string') {
      throw new BadRequestException('El comentario no es válido.');
    }
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (comment.length > 500) {
      throw new BadRequestException('El comentario no puede exceder 500 caracteres.');
    }

    return {
      branch,
      ratingGeneral,
      ratingFood,
      ratingService,
      ratingWaitTime,
      ratingCleanliness,
      wouldReturn,
      comment: comment || null,
    };
  }

  private rating(value: unknown, field: string) {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException(`Selecciona una ${field} del 1 al 5.`);
    }
    return rating;
  }

  private buildFilters(filters: SurveyFilters) {
    const where: any = {};
    if (filters.branch) {
      if (!ALLOWED_BRANCHES.includes(filters.branch as (typeof ALLOWED_BRANCHES)[number])) {
        throw new BadRequestException('Filtro de sucursal inválido.');
      }
      where.branch = filters.branch;
    }
    if (filters.ratingGeneral) {
      where.ratingGeneral = this.rating(filters.ratingGeneral, 'calificación general');
    }
    if (filters.hasComment === 'true') {
      where.comment = { not: null };
    } else if (filters.hasComment && filters.hasComment !== 'false') {
      throw new BadRequestException('Filtro de comentario inválido.');
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = this.parseDate(filters.dateFrom, false);
      if (filters.dateTo) where.createdAt.lte = this.parseDate(filters.dateTo, true);
      if (where.createdAt.gte && where.createdAt.lte && where.createdAt.gte > where.createdAt.lte) {
        throw new BadRequestException('El rango de fechas no es válido.');
      }
    }
    return where;
  }

  private parseDate(value: string, endOfDay: boolean) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('La fecha debe usar el formato AAAA-MM-DD.');
    }
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Fecha inválida.');
    return date;
  }

  private hashIp(ip: string) {
    const secret = process.env.IP_HASH_SECRET || process.env.ADMIN_CATALOG_KEY;
    if (!secret) throw new Error('Falta configurar ADMIN_CATALOG_KEY o IP_HASH_SECRET.');
    return createHmac('sha256', secret).update(ip).digest('hex');
  }
}
