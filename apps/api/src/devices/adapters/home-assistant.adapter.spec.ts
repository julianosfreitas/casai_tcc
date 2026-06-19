import { NotImplementedException } from '@nestjs/common';
import {
  HomeAssistantAdapter,
  hexToRgb,
  rgbToHex,
  type HomeAssistantClient,
  type HaResponse,
} from './home-assistant.adapter';
import {
  DeviceCommandError,
  DeviceOfflineError,
  type AdapterContext,
} from '../device-adapter.interface';

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

function ctx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    deviceId: 'd1',
    name: 'Luz HA',
    externalId: 'light.sala',
    supportsBrightness: true,
    supportsColor: true,
    supportsColorTemp: true,
    supportsEnergy: false,
    ...overrides,
  };
}

/** Mock do cliente HTTP do HA: GET devolve `stateBody`; POST devolve ok. Grava as chamadas. */
function makeClient(stateBody: unknown = {}, opts: { status?: number } = {}) {
  const status = opts.status ?? 200;
  const calls: Call[] = [];
  const request = jest.fn(
    async (method: string, path: string, body?: unknown): Promise<HaResponse> => {
      calls.push({ method, path, body });
      return { status, body: method === 'GET' ? stateBody : { ok: true } };
    },
  );
  return { client: { request } as unknown as HomeAssistantClient, calls, request };
}

const last = (calls: Call[]): Call => calls[calls.length - 1];

describe('HomeAssistantAdapter', () => {
  it('exige externalId (entity_id)', () => {
    expect(
      () => new HomeAssistantAdapter(ctx({ externalId: null }), { client: makeClient().client }),
    ).toThrow(/externalId/);
  });

  it('turnOn / turnOff / toggle chamam homeassistant.<service> com entity_id', async () => {
    const m = makeClient();
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });

    await a.turnOn();
    expect(last(m.calls)).toEqual({
      method: 'POST',
      path: '/api/services/homeassistant/turn_on',
      body: { entity_id: 'light.sala' },
    });

    await a.turnOff();
    expect(last(m.calls).path).toBe('/api/services/homeassistant/turn_off');

    await a.toggle();
    expect(last(m.calls).path).toBe('/api/services/homeassistant/toggle');
  });

  it('setBrightness manda light.turn_on com brightness_pct (0-100, limitado)', async () => {
    const m = makeClient();
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });

    await a.setBrightness(60);
    expect(last(m.calls)).toEqual({
      method: 'POST',
      path: '/api/services/light/turn_on',
      body: { entity_id: 'light.sala', brightness_pct: 60 },
    });

    await a.setBrightness(150);
    expect((last(m.calls).body as { brightness_pct: number }).brightness_pct).toBe(100);
    await a.setBrightness(-10);
    expect((last(m.calls).body as { brightness_pct: number }).brightness_pct).toBe(0);
  });

  it('setColor manda light.turn_on com rgb_color', async () => {
    const m = makeClient();
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });
    await a.setColor('#FF0000');
    expect(last(m.calls)).toEqual({
      method: 'POST',
      path: '/api/services/light/turn_on',
      body: { entity_id: 'light.sala', rgb_color: [255, 0, 0] },
    });
  });

  it('setColorTemp manda light.turn_on com color_temp_kelvin', async () => {
    const m = makeClient();
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });
    await a.setColorTemp(4000);
    expect((last(m.calls).body as { color_temp_kelvin: number }).color_temp_kelvin).toBe(4000);
  });

  it('readState mapeia state/atributos (brightness 255->100, rgb->hex, kelvin)', async () => {
    const m = makeClient({
      entity_id: 'light.sala',
      state: 'on',
      attributes: { brightness: 255, color_temp_kelvin: 4000, rgb_color: [255, 0, 0] },
    });
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(last(m.calls)).toMatchObject({ method: 'GET', path: '/api/states/light.sala' });
    expect(st.on).toBe(true);
    expect(st.brightness).toBe(100);
    expect(st.colorTemp).toBe(4000);
    expect(st.color).toBe('#ff0000');
  });

  it('readState: state diferente de "on" => on=false; brightness 128 -> ~50', async () => {
    const m = makeClient({ state: 'off', attributes: { brightness: 128 } });
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.on).toBe(false);
    expect(st.brightness).toBe(50);
    expect(st.colorTemp).toBeUndefined();
    expect(st.color).toBeUndefined();
  });

  it('lança NotImplemented quando a capacidade não é suportada', async () => {
    const a = new HomeAssistantAdapter(
      ctx({ supportsBrightness: false, supportsColor: false, supportsColorTemp: false }),
      { client: makeClient().client },
    );
    await expect(a.setBrightness(50)).rejects.toBeInstanceOf(NotImplementedException);
    await expect(a.setColor('#fff000')).rejects.toBeInstanceOf(NotImplementedException);
    await expect(a.setColorTemp(4000)).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('lança DeviceOfflineError quando o cliente rejeita (rede/timeout)', async () => {
    const client = {
      request: jest.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as HomeAssistantClient;
    const a = new HomeAssistantAdapter(ctx(), { client });
    await expect(a.readState()).rejects.toBeInstanceOf(DeviceOfflineError);
  });

  it('lança DeviceOfflineError em status 5xx (HA com erro de servidor)', async () => {
    const m = makeClient({}, { status: 502 });
    const a = new HomeAssistantAdapter(ctx(), { client: m.client });
    await expect(a.turnOn()).rejects.toBeInstanceOf(DeviceOfflineError);
  });

  it('lança DeviceCommandError em 4xx (entidade inexistente / token inválido)', async () => {
    const m404 = makeClient({}, { status: 404 });
    await expect(
      new HomeAssistantAdapter(ctx(), { client: m404.client }).readState(),
    ).rejects.toBeInstanceOf(DeviceCommandError);

    const m401 = makeClient({}, { status: 401 });
    await expect(
      new HomeAssistantAdapter(ctx(), { client: m401.client }).turnOn(),
    ).rejects.toBeInstanceOf(DeviceCommandError);
  });

  it('readEnergy é null (energia é entidade separada no HA)', async () => {
    const a = new HomeAssistantAdapter(ctx(), { client: makeClient().client });
    expect(await a.readEnergy()).toBeNull();
  });

  it('connect/disconnect são no-op (HA REST é stateless)', async () => {
    const a = new HomeAssistantAdapter(ctx(), { client: makeClient().client });
    await expect(a.connect()).resolves.toBeUndefined();
    await expect(a.disconnect()).resolves.toBeUndefined();
  });

  it('hexToRgb / rgbToHex são inversos', () => {
    expect(hexToRgb('#4F8EF7')).toEqual([79, 142, 247]);
    expect(rgbToHex([79, 142, 247])).toBe('#4f8ef7');
    expect(rgbToHex(hexToRgb('#000000'))).toBe('#000000');
  });
});
