import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
