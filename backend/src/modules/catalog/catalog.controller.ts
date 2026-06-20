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
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { join } from 'node:path';
import { CatalogService } from './catalog.service.js';
import { AuthService } from '../auth/auth.service.js';

interface CategoryBody {
  name?: string;
  order?: number;
  status?: string;
  imageUrl?: string | null;
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

interface RedeemableProductBody {
  name?: string;
  pointsCost?: number | string;
  status?: string;
  imageUrl?: string | null;
  description?: string | null;
  order?: number;
}

interface PromotionBody {
  title?: string;
  promoText?: string;
  description?: string;
  price?: number | string;
  imageUrl?: string | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'EXPIRED';
}

@Controller()
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly authService: AuthService,
  ) {}

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

  @Get('redeemable-products')
  redeemableProducts() {
    return this.catalogService.listRedeemableProducts('active');
  }

  @Post('redeemable-products/:id/redeem')
  async redeemProduct(@Headers('Authorization') authHeader: string | undefined, @Param('id') id: string) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Para canjear puntos debes iniciar sesión.');
    }

    const customer = await this.authService.validateSession(token);
    return this.catalogService.redeemProduct(customer.id, id);
  }

  @Get('admin/catalog')
  adminCatalog(@Headers('x-admin-key') adminKey?: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.listAdminCatalog();
  }

  @Get('admin/catalog/export')
  async exportCatalog(@Headers('x-admin-key') adminKey: string | undefined, @Res() res: any) {
    this.assertAdmin(adminKey);
    const file = await this.catalogService.exportCatalogWorkbook();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo-fatboy-${date}.xlsx"`);
    res.setHeader('Content-Length', file.length);
    return res.send(file);
  }

  @Post('admin/catalog/import')
  importCatalog(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Body() body: { fileName?: string; fileData?: string },
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.importCatalogWorkbook(body);
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

  @Post('admin/products/:id/improve-description')
  improveProductDescription(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: { description?: string | null },
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.improveProductDescription(id, body);
  }

  @Delete('admin/products/:id')
  deleteProduct(@Headers('x-admin-key') adminKey: string | undefined, @Param('id') id: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.deleteProduct(id);
  }

  @Get('admin/redeemable-products')
  adminRedeemableProducts(@Headers('x-admin-key') adminKey?: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.listAdminRedeemableProducts();
  }

  @Get('admin/reward-redemptions')
  adminRewardRedemptions(@Headers('x-admin-key') adminKey?: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.listRewardRedemptions();
  }

  @Post('admin/redeemable-products')
  createRedeemableProduct(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Body() body: RedeemableProductBody,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.createRedeemableProduct(body);
  }

  @Patch('admin/redeemable-products/:id')
  updateRedeemableProduct(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: RedeemableProductBody,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updateRedeemableProduct(id, body);
  }

  @Delete('admin/redeemable-products/:id')
  deleteRedeemableProduct(@Headers('x-admin-key') adminKey: string | undefined, @Param('id') id: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.deleteRedeemableProduct(id);
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

  @Get('promotions')
  promotions() {
    return this.catalogService.listActivePromotions();
  }

  @Get('uploads/promotions/:fileName')
  promotionUpload(@Param('fileName') fileName: string, @Res() res: any) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
      throw new UnauthorizedException('Archivo inválido.');
    }

    return res.sendFile(join(process.cwd(), 'uploads', 'promotions', fileName));
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

  @Get('admin/promotions')
  adminPromotions(@Headers('x-admin-key') adminKey?: string) {
    this.assertAdmin(adminKey);
    return this.catalogService.listAdminPromotions();
  }

  @Post('admin/promotions')
  createPromotion(@Headers('x-admin-key') adminKey: string | undefined, @Body() body: PromotionBody) {
    this.assertAdmin(adminKey);
    return this.catalogService.createPromotion(body);
  }

  @Patch('admin/promotions/:id')
  updatePromotion(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body() body: PromotionBody,
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updatePromotion(id, body);
  }

  @Patch('admin/promotions/:id/status')
  updatePromotionStatus(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Param('id') id: string,
    @Body('status') status: PromotionBody['status'],
  ) {
    this.assertAdmin(adminKey);
    return this.catalogService.updatePromotionStatus(id, status ?? 'DRAFT');
  }

  @Post('admin/uploads/promotion-image')
  uploadPromotionImage(@Headers('x-admin-key') adminKey: string | undefined, @Body() body: any) {
    this.assertAdmin(adminKey);
    return this.catalogService.savePromotionImage(body);
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

  @Post('visits')
  trackVisit() {
    return this.catalogService.trackMenuVisit();
  }

  @Get('admin/visits')
  adminVisits(@Headers('x-admin-key') adminKey: string | undefined) {
    this.assertAdmin(adminKey);
    return this.catalogService.getMenuVisitStats();
  }

  private assertAdmin(adminKey?: string) {

    const expectedKey = process.env.ADMIN_CATALOG_KEY;

    if (!expectedKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Clave administrativa inválida.');
    }
  }

  private extractToken(authHeader?: string): string {
    if (!authHeader) return '';
    const parts = authHeader.split(' ');
    return parts.length === 2 ? parts[1] : parts[0];
  }
}
