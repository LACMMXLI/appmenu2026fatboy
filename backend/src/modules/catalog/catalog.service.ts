import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogStatus, Prisma, PromotionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service.js';

interface ProductFilters {
  categoryId?: string;
  status?: string;
  query?: string;
}

interface CategoryInput {
  name?: string;
  order?: number;
  status?: string;
  imageUrl?: string | null;
}

interface ProductInput {
  name?: string;
  price?: number | string;
  categoryId?: string;
  status?: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  isPromotion?: boolean;
  promotionTag?: string | null;
  promotionTagColor?: string | null;
}

interface RedeemableProductInput {
  name?: string;
  pointsCost?: number | string;
  status?: string;
  imageUrl?: string | null;
  description?: string | null;
  order?: number;
}

interface PromotionInput {
  title?: string;
  promoText?: string;
  description?: string;
  price?: number | string;
  imageUrl?: string | null;
  status?: PromotionStatus;
}

interface PromotionImageInput {
  fileName?: string;
  imageData?: string;
}

const FIXED_BRANCH_DETAILS = {
  venecia: {
    phone: '+526861105191',
    address: 'Calz Lombardo Toledano 1200, Hacienda del Bosque, 21355 Mexicali, B.C.',
    hours: 'Lunes a domingo 12:00 PM - 3:00 AM',
    mapsUrl: 'https://maps.app.goo.gl/vwVeVoSUrbbD2oMM6',
  },
  sanMarcos: {
    phone: '+526862761824',
    address: 'C. Uxmal 101, San Marcos, 21050 Mexicali, B.C.',
    hours: '24 horas todos los días',
    mapsUrl: 'https://maps.app.goo.gl/ytg4tsmf3MrMnSm38',
  },
} as const;

const MENU_VISIT_COUNTER_ID = 'menu';
const PROMOTION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PROMOTION_UPLOAD_DIR = join(process.cwd(), 'uploads', 'promotions');

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches() {
    const branches = await this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });

    return branches.map((branch) => ({
      ...branch,
      ...this.fixedBranchDetails(branch.name),
    }));
  }

  async listCategories(status?: string) {
    return this.prisma.category.findMany({
      where: this.catalogStatusWhere(status),
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async listProducts(filters: ProductFilters) {
    const where: Prisma.ProductWhereInput = {
      ...this.catalogStatusWhere(filters.status),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.query
        ? {
            OR: [
              { name: { contains: filters.query, mode: 'insensitive' } },
              { description: { contains: filters.query, mode: 'insensitive' } },
              { shortDescription: { contains: filters.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
    });

    return products.map((product) => ({
      ...product,
      price: Number(product.price),
    }));
  }

  async listAdminCatalog() {
    const [categories, products] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.product.findMany({
        include: { category: true },
        orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      categories,
      products: products.map((product) => ({
        ...product,
        price: Number(product.price),
      })),
    };
  }

  async createCategory(input: CategoryInput) {
    const name = this.requiredText(input.name, 'nombre de categoría');

    return this.prisma.category.create({
      data: {
        id: randomUUID(),
        name,
        order: this.parseOrder(input.order),
        status: this.parseCatalogStatus(input.status),
        imageUrl: this.optionalText(input.imageUrl),
      },
    });
  }

  async updateCategory(id: string, input: CategoryInput) {
    await this.requireCategory(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: this.requiredText(input.name, 'nombre de categoría') } : {}),
        ...(input.order !== undefined ? { order: this.parseOrder(input.order) } : {}),
        ...(input.status !== undefined ? { status: this.parseCatalogStatus(input.status) } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: this.optionalText(input.imageUrl) } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    await this.requireCategory(id);

    const productsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productsCount > 0) {
      throw new ConflictException('No se puede eliminar una categoría con productos. Desactívala o mueve sus productos primero.');
    }

    await this.prisma.category.delete({ where: { id } });

    return { ok: true };
  }

  async createProduct(input: ProductInput) {
    const name = this.requiredText(input.name, 'nombre de producto');
    const categoryId = this.requiredText(input.categoryId, 'categoría');
    await this.requireCategory(categoryId);

    return this.mapProduct(
      await this.prisma.product.create({
        data: {
          id: randomUUID(),
          name,
          price: this.parsePrice(input.price),
          categoryId,
          status: this.parseCatalogStatus(input.status),
          description: this.optionalText(input.description),
          shortDescription: this.optionalText(input.shortDescription),
          imageUrl: this.optionalText(input.imageUrl),
          isPromotion: Boolean(input.isPromotion),
          promotionTag: this.optionalText(input.promotionTag),
          promotionTagColor: this.optionalText(input.promotionTagColor),
        },
        include: { category: true },
      }),
    );
  }

  async updateProduct(id: string, input: ProductInput) {
    if (input.categoryId !== undefined) {
      await this.requireCategory(input.categoryId);
    }

    await this.requireProduct(id);

    return this.mapProduct(
      await this.prisma.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: this.requiredText(input.name, 'nombre de producto') } : {}),
          ...(input.price !== undefined ? { price: this.parsePrice(input.price) } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.status !== undefined ? { status: this.parseCatalogStatus(input.status) } : {}),
          ...(input.description !== undefined ? { description: this.optionalText(input.description) } : {}),
          ...(input.shortDescription !== undefined ? { shortDescription: this.optionalText(input.shortDescription) } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: this.optionalText(input.imageUrl) } : {}),
          ...(input.isPromotion !== undefined ? { isPromotion: Boolean(input.isPromotion) } : {}),
          ...(input.promotionTag !== undefined ? { promotionTag: this.optionalText(input.promotionTag) } : {}),
          ...(input.promotionTagColor !== undefined ? { promotionTagColor: this.optionalText(input.promotionTagColor) } : {}),
        },
        include: { category: true },
      }),
    );
  }

  async deleteProduct(id: string) {
    await this.requireProduct(id);
    await this.prisma.product.delete({ where: { id } });

    return { ok: true };
  }

  async listRedeemableProducts(status?: string) {
    return this.prisma.redeemableProduct.findMany({
      where: this.catalogStatusWhere(status),
      orderBy: [{ order: 'asc' }, { pointsCost: 'asc' }, { name: 'asc' }],
    });
  }

  async listAdminRedeemableProducts() {
    return this.prisma.redeemableProduct.findMany({
      orderBy: [{ order: 'asc' }, { pointsCost: 'asc' }, { name: 'asc' }],
    });
  }

  async listRewardRedemptions() {
    const redemptions = await this.prisma.rewardRedemption.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            points: true,
          },
        },
      },
    });

    return redemptions.map((redemption) => ({
      id: redemption.id,
      customerId: redemption.customerId,
      customerName: redemption.customer?.name ?? 'Cliente eliminado',
      customerPhone: redemption.customer?.phone ?? '',
      remainingPoints: redemption.customer?.points ?? 0,
      productName: redemption.productName,
      pointsCost: redemption.pointsCost,
      createdAt: redemption.createdAt,
    }));
  }

  async createRedeemableProduct(input: RedeemableProductInput) {
    return this.prisma.redeemableProduct.create({
      data: {
        id: randomUUID(),
        name: this.requiredText(input.name, 'nombre del canjeable'),
        pointsCost: this.parsePointsCost(input.pointsCost),
        status: this.parseCatalogStatus(input.status),
        imageUrl: this.optionalText(input.imageUrl),
        description: this.optionalText(input.description),
        order: this.parseOrder(input.order),
      },
    });
  }

  async updateRedeemableProduct(id: string, input: RedeemableProductInput) {
    await this.requireRedeemableProduct(id);

    return this.prisma.redeemableProduct.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: this.requiredText(input.name, 'nombre del canjeable') } : {}),
        ...(input.pointsCost !== undefined ? { pointsCost: this.parsePointsCost(input.pointsCost) } : {}),
        ...(input.status !== undefined ? { status: this.parseCatalogStatus(input.status) } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: this.optionalText(input.imageUrl) } : {}),
        ...(input.description !== undefined ? { description: this.optionalText(input.description) } : {}),
        ...(input.order !== undefined ? { order: this.parseOrder(input.order) } : {}),
      },
    });
  }

  async deleteRedeemableProduct(id: string) {
    await this.requireRedeemableProduct(id);

    const redemptionsCount = await this.prisma.rewardRedemption.count({
      where: { redeemableProductId: id },
    });

    if (redemptionsCount > 0) {
      throw new ConflictException('No se puede eliminar un canjeable con historial. Desactívalo para ocultarlo del menú.');
    }

    await this.prisma.redeemableProduct.delete({ where: { id } });
    return { ok: true };
  }

  async redeemProduct(customerId: string, redeemableProductId: string) {
    return this.prisma.$transaction(async (tx) => {
      const [customer, product] = await Promise.all([
        tx.customer.findUnique({
          where: { id: customerId },
          select: this.customerPublicSelect(),
        }),
        tx.redeemableProduct.findUnique({ where: { id: redeemableProductId } }),
      ]);

      if (!customer) {
        throw new NotFoundException('Cliente no encontrado.');
      }

      if (!product || product.status !== 'active') {
        throw new NotFoundException('Producto canjeable no disponible.');
      }

      if (customer.points < product.pointsCost) {
        throw new BadRequestException('Puntos insuficientes para este canje.');
      }

      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          points: {
            decrement: product.pointsCost,
          },
        },
        select: this.customerPublicSelect(),
      });

      const redemption = await tx.rewardRedemption.create({
        data: {
          id: randomUUID(),
          customerId: customer.id,
          redeemableProductId: product.id,
          productName: product.name,
          pointsCost: product.pointsCost,
        },
      });

      return {
        redemption,
        customer: updatedCustomer,
      };
    });
  }

  async listCustomers(query?: string) {
    return this.prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {},
      select: {
        id: true,
        name: true,
        phone: true,
        points: true,
        favoriteBranchId: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateCustomerPoints(id: string, points: number) {
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts < 0) {
      throw new BadRequestException('Puntos inválidos.');
    }
    return this.prisma.customer.update({
      where: { id },
      data: { points: pts },
      select: this.customerPublicSelect(),
    });
  }

  async updateCustomer(id: string, input: any) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: this.requiredText(input.name, 'nombre') } : {}),
        ...(input.phone !== undefined ? { phone: this.requiredText(input.phone, 'teléfono') } : {}),
      },
      select: this.customerPublicSelect(),
    });
  }

  async deleteCustomer(id: string) {
    await this.prisma.customer.delete({ where: { id } });
    return { ok: true };
  }

  async listHomeBanners() {
    return this.prisma.homeBanner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listActivePromotions() {
    const now = new Date();

    const promotions = await this.prisma.promotion.findMany({
      where: {
        status: 'PUBLISHED',
        expiresAt: {
          gt: now,
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return promotions.map((promotion) => ({
      ...promotion,
      price: Number(promotion.price),
    }));
  }

  async listAdminPromotions() {
    await this.markExpiredPromotions();

    const promotions = await this.prisma.promotion.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return promotions.map((promotion) => ({
      ...promotion,
      price: Number(promotion.price),
    }));
  }

  async createPromotion(input: PromotionInput) {
    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + PROMOTION_LIFETIME_MS);

    return this.mapPromotion(
      await this.prisma.promotion.create({
        data: {
          id: randomUUID(),
          title: this.requiredText(input.title, 'título'),
          promoText: this.requiredText(input.promoText, 'texto de promoción'),
          description: this.requiredText(input.description, 'descripción'),
          price: this.parsePositivePrice(input.price),
          imageUrl: this.requiredText(input.imageUrl, 'imagen'),
          status: 'PUBLISHED',
          publishedAt,
          expiresAt,
        },
      }),
    );
  }

  async updatePromotion(id: string, input: PromotionInput) {
    const promotion = await this.requirePromotion(id);
    const currentStatus = this.effectivePromotionStatus(promotion.status, promotion.expiresAt);

    if (currentStatus === 'EXPIRED') {
      throw new BadRequestException('No se puede editar una promoción vencida. Queda guardada como historial.');
    }

    return this.mapPromotion(
      await this.prisma.promotion.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: this.requiredText(input.title, 'título') } : {}),
          ...(input.promoText !== undefined ? { promoText: this.requiredText(input.promoText, 'texto de promoción') } : {}),
          ...(input.description !== undefined ? { description: this.requiredText(input.description, 'descripción') } : {}),
          ...(input.price !== undefined ? { price: this.parsePositivePrice(input.price) } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: this.requiredText(input.imageUrl, 'imagen') } : {}),
        },
      }),
    );
  }

  async updatePromotionStatus(id: string, status: PromotionStatus) {
    const promotion = await this.requirePromotion(id);
    const nextStatus = this.parsePromotionStatus(status);

    if (nextStatus === 'EXPIRED') {
      return this.mapPromotion(
        await this.prisma.promotion.update({
          where: { id },
          data: { status: 'EXPIRED' },
        }),
      );
    }

    if (nextStatus === 'PAUSED' || nextStatus === 'DRAFT') {
      return this.mapPromotion(
        await this.prisma.promotion.update({
          where: { id },
          data: { status: nextStatus },
        }),
      );
    }

    const publishedAt = promotion.publishedAt ?? new Date();
    return this.mapPromotion(
      await this.prisma.promotion.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          expiresAt: new Date(publishedAt.getTime() + PROMOTION_LIFETIME_MS),
        },
      }),
    );
  }

  async savePromotionImage(input: PromotionImageInput) {
    const imageData = this.requiredText(input.imageData, 'imagen');
    const match = imageData.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);

    if (!match) {
      throw new BadRequestException('Formato de imagen inválido. Usa PNG, JPG o WEBP.');
    }

    const mimeType = match[1];
    const extension = this.imageExtension(input.fileName, mimeType);
    const buffer = Buffer.from(match[2], 'base64');

    if (!buffer.length) {
      throw new BadRequestException('La imagen está vacía.');
    }

    if (buffer.length > 6 * 1024 * 1024) {
      throw new BadRequestException('La imagen supera el límite de 6 MB.');
    }

    await mkdir(PROMOTION_UPLOAD_DIR, { recursive: true });

    const fileName = `promo_${Date.now()}_${randomUUID()}${extension}`;
    await writeFile(join(PROMOTION_UPLOAD_DIR, fileName), buffer);

    return { imageUrl: `/api/uploads/promotions/${fileName}` };
  }

  async createHomeBanner(input: any) {
    const imageUrl = this.requiredText(input.imageUrl, 'URL de la imagen');
    return this.prisma.homeBanner.create({
      data: {
        id: randomUUID(),
        imageUrl,
        title: this.optionalText(input.title),
        subtitle: this.optionalText(input.subtitle),
        buttonText: this.optionalText(input.buttonText),
        linkView: this.optionalText(input.linkView),
        order: this.parseOrder(input.order),
      },
    });
  }

  async updateHomeBanner(id: string, input: any) {
    return this.prisma.homeBanner.update({
      where: { id },
      data: {
        ...(input.imageUrl !== undefined ? { imageUrl: this.requiredText(input.imageUrl, 'URL de la imagen') } : {}),
        ...(input.title !== undefined ? { title: this.optionalText(input.title) } : {}),
        ...(input.subtitle !== undefined ? { subtitle: this.optionalText(input.subtitle) } : {}),
        ...(input.buttonText !== undefined ? { buttonText: this.optionalText(input.buttonText) } : {}),
        ...(input.linkView !== undefined ? { linkView: this.optionalText(input.linkView) } : {}),
        ...(input.order !== undefined ? { order: this.parseOrder(input.order) } : {}),
      },
    });
  }

  async deleteHomeBanner(id: string) {
    await this.prisma.homeBanner.delete({ where: { id } });
    return { ok: true };
  }

  async listSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async saveSettings(settings: Record<string, string>) {
    const upserts = Object.entries(settings).map(([key, value]) =>
      this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value ?? '') },
        create: { key, value: String(value ?? '') },
      })
    );
    await this.prisma.$transaction(upserts);
    return { ok: true };
  }

  async createFeedback(rating: number, comment: string) {
    const rate = Number(rating);
    if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
      throw new BadRequestException('Calificación inválida.');
    }
    return this.prisma.feedback.create({
      data: {
        id: randomUUID(),
        rating: rate,
        comment: this.optionalText(comment) ?? '',
      },
    });
  }

  async listFeedback() {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async trackMenuVisit() {
    const counter = await this.prisma.visitCounter.upsert({
      where: { id: MENU_VISIT_COUNTER_ID },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        id: MENU_VISIT_COUNTER_ID,
        count: 1,
      },
    });

    return { ok: true, count: counter.count };
  }

  async getMenuVisitStats() {
    const counter = await this.prisma.visitCounter.findUnique({
      where: { id: MENU_VISIT_COUNTER_ID },
    });

    return {
      count: counter?.count ?? 0,
      updatedAt: counter?.updatedAt ?? null,
    };
  }



  private catalogStatusWhere(status?: string) {
    if (status !== 'active' && status !== 'inactive') {
      return {};
    }

    return { status: status as CatalogStatus };
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }

    return category;
  }

  private async requireProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    return product;
  }

  private async requireRedeemableProduct(id: string) {
    const product = await this.prisma.redeemableProduct.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Producto canjeable no encontrado.');
    }

    return product;
  }

  private parseCatalogStatus(status?: string): CatalogStatus {
    if (status === undefined || status === '') {
      return 'active';
    }

    if (status !== 'active' && status !== 'inactive') {
      throw new BadRequestException('Estatus inválido.');
    }

    return status;
  }

  private parsePromotionStatus(status?: string): PromotionStatus {
    if (status !== 'DRAFT' && status !== 'PUBLISHED' && status !== 'PAUSED' && status !== 'EXPIRED') {
      throw new BadRequestException('Estado de promoción inválido.');
    }

    return status;
  }

  private parsePrice(value: number | string | undefined): Prisma.Decimal {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Precio inválido.');
    }

    return new Prisma.Decimal(amount);
  }

  private parsePositivePrice(value: number | string | undefined): Prisma.Decimal {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Precio inválido.');
    }

    return new Prisma.Decimal(amount);
  }

  private parseOrder(value: number | undefined): number {
    const order = Number(value ?? 999);

    if (!Number.isInteger(order) || order < 0) {
      throw new BadRequestException('Orden inválido.');
    }

    return order;
  }

  private parsePointsCost(value: number | string | undefined): number {
    const points = Number(value);

    if (!Number.isInteger(points) || points <= 0) {
      throw new BadRequestException('Puntos de canje inválidos.');
    }

    return points;
  }

  private requiredText(value: string | null | undefined, field: string): string {
    const text = value?.trim();

    if (!text) {
      throw new BadRequestException(`Falta ${field}.`);
    }

    return text;
  }

  private optionalText(value: string | null | undefined): string | null {
    const text = value?.trim();
    return text || null;
  }

  private mapProduct(product: Prisma.ProductGetPayload<{ include: { category: true } }>) {
    return {
      ...product,
      price: Number(product.price),
    };
  }

  private mapPromotion(promotion: Prisma.PromotionGetPayload<Record<string, never>>) {
    return {
      ...promotion,
      status: this.effectivePromotionStatus(promotion.status, promotion.expiresAt),
      price: Number(promotion.price),
    };
  }

  private async requirePromotion(id: string) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });

    if (!promotion) {
      throw new NotFoundException('Promoción no encontrada.');
    }

    return promotion;
  }

  private effectivePromotionStatus(status: PromotionStatus, expiresAt: Date | null): PromotionStatus {
    if (status === 'PUBLISHED' && expiresAt && expiresAt <= new Date()) {
      return 'EXPIRED';
    }

    return status;
  }

  private async markExpiredPromotions() {
    await this.prisma.promotion.updateMany({
      where: {
        status: 'PUBLISHED',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  private imageExtension(fileName: string | undefined, mimeType: string) {
    const safeExtension = extname(fileName ?? '').toLowerCase();

    if (safeExtension === '.png' || safeExtension === '.jpg' || safeExtension === '.jpeg' || safeExtension === '.webp') {
      return safeExtension;
    }

    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    return '.jpg';
  }

  private customerPublicSelect() {
    return {
      id: true,
      name: true,
      phone: true,
      points: true,
      favoriteBranchId: true,
      createdAt: true,
    } satisfies Prisma.CustomerSelect;
  }

  private fixedBranchDetails(branchName: string) {
    const normalized = branchName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalized.includes('san marcos')) {
      return FIXED_BRANCH_DETAILS.sanMarcos;
    }

    if (normalized.includes('venecia') || normalized.includes('venezia')) {
      return FIXED_BRANCH_DETAILS.venecia;
    }

    return {};
  }
}
