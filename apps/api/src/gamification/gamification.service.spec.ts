import { Test } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: {
    device: { count: jest.Mock };
    automation: { count: jest.Mock; findMany: jest.Mock };
    scene: { count: jest.Mock };
    voiceCommand: { count: jest.Mock };
    energyReading: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      device: { count: jest.fn().mockResolvedValue(0) },
      automation: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      scene: { count: jest.fn().mockResolvedValue(0) },
      voiceCommand: { count: jest.fn().mockResolvedValue(0) },
      energyReading: { count: jest.fn().mockResolvedValue(0) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [GamificationService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(GamificationService);
  });

  it('conta nova: 0 pontos, nível Visitante, só a conquista de boas-vindas', async () => {
    const s = await service.summary('u1');

    expect(s.points).toBe(0);
    expect(s.level.name).toBe('Visitante');
    expect(s.achievements.find((a) => a.id === 'bem-vindo')?.unlocked).toBe(true);
    expect(s.achievements.filter((a) => a.unlocked)).toHaveLength(1);
  });

  it('soma pontos por dispositivos, rotinas, cenas e voz (com teto na voz)', async () => {
    // device.count é chamado 2x: total e só reais (TUYA/TAPO)
    prisma.device.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    prisma.automation.count.mockResolvedValue(3);
    prisma.scene.count.mockResolvedValue(2);
    prisma.voiceCommand.count.mockResolvedValue(100); // teto = 40
    prisma.energyReading.count.mockResolvedValue(5);

    const s = await service.summary('u1');

    // 4*15 + 2*25 + 3*30 + 2*20 + 40*5 + 20 = 60+50+90+40+200+20
    expect(s.points).toBe(460);
    expect(s.level.name).toBe('Engenheiro do Lar');
    expect(s.level.nextAt).toBe(500);
    expect(s.progress).toBe(80);
  });

  it('desbloqueia Madrugador e Coruja pelo horário das rotinas', async () => {
    prisma.automation.findMany.mockResolvedValue([
      { triggerConfig: { time: '07:00', weekdays: [1, 2, 3, 4, 5] } },
      { triggerConfig: { time: '23:00' } },
    ]);

    const s = await service.summary('u1');

    expect(s.achievements.find((a) => a.id === 'madrugador')?.unlocked).toBe(true);
    expect(s.achievements.find((a) => a.id === 'coruja')?.unlocked).toBe(true);
  });

  it('nível máximo reporta progress 100 e nextAt null', async () => {
    prisma.device.count.mockResolvedValueOnce(20).mockResolvedValueOnce(10);
    prisma.automation.count.mockResolvedValue(10);
    prisma.scene.count.mockResolvedValue(5);

    const s = await service.summary('u1');

    expect(s.points).toBeGreaterThanOrEqual(800);
    expect(s.level.name).toBe('Lenda da Automação');
    expect(s.level.nextAt).toBeNull();
    expect(s.progress).toBe(100);
  });
});
