import { Module } from '@nestjs/common';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { OrdersGateway } from './orders.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { PrintJobController } from './print-job.controller.js';
import { PrintJobService } from './print-job.service.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';

@Module({
  imports: [AuthModule, StaffModule],
  controllers: [OrderController, PrintJobController, DeliveryController],
  providers: [OrderService, OrdersGateway, PrintJobService, DeliveryService],
  exports: [OrderService],
})
export class OrderModule {}
