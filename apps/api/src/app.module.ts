import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { AutomationsModule } from './automations/automations.module';
import { ScenesModule } from './scenes/scenes.module';
import { EnergyModule } from './energy/energy.module';
import { VoiceModule } from './voice/voice.module';
import { WebsocketModule } from './websocket/websocket.module';
import { GamificationModule } from './gamification/gamification.module';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    // DemoModule ANTES do AutomationsModule: o seed do DEMO_MODE roda no
    // onModuleInit e o agendador (Automations) registra os crons em seguida.
    DemoModule,
    AutomationsModule,
    ScenesModule,
    EnergyModule,
    VoiceModule,
    WebsocketModule,
    GamificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
