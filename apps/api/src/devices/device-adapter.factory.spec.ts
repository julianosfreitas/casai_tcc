import { NotImplementedException } from '@nestjs/common';
import { DeviceAdapterFactory } from './device-adapter.factory';
import { MockAdapter } from './adapters/mock.adapter';
import { TuyaAdapter } from './adapters/tuya.adapter';
import { TuyaCloudAdapter } from './adapters/tuya-cloud.adapter';
import { TapoAdapter } from './adapters/tapo.adapter';
import type { Device } from '@prisma/client';

function device(overrides: Partial<Device>): Device {
  return {
    id: 'd1',
    name: 'Dispositivo',
    type: 'LIGHT',
    protocol: 'MOCK',
    status: 'UNKNOWN',
    externalId: null,
    ip: null,
    protocolVersion: null,
    localKeyEnc: null,
    tapoEmail: null,
    tapoPassEnc: null,
    supportsBrightness: false,
    supportsColor: false,
    supportsColorTemp: false,
    supportsEnergy: false,
    lastSeen: null,
    lastState: null,
    roomId: null,
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Device;
}

describe('DeviceAdapterFactory', () => {
  const crypto = { encrypt: jest.fn(), decrypt: jest.fn(() => 'segredo-decifrado') };
  const factory = new DeviceAdapterFactory(crypto as never);

  it('cria MockAdapter para protocol MOCK', () => {
    expect(factory.create(device({ protocol: 'MOCK' }))).toBeInstanceOf(MockAdapter);
  });

  it('cria TuyaAdapter e descriptografa a local_key', () => {
    const adapter = factory.create(
      device({ protocol: 'TUYA', externalId: 'abc', ip: '192.168.0.5', localKeyEnc: 'cifrado' }),
    );
    expect(adapter).toBeInstanceOf(TuyaAdapter);
    expect(crypto.decrypt).toHaveBeenCalledWith('cifrado');
  });

  it('cria TapoAdapter com senha descriptografada', () => {
    const adapter = factory.create(
      device({ protocol: 'TAPO', ip: '192.168.0.6', tapoEmail: 'a@a.com', tapoPassEnc: 'cifrado' }),
    );
    expect(adapter).toBeInstanceOf(TapoAdapter);
  });

  it('cria TuyaCloudAdapter para protocol TUYA_CLOUD (credenciais via env)', () => {
    const prev = { ...process.env };
    process.env.TUYA_CLOUD_BASE_URL = 'https://openapi.tuyaus.com';
    process.env.TUYA_CLOUD_ACCESS_ID = 'id';
    process.env.TUYA_CLOUD_ACCESS_SECRET = 'secret';
    try {
      const adapter = factory.create(device({ protocol: 'TUYA_CLOUD', externalId: 'vdevo123' }));
      expect(adapter).toBeInstanceOf(TuyaCloudAdapter);
    } finally {
      process.env = prev;
    }
  });

  it('rejeita ZIGBEE (fase futura) com NotImplemented', () => {
    expect(() => factory.create(device({ protocol: 'ZIGBEE' }))).toThrow(NotImplementedException);
  });
});
