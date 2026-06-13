import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ProductImageTarget {
  productId: string;
  categoryName: string;
  currentImageUrl?: string | null;
  role?: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

@Injectable()
export class StorageService {
  private readonly bucket = process.env.MINIO_BUCKET || 'menu-fatboy';
  private readonly publicUrl = process.env.MINIO_PUBLIC_URL?.replace(/\/$/, '') || '';
  private client?: Client;

  async replaceProductImage(target: ProductImageTarget, file: UploadedImageFile) {
    const processedFile = await this.prepareImageForUpload(file);
    return this.uploadProductImage(target, processedFile);
  }

  async uploadProductImage(target: ProductImageTarget, file: UploadedImageFile) {
    this.validateImageFile(file);

    const previousObjectKey = this.resolveManagedObjectKey(target.currentImageUrl);
    const objectKey = this.generateObjectKey({
      productId: target.productId,
      categoryName: target.categoryName,
      role: target.role ?? 'main',
      version: this.resolveNextVersion(previousObjectKey),
      extension: this.resolveExtension(file),
    });

    await this.ensureBucket();

    try {
      await this.getClient().putObject(this.bucket, objectKey, file.buffer, file.size, {
        'Content-Type': file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype,
      });
    } catch {
      throw new InternalServerErrorException('No se pudo guardar imagen en MinIO.');
    }

    return {
      bucket: this.bucket,
      objectKey,
      publicUrl: this.getPublicUrl(objectKey),
      previousObjectKey,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteProductImage(objectKey?: string | null) {
    if (!objectKey) return;

    await this.ensureBucket();

    try {
      await this.getClient().removeObject(this.bucket, objectKey);
    } catch {
      throw new InternalServerErrorException('No se pudo eliminar imagen anterior de MinIO.');
    }
  }

  async relocateProductImage(target: ProductImageTarget) {
    const previousObjectKey = this.resolveManagedObjectKey(target.currentImageUrl);
    if (!previousObjectKey) return null;

    await this.ensureBucket();

    const parsed = this.parseObjectKey(previousObjectKey);
    const objectKey = this.generateObjectKey({
      productId: target.productId,
      categoryName: target.categoryName,
      role: target.role ?? parsed.role ?? 'main',
      version: this.resolveNextVersion(previousObjectKey),
      extension: parsed.extension || 'webp',
    });

    let fileBuffer: Buffer;
    try {
      const stream = await this.getClient().getObject(this.bucket, previousObjectKey);
      fileBuffer = await this.streamToBuffer(stream);
    } catch {
      throw new InternalServerErrorException('No se pudo leer imagen anterior desde MinIO.');
    }

    try {
      await this.getClient().putObject(this.bucket, objectKey, fileBuffer, fileBuffer.length, {
        'Content-Type': this.resolveContentType(parsed.extension),
      });
    } catch {
      throw new InternalServerErrorException('No se pudo guardar imagen en MinIO.');
    }

    await this.deleteProductImage(previousObjectKey);

    return {
      bucket: this.bucket,
      objectKey,
      publicUrl: this.getPublicUrl(objectKey),
      previousObjectKey,
    };
  }

  getPublicUrl(objectKey: string) {
    if (!this.publicUrl) {
      throw new InternalServerErrorException('MINIO_PUBLIC_URL no está configurado.');
    }

    return `${this.publicUrl}/${objectKey.replace(/^\/+/, '')}`;
  }

  generateObjectKey(input: {
    productId: string;
    categoryName: string;
    role: string;
    version: number;
    extension: string;
  }) {
    const categorySlug = this.slugify(input.categoryName);
    const role = this.slugify(input.role) || 'main';
    const extension = input.extension.replace(/^\./, '').toLowerCase() || 'webp';
    const shortUuid = randomUUID().replace(/-/g, '').slice(0, 8);

    return [
      'categories',
      categorySlug,
      'products',
      input.productId,
      `${role}_v${input.version}_${shortUuid}.${extension}`,
    ].join('/');
  }

  private getClient() {
    if (this.client) return this.client;

    const endpoint = process.env.MINIO_ENDPOINT?.trim();
    const accessKey = process.env.MINIO_ACCESS_KEY?.trim();
    const secretKey = process.env.MINIO_SECRET_KEY?.trim();

    if (!endpoint || !accessKey || !secretKey) {
      throw new InternalServerErrorException('No se pudo conectar a MinIO: faltan variables de entorno.');
    }

    this.client = new Client({
      endPoint: endpoint,
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey,
      secretKey,
    });

    return this.client;
  }

  private async ensureBucket() {
    let exists = false;

    try {
      exists = await this.getClient().bucketExists(this.bucket);
    } catch {
      throw new InternalServerErrorException('No se pudo conectar a MinIO.');
    }

    if (exists) return;

    if (process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException(`Bucket no existe en MinIO: ${this.bucket}.`);
    }

    try {
      await this.getClient().makeBucket(this.bucket);
    } catch {
      throw new InternalServerErrorException(`Bucket no existe y no se pudo crear en MinIO: ${this.bucket}.`);
    }
  }

  private validateImageFile(file: UploadedImageFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Imagen inválida.');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Archivo demasiado grande. Máximo permitido: 5 MB.');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Imagen inválida. Solo se permite PNG, JPG, JPEG o WEBP.');
    }

    const realMimeType = this.detectImageMimeType(file.buffer);
    if (!realMimeType || !ALLOWED_MIME_TYPES.has(realMimeType)) {
      throw new BadRequestException('Imagen inválida. El archivo no coincide con una imagen permitida.');
    }
  }

  private async prepareImageForUpload(file: UploadedImageFile) {
    // Hook preparado para sharp: convertir a webp, normalizar dimensiones o extraer metadata.
    return file;
  }

  private detectImageMimeType(buffer: Buffer) {
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }

    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
      return 'image/png';
    }

    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    return null;
  }

  private resolveExtension(file: UploadedImageFile) {
    const realMimeType = this.detectImageMimeType(file.buffer);
    if (realMimeType === 'image/png') return 'png';
    if (realMimeType === 'image/jpeg') return 'jpg';
    return 'webp';
  }

  private resolveNextVersion(objectKey?: string | null) {
    if (!objectKey) return 1;

    const match = objectKey.match(/_v(\d+)_/);
    if (!match) return 1;

    return Number(match[1]) + 1;
  }

  private resolveManagedObjectKey(value?: string | null) {
    const imageValue = value?.trim();
    if (!imageValue) return null;

    const normalizedPublicUrl = this.publicUrl ? `${this.publicUrl}/` : '';
    if (normalizedPublicUrl && imageValue.startsWith(normalizedPublicUrl)) {
      return imageValue.slice(normalizedPublicUrl.length).replace(/^\/+/, '');
    }

    if (imageValue.startsWith('/categories/')) {
      return imageValue.slice(1);
    }

    if (imageValue.startsWith('categories/')) {
      return imageValue;
    }

    return null;
  }

  private parseObjectKey(objectKey: string) {
    const filename = objectKey.split('/').pop() ?? '';
    const match = filename.match(/^([^_]+)_v\d+_[^.]+\.([a-z0-9]+)$/i);

    return {
      role: match?.[1],
      extension: match?.[2]?.toLowerCase(),
    };
  }

  private resolveContentType(extension?: string) {
    if (extension === 'png') return 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    return 'image/webp';
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sin-categoria';
  }

  private async streamToBuffer(stream: Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}
