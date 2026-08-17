import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StaffAuthService } from './staff-auth.service.js';
import { StaffBootstrapService } from './staff-bootstrap.service.js';
import { StaffController } from './staff.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [StaffController],
  providers: [StaffAuthService, StaffBootstrapService],
  exports: [StaffAuthService],
})
export class StaffModule {}
