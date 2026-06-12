import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches() {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
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
    await this.requireProduct(id);

    if (input.categoryId !== undefined) {
      await this.requireCategory(input.categoryId);
    }

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
    });
  }

  async updateCustomer(id: string, input: any) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: this.requiredText(input.name, 'nombre') } : {}),
        ...(input.phone !== undefined ? { phone: this.requiredText(input.phone, 'teléfono') } : {}),
      },
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

  private parseCatalogStatus(status?: string): CatalogStatus {
    if (status === undefined || status === '') {
      return 'active';
    }

    if (status !== 'active' && status !== 'inactive') {
      throw new BadRequestException('Estatus inválido.');
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

  private parseOrder(value: number | undefined): number {
    const order = Number(value ?? 999);

    if (!Number.isInteger(order) || order < 0) {
      throw new BadRequestException('Orden inválido.');
    }

    return order;
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
}
