import { Module } from '@nestjs/common';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { OrdersGateway } from './orders.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { StaffModule } from '../staff/staff.module.js';

@Module({
  imports: [AuthModule, StaffModule],
  controllers: [OrderController],
  providers: [OrderService, OrdersGateway],
  exports: [OrderService],
})
export class OrderModule {}
