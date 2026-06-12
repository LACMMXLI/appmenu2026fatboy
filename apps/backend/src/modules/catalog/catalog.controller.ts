import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

interface CategoryBody {
  name?: string;
  order?: number;
  status?: string;
}

interface ProductBody {
  name?: string;
  price?: number | string;
  categoryId?: string;
  status?: string;
  description?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  isPromotion?: boolean;
  promotionTag?: string | null;
  promotionTagColor?: string | null;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('branches')
  branches() {
    return this.catalogService.listBranches();
  }

  @Get('categories')
  categories(@Query('status') status?: string) {
    return this.catalogService.listCategories(status);
  }

  @Get('products')
  products(
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('q') query?: string,
  ) {
    return this.catalogService.listProducts({ categoryId, status, query });
  }

  @Get('admin/catalog')
  adminCatalog(@Headers('x-admin-key') adminKey?: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.listAdminCatalog();
  }

  @Post('admin/categories')
  createCategory(@Headers('x-admin-key') adminKey: string | undefined, @Body() body: CategoryBody) {
    this.assertAdmin(adminKey);
    return this.catalogService.createCategory(body);
  }

  @Patch('admin/categories/:id')
  updateCategory(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: CategoryBody,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updateCategory(id, body);
  }

  @Delete('admin/categories/:id')
  deleteCategory(@Headers('x-admin-key') adminKey: string | undefined, @Param('id') id: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.deleteCategory(id);
  }

  @Post('admin/products')
  createProduct(@Headers('x-admin-key') adminKey: string | undefined, @Body() body: ProductBody) {
    this.assertAdmin(adminKey);
    return this.catalogService.createProduct(body);
  }

  @Patch('admin/products/:id')
  updateProduct(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: ProductBody,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updateProduct(id, body);
  }

  @Delete('admin/products/:id')
  deleteProduct(@Headers('x-admin-key') adminKey: string | undefined, @Param('id') id: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.deleteProduct(id);
  }

  @Get('admin/customers')
  adminCustomers(@Headers('x-admin-key') adminKey: string | undefined, @Query('q') query?: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.listCustomers(query);
  }

  @Patch('admin/customers/:id/points')
  updateCustomerPoints(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body('points') points: number,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updateCustomerPoints(id, points);
  }

  @Patch('admin/customers/:id')
  updateCustomer(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updateCustomer(id, body);
  }

  @Delete('admin/customers/:id')
  deleteCustomer(@Headers('x-admin-key') adminKey: string | undefined, @Param('id') id: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.deleteCustomer(id);
  }

  @Get('home-banners')
  homeBanners() {
    return this.catalogService.listHomeBanners();
  }

  @Post('admin/home-banners')
  createHomeBanner(@Headers('x-admin-key') adminKey: string | undefined, @Body() body: any) {
    this.assertAdmin(adminKey);
    return this.catalogService.createHomeBanner(body);
  }

  @Patch('admin/home-banners/:id')
  updateHomeBanner(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updateHomeBanner(id, body);
  }

  @Delete('admin/home-banners/:id')
  deleteHomeBanner(@Headers('x-admin-key') adminKey: string | undefined, @Param('id') id: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.deleteHomeBanner(id);
  }

  @Get('settings')
  getSettings() {
    return this.catalogService.listSettings();
  }

  @Post('admin/settings')
  saveSettings(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Body('settings') settings: Record<string, string>,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.saveSettings(settings);
  }

  @Post('feedback')
  createFeedback(@Body('rating') rating: number, @Body('comment') comment: string) {
    return this.catalogService.createFeedback(rating, comment);
  }

  @Get('admin/feedback')
  adminFeedback(@Headers('x-admin-key') adminKey: string | undefined) {
    this.assertAdmin(adminKey);
    return this.catalogService.listFeedback();
  }

  private assertAdmin(adminKey?: string) {

    const expectedKey = process.env.ADMIN_CATALOG_KEY;

    if (!expectedKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Clave administrativa inválida.');
    }
  }
}
