import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { assertAdminKey, extractBearerToken } from '../../lib/http.js';
import { StaffAuthService } from './staff-auth.service.js';

@Controller()
export class StaffController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post('staff/login')
  login(@Body() body: unknown) {
    return this.staffAuthService.login(body);
  }

  @Post('staff/logout')
  logout(@Headers('Authorization') authHeader?: string) {
    return this.staffAuthService.logout(extractBearerToken(authHeader));
  }

  @Get('staff/me')
  me(@Headers('Authorization') authHeader?: string) {
    return this.staffAuthService.validateSession(extractBearerToken(authHeader));
  }

  // Staff accounts are provisioned by whoever holds the master admin key
  // (the same key already gating catalog/promotions administration) — there
  // is no public staff self-registration.
  @Post('admin/staff')
  createStaff(@Headers('x-admin-key') adminKey: string | undefined, @Body() body: unknown) {
    assertAdminKey(adminKey);
    return this.staffAuthService.createStaff(body);
  }
}
