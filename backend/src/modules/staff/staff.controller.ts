import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Post } from '@nestjs/common';
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

  @Post('staff/change-password')
  changePassword(@Headers('Authorization') authHeader: string | undefined, @Body() body: unknown) {
    return this.staffAuthService.changePassword(extractBearerToken(authHeader), body);
  }

  @Get('admin/staff')
  async listStaff(@Headers('Authorization') authHeader?: string) {
    await this.requireAdmin(authHeader);
    return this.staffAuthService.listStaff();
  }

  // Staff accounts are provisioned by an authenticated ADMIN. The master key
  // remains accepted for backward compatibility with existing operations.
  @Post('admin/staff')
  async createStaff(
    @Headers('Authorization') authHeader: string | undefined,
    @Headers('x-admin-key') adminKey: string | undefined,
    @Body() body: unknown,
  ) {
    if (adminKey) {
      assertAdminKey(adminKey);
    } else {
      await this.requireAdmin(authHeader);
    }
    return this.staffAuthService.createStaff(body);
  }

  @Patch('admin/staff/:id')
  async updateStaff(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.requireAdmin(authHeader);
    return this.staffAuthService.updateStaff(id, body);
  }

  @Post('admin/staff/:id/password')
  async resetPassword(
    @Headers('Authorization') authHeader: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.requireAdmin(authHeader);
    return this.staffAuthService.resetPassword(id, body, extractBearerToken(authHeader));
  }

  private async requireAdmin(authHeader?: string) {
    const staff = await this.staffAuthService.validateSession(extractBearerToken(authHeader));
    if (staff.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador puede gestionar usuarios.');
    }
    return staff;
  }
}
