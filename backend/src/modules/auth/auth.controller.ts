import { Body, Controller, Get, Headers, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('logout')
  logout(@Headers('Authorization') authHeader?: string) {
    const token = this.extractToken(authHeader);
    return this.authService.logout(token);
  }

  @Get('profile')
  profile(@Headers('Authorization') authHeader?: string) {
    const token = this.extractToken(authHeader);
    return this.authService.validateSession(token);
  }

  @Patch('profile')
  updateProfile(@Headers('Authorization') authHeader: string | undefined, @Body() body: any) {
    const token = this.extractToken(authHeader);
    return this.authService.validateSession(token).then((customer) => {
      return this.authService.updateProfile(customer.id, body);
    });
  }

  @Patch('change-password')
  changePassword(@Headers('Authorization') authHeader: string | undefined, @Body() body: any) {
    const token = this.extractToken(authHeader);
    return this.authService.validateSession(token).then((customer) => {
      return this.authService.changePassword(customer.id, body);
    });
  }

  private extractToken(authHeader?: string): string {
    if (!authHeader) {
      throw new UnauthorizedException('Falta la cabecera de Autorización.');
    }
    const parts = authHeader.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    if (!token) {
      throw new UnauthorizedException('Token de sesión no provisto.');
    }
    return token;
  }
}
