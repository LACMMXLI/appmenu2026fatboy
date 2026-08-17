import { UnauthorizedException } from '@nestjs/common';

/** Extracts a bearer/opaque session token from an `Authorization` header. */
export function extractBearerToken(authHeader?: string): string {
  if (!authHeader) return '';
  const parts = authHeader.split(' ');
  return parts.length === 2 ? parts[1] : parts[0];
}

export function requireBearerToken(authHeader?: string): string {
  const token = extractBearerToken(authHeader);
  if (!token) {
    throw new UnauthorizedException('Falta la cabecera de Autorización.');
  }
  return token;
}

/** Master key gating administrative bootstrap actions (catalog, promos, staff accounts). */
export function assertAdminKey(adminKey: string | undefined): void {
  const expectedKey = process.env.ADMIN_CATALOG_KEY;
  if (!expectedKey || adminKey !== expectedKey) {
    throw new UnauthorizedException('Clave administrativa inválida.');
  }
}
