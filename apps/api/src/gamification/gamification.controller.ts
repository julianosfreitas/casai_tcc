import { Controller, Get } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.gamification.summary(user.id);
  }
}
