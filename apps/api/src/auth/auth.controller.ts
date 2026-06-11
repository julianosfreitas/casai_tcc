import { Body, Controller, HttpCode, HttpStatus, Post, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { RefreshDto } from './dto/refresh.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('sign_up')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto.email, dto.name, dto.password);
  }

  // Rate-limit estrito no login: 5 tentativas por minuto (anti força-bruta). CRÍTICO.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('sign_in')
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto.email, dto.password);
  }

  // Mesmo rate-limit do sign_in: o custo de validar tokens forjados não é nulo.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('google')
  google(@Body() dto: GoogleSignInDto) {
    return this.auth.signInWithGoogle(dto.idToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Protegida: precisa de access token válido; revoga o refresh token informado.
  @HttpCode(HttpStatus.OK)
  @Post('sign_out')
  async signOut(@CurrentUser() user: AuthUser, @Body() dto: RefreshDto): Promise<{ ok: true }> {
    await this.auth.signOut(user.id, dto.refreshToken);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }
}
