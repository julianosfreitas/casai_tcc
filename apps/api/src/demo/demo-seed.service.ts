import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, DeviceStatus, DeviceType, Protocol, TriggerType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEMO_AUTOMATIONS,
  DEMO_DEVICES,
  DEMO_ROOMS,
  DEMO_SCENES,
  DEMO_USER,
  resolveActions,
} from './demo-data';

/**
 * DEMO_MODE=true (deploy público do TCC): popula usuário, dispositivos MOCK,
 * rotinas e cenas no boot, de forma idempotente. Roda como OnModuleInit ANTES
 * do AutomationsModule (ordem dos imports no AppModule) para que o agendador
 * registre os crons das rotinas semeadas neste mesmo boot.
 */
@Injectable()
export class DemoSeedService implements OnModuleInit {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('DEMO_MODE') !== 'true') return;
    this.logger.log('DEMO_MODE ativo — garantindo dados de demonstração…');
    await this.seed();
    this.logger.log('Dados de demonstração prontos.');
  }

  /** Idempotente: upsert por chaves naturais (e-mail, nome por usuário). */
  async seed(): Promise<void> {
    const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER.email },
      update: {},
      create: { email: DEMO_USER.email, name: DEMO_USER.name, passwordHash },
    });

    const roomIdByName: Record<string, string> = {};
    for (const r of DEMO_ROOMS) {
      const room = await this.prisma.room.upsert({
        where: { userId_name: { userId: user.id, name: r.name } },
        update: { order: r.order },
        create: { name: r.name, order: r.order, userId: user.id },
      });
      roomIdByName[r.name] = room.id;
    }

    const deviceIdByName: Record<string, string> = {};
    for (const d of DEMO_DEVICES) {
      const existing = await this.prisma.device.findFirst({
        where: { userId: user.id, name: d.name },
      });
      const device =
        existing ??
        (await this.prisma.device.create({
          data: {
            name: d.name,
            type: DeviceType[d.type],
            protocol: Protocol.MOCK,
            status: DeviceStatus.ONLINE,
            supportsBrightness: d.supportsBrightness ?? false,
            supportsColor: d.supportsColor ?? false,
            supportsColorTemp: d.supportsColorTemp ?? false,
            supportsEnergy: d.supportsEnergy ?? false,
            roomId: roomIdByName[d.room],
            userId: user.id,
            lastState: d.lastState,
          },
        }));
      deviceIdByName[d.name] = device.id;
    }

    for (const a of DEMO_AUTOMATIONS) {
      const exists = await this.prisma.automation.findFirst({
        where: { userId: user.id, name: a.name },
      });
      if (exists) continue;
      await this.prisma.automation.create({
        data: {
          name: a.name,
          userId: user.id,
          enabled: true,
          triggerType: TriggerType.SCHEDULE,
          triggerConfig: a.triggerConfig as unknown as Prisma.InputJsonValue,
          actions: resolveActions(a.actions, deviceIdByName) as Prisma.InputJsonValue,
        },
      });
    }

    for (const s of DEMO_SCENES) {
      const exists = await this.prisma.scene.findFirst({
        where: { userId: user.id, name: s.name },
      });
      if (exists) continue;
      await this.prisma.scene.create({
        data: {
          name: s.name,
          icon: s.icon,
          userId: user.id,
          actions: resolveActions(s.actions, deviceIdByName) as Prisma.InputJsonValue,
        },
      });
    }
  }
}
