import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CatalogStatus, Prisma, PromotionStatus } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import ExcelJS from 'exceljs';
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

interface ImproveProductDescriptionInput {
  description?: string | null;
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

interface CatalogWorkbookInput {
  fileName?: string;
  fileData?: string;
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

  async exportCatalogWorkbook() {
    const catalog = await this.listAdminCatalog();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fatboy Menu Admin';
    workbook.created = new Date();

    const instructions = workbook.addWorksheet('INSTRUCCIONES');
    instructions.columns = [{ width: 24 }, { width: 90 }];
    instructions.addRows([
      ['ARCHIVO', 'Catálogo de productos Fatboy'],
      ['USO', 'Modifica los valores en las hojas de categorías y vuelve a importar este mismo archivo desde el panel administrativo.'],
      ['IMPORTANTE', 'No cambies ni elimines las columnas ocultas ID_NO_MODIFICAR y CATEGORIA_ID_NO_MODIFICAR.'],
      ['SEGURIDAD', 'La importación solo actualiza productos existentes. No crea, duplica ni elimina productos.'],
      ['CAMPOS', 'Puedes modificar nombre, precio, estado, descripciones, URL de imagen, orden y datos de promoción.'],
      ['ESTADO', 'Usa active o inactive. Para Es_promocion usa SI o NO.'],
    ]);
    instructions.getColumn(1).font = { bold: true, color: { argb: 'FFE8000A' } };
    instructions.getRow(1).font = { bold: true, size: 14 };
    instructions.views = [{ state: 'frozen', ySplit: 1 }];

    const usedNames = new Set<string>(['INSTRUCCIONES']);
    for (const category of catalog.categories) {
      const worksheet = workbook.addWorksheet(this.uniqueWorksheetName(category.name, usedNames));
      worksheet.columns = [
        { header: 'ID_NO_MODIFICAR', key: 'id', width: 38, hidden: true },
        { header: 'CATEGORIA_ID_NO_MODIFICAR', key: 'categoryId', width: 38, hidden: true },
        { header: 'Categoría', key: 'category', width: 24 },
        { header: 'Nombre', key: 'name', width: 32 },
        { header: 'Precio', key: 'price', width: 13 },
        { header: 'Estado', key: 'status', width: 13 },
        { header: 'Descripción', key: 'description', width: 52 },
        { header: 'Descripción corta', key: 'shortDescription', width: 38 },
        { header: 'URL imagen', key: 'imageUrl', width: 48 },
        { header: 'Orden', key: 'order', width: 10 },
        { header: 'Es promoción', key: 'isPromotion', width: 15 },
        { header: 'Etiqueta promoción', key: 'promotionTag', width: 22 },
        { header: 'Color etiqueta', key: 'promotionTagColor', width: 18 },
      ];

      for (const product of catalog.products.filter((item) => item.categoryId === category.id)) {
        worksheet.addRow({
          id: product.id,
          categoryId: product.categoryId,
          category: category.name,
          name: product.name,
          price: Number(product.price),
          status: product.status,
          description: product.description ?? '',
          shortDescription: product.shortDescription ?? '',
          imageUrl: product.imageUrl ?? '',
          order: product.order,
          isPromotion: product.isPromotion ? 'SI' : 'NO',
          promotionTag: product.promotionTag ?? '',
          promotionTagColor: product.promotionTagColor ?? '',
        });
      }

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      worksheet.autoFilter = { from: 'C1', to: 'M1' };
      worksheet.getRow(1).height = 28;
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8000A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      worksheet.getColumn('price').numFmt = '$#,##0.00';
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importCatalogWorkbook(input: CatalogWorkbookInput) {
    const fileName = this.requiredText(input.fileName, 'nombre del archivo');
    if (!fileName.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('El archivo debe tener formato .xlsx.');
    }
    if (!input.fileData || typeof input.fileData !== 'string') {
      throw new BadRequestException('No se recibió el archivo del catálogo.');
    }

    const buffer = Buffer.from(input.fileData, 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException('El archivo está vacío o supera el límite de 8 MB.');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel. Descarga una copia nueva e inténtalo otra vez.');
    }

    const rows: Array<{ id: string; categoryId: string; data: Prisma.ProductUpdateInput; row: number; sheet: string }> = [];
    const seenIds = new Set<string>();
    for (const worksheet of workbook.worksheets) {
      if (worksheet.name === 'INSTRUCCIONES' || worksheet.rowCount < 2) continue;
      const headers = worksheet.getRow(1).values as unknown[];
      const expectedHeaders = ['ID_NO_MODIFICAR', 'CATEGORIA_ID_NO_MODIFICAR', 'Categoría', 'Nombre', 'Precio', 'Estado', 'Descripción', 'Descripción corta', 'URL imagen', 'Orden', 'Es promoción', 'Etiqueta promoción', 'Color etiqueta'];
      if (expectedHeaders.some((header, index) => this.excelText(headers[index + 1]) !== header)) {
        throw new BadRequestException(`La hoja "${worksheet.name}" no conserva el formato original.`);
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const id = this.excelText(row.getCell(1).value).trim();
        if (!id) return;
        if (seenIds.has(id)) throw new BadRequestException(`El producto ${id} aparece más de una vez en el archivo.`);
        seenIds.add(id);

        const categoryId = this.excelText(row.getCell(2).value).trim();
        const name = this.requiredText(this.excelText(row.getCell(4).value), `nombre en ${worksheet.name}, fila ${rowNumber}`);
        const status = this.parseCatalogStatus(this.excelText(row.getCell(6).value));
        const promotionValue = this.excelText(row.getCell(11).value).trim().toUpperCase();
        if (!['SI', 'SÍ', 'NO', 'TRUE', 'FALSE', '1', '0'].includes(promotionValue)) {
          throw new BadRequestException(`Es promoción debe ser SI o NO en ${worksheet.name}, fila ${rowNumber}.`);
        }
        rows.push({
          id,
          categoryId,
          row: rowNumber,
          sheet: worksheet.name,
          data: {
            name,
            price: this.parsePrice(this.excelText(row.getCell(5).value)),
            category: { connect: { id: categoryId } },
            status,
            description: this.optionalText(this.excelText(row.getCell(7).value)),
            shortDescription: this.optionalText(this.excelText(row.getCell(8).value)),
            imageUrl: this.optionalText(this.excelText(row.getCell(9).value)),
            order: this.parseOrder(this.excelText(row.getCell(10).value)),
            isPromotion: ['SI', 'SÍ', 'TRUE', '1'].includes(promotionValue),
            promotionTag: this.optionalText(this.excelText(row.getCell(12).value)),
            promotionTagColor: this.optionalText(this.excelText(row.getCell(13).value)),
          },
        });
      });
    }

    if (!rows.length) throw new BadRequestException('El archivo no contiene productos para actualizar.');
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: rows.map((row) => row.id) } }, select: { id: true } }),
      this.prisma.category.findMany({ where: { id: { in: rows.map((row) => row.categoryId) } }, select: { id: true } }),
    ]);
    const productIds = new Set(products.map((product) => product.id));
    const categoryIds = new Set(categories.map((category) => category.id));
    const missingProduct = rows.find((row) => !productIds.has(row.id));
    if (missingProduct) throw new BadRequestException(`Producto desconocido en ${missingProduct.sheet}, fila ${missingProduct.row}. Descarga una copia nueva.`);
    const missingCategory = rows.find((row) => !categoryIds.has(row.categoryId));
    if (missingCategory) throw new BadRequestException(`Categoría inválida en ${missingCategory.sheet}, fila ${missingCategory.row}.`);

    await this.prisma.$transaction(rows.map((row) => this.prisma.product.update({ where: { id: row.id }, data: row.data })));
    return { ok: true, updated: rows.length };
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

  async improveProductDescription(id: string, input: ImproveProductDescriptionInput) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Configura GEMINI_API_KEY en el backend para usar la mejora con IA.');
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado.');

    const currentDescription = input.description !== undefined
      ? this.optionalText(input.description) ?? ''
      : product.description ?? '';
    if (currentDescription.length > 1500) {
      throw new BadRequestException('La descripción actual es demasiado extensa para mejorarla.');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
        contents: [
          `Producto: ${product.name}`,
          `Categoría: ${product.category.name}`,
          `Descripción actual: ${currentDescription || '(sin descripción)'}`,
          'Redacta una versión mejorada.',
        ].join('\n'),
        config: {
          abortSignal: AbortSignal.timeout(20_000),
          temperature: 0.65,
          maxOutputTokens: 180,
          systemInstruction: [
            'Eres redactor de menús para un restaurante mexicano llamado Fatboy.',
            'Devuelve solamente una descripción comercial en español de México, sin título, comillas, listas ni Markdown.',
            'Debe ser clara, apetecible y natural, con máximo 320 caracteres.',
            'Conserva los datos de la descripción original y nunca inventes ingredientes, tamaños, promociones, precios ni afirmaciones.',
            'Si no hay descripción previa, usa solo el nombre y la categoría sin asumir ingredientes.',
          ].join(' '),
        },
      });

      const description = response.text?.trim().replace(/^["“]|["”]$/g, '');
      if (!description) throw new Error('Respuesta vacía');
      return { description: description.slice(0, 320) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('La IA no pudo generar una descripción en este momento. Intenta nuevamente.');
    }
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

  private parseOrder(value: number | string | undefined): number {
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

  private uniqueWorksheetName(categoryName: string, usedNames: Set<string>) {
    const base = categoryName.replace(/[\\/*?:\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Categoría';
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate.toUpperCase())) {
      const marker = ` (${suffix++})`;
      candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    }
    usedNames.add(candidate.toUpperCase());
    return candidate;
  }

  private excelText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      const cell = value as { result?: unknown; text?: unknown; richText?: Array<{ text?: string }> };
      if (cell.result !== undefined) return this.excelText(cell.result);
      if (typeof cell.text === 'string') return cell.text;
      if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text ?? '').join('');
    }
    return '';
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
