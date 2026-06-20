import { Body, Controller, Get, Headers, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { SurveyService, type SurveyFilters, type SurveyResponseBody } from './survey.service.js';

@Controller()
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Post('survey-responses')
  create(@Body() body: SurveyResponseBody, @Req() request: any) {
    return this.surveyService.create(body, request.ip || request.socket?.remoteAddress || 'unknown', request.headers?.['user-agent']);
  }

  @Get('admin/survey-responses')
  list(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Query() filters: SurveyFilters,
  ) {
    this.assertAdmin(adminKey);
    return this.surveyService.list(filters);
  }

  private assertAdmin(adminKey?: string) {
    const expectedKey = process.env.ADMIN_CATALOG_KEY;
    if (!expectedKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Clave administrativa inválida.');
    }
  }
}
