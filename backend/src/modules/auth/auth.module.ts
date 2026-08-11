import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 8,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitGuard],
  exports: [AuthService],
})
export class AuthModule {}
