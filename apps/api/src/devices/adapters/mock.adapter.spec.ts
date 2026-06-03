import { NotImplementedException } from '@nestjs/common';
import { MockAdapter } from './mock.adapter';
import type { AdapterContext } from '../device-adapter.interface';

function ctx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    deviceId: 'd1',
    name: 'Luz',
    supportsBrightness: true,
    supportsColor: true,
    supportsColorTemp: true,
    supportsEnergy: false,
    ...overrides,
  };
}

describe('MockAdapter', () => {
  it('liga, desliga e alterna', async () => {
    const a = new MockAdapter(ctx());
    await a.connect();
    await a.turnOn();
    expect((await a.readState()).on).toBe(true);
    await a.turnOff();
    expect((await a.readState()).on).toBe(false);
    await a.toggle();
    expect((await a.readState()).on).toBe(true);
  });

  it('limita o brilho a 0-100', async () => {
    const a = new MockAdapter(ctx());
    await a.setBrightness(150);
    expect((await a.readState()).brightness).toBe(100);
    await a.setBrightness(-5);
    expect((await a.readState()).brightness).toBe(0);
  });

  it('lança NotImplemented quando a capacidade não é suportada', async () => {
    const a = new MockAdapter(ctx({ supportsColor: false }));
    await expect(a.setColor('#fff')).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('readEnergy devolve null sem suporte e dados com suporte', async () => {
    const semEnergia = new MockAdapter(ctx({ supportsEnergy: false }));
    expect(await semEnergia.readEnergy()).toBeNull();

    const comEnergia = new MockAdapter(ctx({ supportsEnergy: true }));
    await comEnergia.turnOn();
    const energy = await comEnergia.readEnergy();
    expect(energy?.watts).toBeGreaterThan(0);
  });
});
