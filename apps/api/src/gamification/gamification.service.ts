import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LEVELS, type Achievement, type GamificationSummary } from './gamification.types';

interface TriggerWithTime {
  time?: string;
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tudo é derivado das tabelas existentes a cada chamada — sem estado novo,
   * sem migration. Barato no volume de um lar (dezenas de linhas).
   */
  async summary(userId: string): Promise<GamificationSummary> {
    const [devices, realDevices, automations, scenes, voiceOk, energyReadings, automationRows] =
      await Promise.all([
        this.prisma.device.count({ where: { userId } }),
        this.prisma.device.count({ where: { userId, protocol: { in: ['TUYA', 'TAPO'] } } }),
        this.prisma.automation.count({ where: { userId } }),
        this.prisma.scene.count({ where: { userId } }),
        this.prisma.voiceCommand.count({ where: { userId, success: true } }),
        this.prisma.energyReading.count({ where: { device: { userId } } }),
        this.prisma.automation.findMany({
          where: { userId },
          select: { triggerConfig: true },
        }),
      ]);

    const triggerHours = automationRows
      .map((a) => (a.triggerConfig as TriggerWithTime | null)?.time)
      .filter((t): t is string => typeof t === 'string')
      .map((t) => Number(t.split(':')[0]))
      .filter((h) => Number.isFinite(h));

    const points =
      devices * 15 +
      realDevices * 25 + // bônus por hardware de verdade (Tuya/Tapo)
      automations * 30 +
      scenes * 20 +
      Math.min(voiceOk, 40) * 5 + // teto evita farmar pontos só falando
      (energyReadings > 0 ? 20 : 0);

    const achievements: Achievement[] = [
      this.ach(
        'bem-vindo',
        'Bem-vindo ao CASAI',
        'Criou sua conta na casa inteligente',
        'home',
        true,
      ),
      this.ach(
        'casa-conectada',
        'Casa Conectada',
        'Cadastrou o primeiro dispositivo',
        'plug',
        devices >= 1,
      ),
      this.ach(
        'colecionador',
        'Colecionador',
        'Três ou mais dispositivos na rede',
        'layers',
        devices >= 3,
      ),
      this.ach(
        'mundo-real',
        'Mundo Real',
        'Conectou um aparelho físico (Tuya/Intelbras ou Tapo)',
        'cpu',
        realDevices >= 1,
      ),
      this.ach(
        'primeira-rotina',
        'Primeira Rotina',
        'Criou sua primeira automação',
        'clock',
        automations >= 1,
      ),
      this.ach(
        'piloto-automatico',
        'Piloto Automático',
        'Três ou mais rotinas ativas',
        'sparkles',
        automations >= 3,
      ),
      this.ach(
        'cenografo',
        'Cenógrafo',
        'Criou uma cena para ativar com um toque',
        'wand',
        scenes >= 1,
      ),
      this.ach('voz-ativa', 'Voz Ativa', 'Primeiro comando de voz executado', 'mic', voiceOk >= 1),
      this.ach(
        'tagarela',
        'Tagarela',
        'Dez comandos de voz com sucesso',
        'message-circle',
        voiceOk >= 10,
      ),
      this.ach(
        'cacador-de-watts',
        'Caçador de Watts',
        'Mediu o consumo de energia de um aparelho',
        'zap',
        energyReadings > 0,
      ),
      this.ach(
        'madrugador',
        'Madrugador',
        'Rotina agendada entre 5h e 8h',
        'sunrise',
        triggerHours.some((h) => h >= 5 && h < 8),
      ),
      this.ach(
        'coruja',
        'Coruja',
        'Rotina agendada entre 22h e 6h',
        'moon',
        triggerHours.some((h) => h >= 22 || h < 6),
      ),
    ];

    const levelIndex = LEVELS.reduce((acc, l, i) => (points >= l.minPoints ? i : acc), 0);
    const level = LEVELS[levelIndex];
    const next = LEVELS[levelIndex + 1] ?? null;
    const progress = next
      ? Math.round(((points - level.minPoints) / (next.minPoints - level.minPoints)) * 100)
      : 100;

    return {
      points,
      level: {
        index: levelIndex,
        name: level.name,
        minPoints: level.minPoints,
        nextAt: next?.minPoints ?? null,
      },
      progress,
      achievements,
      stats: { devices, realDevices, automations, scenes, voiceOk, energyReadings },
    };
  }

  private ach(
    id: string,
    title: string,
    description: string,
    icon: string,
    unlocked: boolean,
  ): Achievement {
    return { id, title, description, icon, unlocked };
  }
}
