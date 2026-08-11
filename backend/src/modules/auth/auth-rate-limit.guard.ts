import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'node:net';

@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cloudflareIp = this.validIp(this.firstHeaderValue(req.headers?.['cf-connecting-ip']));
    const forwardedIp = this.validIp(Array.isArray(req.ips) ? req.ips[0] : undefined);
    const requestIp = this.validIp(req.ip);
    const socketIp = this.validIp(req.socket?.remoteAddress);

    return cloudflareIp ?? forwardedIp ?? requestIp ?? socketIp ?? 'unknown';
  }

  private firstHeaderValue(value: unknown): string | undefined {
    const header = Array.isArray(value) ? value[0] : value;
    if (typeof header !== 'string') {
      return undefined;
    }

    const ip = header.split(',')[0]?.trim();
    return ip || undefined;
  }

  private validIp(value: unknown): string | undefined {
    return typeof value === 'string' && isIP(value) !== 0 ? value : undefined;
  }
}
