import { Module } from '@nestjs/common';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { SurveyModule } from './modules/survey/survey.module.js';

@Module({
  imports: [PrismaModule, CatalogModule, AuthModule, OrderModule, SurveyModule],
})
export class AppModule {}
