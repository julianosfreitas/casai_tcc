import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceCommandQueue } from './device-command.queue';
import { DeviceOfflineError, type DeviceAdapter } from './device-adapter.interface';

type PrismaMock = {
  device: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
};

function makeAdapter(overrides: Partial<DeviceAdapter> = {}): DeviceAdapter {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    turnOn: jest.fn().mockResolvedValue(undefined),
    turnOff: jest.fn().mockResolvedValue(undefined),
    toggle: jest.fn().mockResolvedValue(undefined),
    setBrightness: jest.fn().mockResolvedValue(undefined),
    setColor: jest.fn().mockResolvedValue(undefined),
    setColorTemp: jest.fn().mockResolvedValue(undefined),
    readState: jest.fn().mockResolvedValue({ on: true }),
    readEnergy: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('DevicesService', () => {
  let prisma: PrismaMock;
  let crypto: { encrypt: jest.Mock; decrypt: jest.Mock };
  let factory: { create: jest.Mock };
  let events: {
    emitStatusChanged: jest.Mock;
    emitOffline: jest.Mock;
    emitEnergyReading: jest.Mock;
    emitAutomationTriggered: jest.Mock;
  };
  let service: DevicesService;

  beforeEach(() => {
    prisma = {
      device: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    crypto = { encrypt: jest.fn((x: string) => `enc(${x})`), decrypt: jest.fn() };
    factory = { create: jest.fn() };
    events = {
      emitStatusChanged: jest.fn(),
      emitOffline: jest.fn(),
      emitEnergyReading: jest.fn(),
      emitAutomationTriggered: jest.fn(),
    };
    service = new DevicesService(
      prisma as never,
      crypto as never,
      factory as never,
      new DeviceCommandQueue(),
      events as never,
    );
  });

  it('create criptografa a local_key antes de salvar', async () => {
    prisma.device.create.mockResolvedValue({ id: 'd1' });
    await service.create('u1', {
      name: 'Lâmpada',
      type: 'LIGHT',
      protocol: 'TUYA',
      localKey: 'segredo123',
    } as never);

    expect(crypto.encrypt).toHaveBeenCalledWith('segredo123');
    const arg = prisma.device.create.mock.calls[0][0];
    expect(arg.data.localKeyEnc).toBe('enc(segredo123)');
    // garante que o texto puro NÃO foi persistido
    expect(JSON.stringify(arg.data)).not.toContain('"segredo123"');
  });

  it('get lança NotFound quando o dispositivo não é do usuário', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    await expect(service.get('u1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('executeCommand liga, atualiza estado e faz broadcast', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1', protocol: 'MOCK', userId: 'u1' });
    const adapter = makeAdapter({ readState: jest.fn().mockResolvedValue({ on: true }) });
    factory.create.mockReturnValue(adapter);

    const state = await service.executeCommand('u1', 'd1', { command: 'turnOn' } as never);

    expect(adapter.turnOn).toHaveBeenCalled();
    expect(state).toEqual({ on: true });
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ONLINE' }) }),
    );
    expect(events.emitStatusChanged).toHaveBeenCalledWith('u1', 'd1', { on: true }, 'ONLINE');
  });

  it('executeCommand trata offline: marca OFFLINE, avisa e responde 503', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1', protocol: 'TUYA', userId: 'u1' });
    const adapter = makeAdapter({
      connect: jest.fn().mockRejectedValue(new DeviceOfflineError('d1')),
    });
    factory.create.mockReturnValue(adapter);

    await expect(
      service.executeCommand('u1', 'd1', { command: 'turnOn' } as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(events.emitOffline).toHaveBeenCalledWith('u1', 'd1');
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OFFLINE' } }),
    );
  });

  it('reaproveita o adapter cacheado entre comandos do mesmo dispositivo', async () => {
    prisma.device.findFirst.mockResolvedValue({ id: 'd1', protocol: 'MOCK', userId: 'u1' });
    factory.create.mockReturnValue(makeAdapter());

    await service.executeCommand('u1', 'd1', { command: 'turnOn' } as never);
    await service.executeCommand('u1', 'd1', { command: 'turnOff' } as never);

    expect(factory.create).toHaveBeenCalledTimes(1);
  });
});
