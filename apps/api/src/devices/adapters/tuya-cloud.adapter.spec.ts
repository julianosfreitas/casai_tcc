import { NotImplementedException } from '@nestjs/common';
import {
  DP,
  TuyaCloudAdapter,
  hexToHsv,
  hsvToHex,
  type TuyaCloudClient,
} from './tuya-cloud.adapter';
import {
  DeviceCommandError,
  DeviceOfflineError,
  type AdapterContext,
} from '../device-adapter.interface';

type StatusItem = { code: string; value: unknown };
interface RequestOpts {
  method: string;
  path: string;
  body?: { commands?: Array<{ code: string; value: unknown }> };
}

function ctx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    deviceId: 'd1',
    name: 'Luz Cloud',
    externalId: 'vdevo123',
    supportsBrightness: true,
    supportsColor: true,
    supportsColorTemp: true,
    supportsEnergy: false,
    ...overrides,
  };
}

/** Mock do conector: GET devolve `status`; POST devolve success/result=true. Grava as chamadas. */
function makeClient(
  status: StatusItem[] = [],
  opts: { wrapped?: boolean; success?: boolean } = {},
) {
  const wrapped = opts.wrapped ?? true;
  const success = opts.success ?? true;
  const calls: RequestOpts[] = [];
  const request = jest.fn(async (o: RequestOpts) => {
    calls.push(o);
    const result = o.method === 'GET' ? status : true;
    const body = {
      success,
      result,
      msg: success ? null : 'erro simulado',
      code: success ? 0 : 1010,
    };
    return wrapped ? { data: body } : body;
  });
  return { client: { request } as unknown as TuyaCloudClient, calls, request };
}

/** Extrai os commands enviados no último POST. */
function lastCommands(calls: RequestOpts[]): Array<{ code: string; value: unknown }> {
  const post = [...calls].reverse().find((c) => c.method === 'POST');
  return post?.body?.commands ?? [];
}

describe('TuyaCloudAdapter', () => {
  it('exige externalId (device id da nuvem)', () => {
    expect(
      () => new TuyaCloudAdapter(ctx({ externalId: null }), { client: makeClient().client }),
    ).toThrow(/externalId/);
  });

  it('turnOn / turnOff enviam switch_led no path correto', async () => {
    const m = makeClient();
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });

    await a.turnOn();
    expect(lastCommands(m.calls)).toEqual([{ code: DP.POWER, value: true }]);
    expect(m.calls.at(-1)?.path).toBe('/v1.0/devices/vdevo123/commands');

    await a.turnOff();
    expect(lastCommands(m.calls)).toEqual([{ code: DP.POWER, value: false }]);
  });

  it('toggle lê o estado e inverte', async () => {
    const m = makeClient([{ code: DP.POWER, value: true }]);
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    await a.toggle();
    expect(lastCommands(m.calls)).toEqual([{ code: DP.POWER, value: false }]);
  });

  it('setBrightness escala 0-100 -> 10-1000', async () => {
    const m = makeClient();
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    await a.setBrightness(50);
    expect(lastCommands(m.calls)).toEqual([{ code: DP.BRIGHTNESS, value: 505 }]);

    await a.setBrightness(0);
    expect(lastCommands(m.calls)).toEqual([{ code: DP.BRIGHTNESS, value: 10 }]);

    await a.setBrightness(100);
    expect(lastCommands(m.calls)).toEqual([{ code: DP.BRIGHTNESS, value: 1000 }]);
  });

  it('setBrightness limita acima de 100 e abaixo de 0', async () => {
    const m = makeClient();
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    await a.setBrightness(150);
    expect(lastCommands(m.calls)).toEqual([{ code: DP.BRIGHTNESS, value: 1000 }]);
    await a.setBrightness(-20);
    expect(lastCommands(m.calls)).toEqual([{ code: DP.BRIGHTNESS, value: 10 }]);
  });

  it('setColorTemp define modo branco + temp escalado', async () => {
    const m = makeClient();
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    await a.setColorTemp(4000);
    expect(lastCommands(m.calls)).toEqual([
      { code: DP.WORK_MODE, value: 'white' },
      { code: DP.COLOR_TEMP, value: 342 },
    ]);
  });

  it('setColor define modo colour + colour_data_v2 HSV', async () => {
    const m = makeClient();
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    await a.setColor('#FF0000');
    const cmds = lastCommands(m.calls);
    expect(cmds[0]).toEqual({ code: DP.WORK_MODE, value: 'colour' });
    expect(cmds[1].code).toBe(DP.COLOR);
    expect(cmds[1].value).toEqual({ h: 0, s: 1000, v: 1000 });
  });

  it('readState converte o status bruto em DeviceState', async () => {
    const m = makeClient([
      { code: DP.POWER, value: true },
      { code: DP.BRIGHTNESS, value: 505 },
      { code: DP.COLOR_TEMP, value: 342 },
      { code: DP.WORK_MODE, value: 'white' },
    ]);
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.on).toBe(true);
    expect(st.brightness).toBe(50);
    expect(st.colorTemp).toBe(4000);
    expect(st.color).toBeUndefined(); // modo branco não expõe cor
  });

  it('readState expõe cor quando work_mode=colour', async () => {
    const m = makeClient([
      { code: DP.POWER, value: true },
      { code: DP.WORK_MODE, value: 'colour' },
      { code: DP.COLOR, value: { h: 0, s: 1000, v: 1000 } },
    ]);
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.color).toBe('#ff0000');
  });

  it('readState parseia colour_data_v2 quando vem como string JSON', async () => {
    // A Tuya Cloud devolve colour_data_v2 stringificado em alguns devices (visto no spike real).
    const m = makeClient([
      { code: DP.POWER, value: true },
      { code: DP.WORK_MODE, value: 'colour' },
      { code: DP.COLOR, value: '{"h":0,"s":1000,"v":1000}' },
    ]);
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.color).toBe('#ff0000');
  });

  it('readState NÃO reporta colorTemp em modo colour (temp_value_v2 obsoleto)', async () => {
    const m = makeClient([
      { code: DP.POWER, value: true },
      { code: DP.WORK_MODE, value: 'colour' },
      { code: DP.COLOR_TEMP, value: 342 }, // valor antigo persiste mas não vale em colour
      { code: DP.COLOR, value: { h: 0, s: 1000, v: 1000 } },
    ]);
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.colorTemp).toBeUndefined();
    expect(st.color).toBe('#ff0000');
  });

  it('readState ignora colour_data_v2 com campos não-numéricos (sem hex-NaN)', async () => {
    const m = makeClient([
      { code: DP.POWER, value: true },
      { code: DP.WORK_MODE, value: 'colour' },
      { code: DP.COLOR, value: { h: 'x', s: 1000, v: 1000 } },
    ]);
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.color).toBeUndefined();
  });

  it('lança NotImplemented quando a capacidade não é suportada', async () => {
    const m = makeClient();
    const a = new TuyaCloudAdapter(
      ctx({ supportsColor: false, supportsColorTemp: false, supportsBrightness: false }),
      {
        client: m.client,
      },
    );
    await expect(a.setColor('#fff')).rejects.toBeInstanceOf(NotImplementedException);
    await expect(a.setColorTemp(4000)).rejects.toBeInstanceOf(NotImplementedException);
    await expect(a.setBrightness(50)).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('lança DeviceCommandError quando a API responde success=false (online, recusou)', async () => {
    // success=false = dispositivo respondeu e rejeitou — NÃO é offline.
    const m = makeClient([], { success: false });
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    await expect(a.turnOn()).rejects.toBeInstanceOf(DeviceCommandError);
  });

  it('lança DeviceOfflineError quando o conector rejeita (rede)', async () => {
    const client = {
      request: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    } as unknown as TuyaCloudClient;
    const a = new TuyaCloudAdapter(ctx(), { client });
    await expect(a.readState()).rejects.toBeInstanceOf(DeviceOfflineError);
  });

  it('tolera resposta crua (sem wrapper data) do conector', async () => {
    const m = makeClient([{ code: DP.POWER, value: false }], { wrapped: false });
    const a = new TuyaCloudAdapter(ctx(), { client: m.client });
    const st = await a.readState();
    expect(st.on).toBe(false);
  });

  it('readEnergy é null (lâmpada não mede energia)', async () => {
    const a = new TuyaCloudAdapter(ctx(), { client: makeClient().client });
    expect(await a.readEnergy()).toBeNull();
  });

  it('connect/disconnect são no-op (cloud é stateless)', async () => {
    const a = new TuyaCloudAdapter(ctx(), { client: makeClient().client });
    await expect(a.connect()).resolves.toBeUndefined();
    await expect(a.disconnect()).resolves.toBeUndefined();
  });
});

describe('conversão de cor HSV', () => {
  it('hexToHsv mapeia cores primárias', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1000, v: 1000 });
    expect(hexToHsv('#00FF00')).toEqual({ h: 120, s: 1000, v: 1000 });
    expect(hexToHsv('#0000FF')).toEqual({ h: 240, s: 1000, v: 1000 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
  });

  it('hsvToHex é o inverso aproximado', () => {
    expect(hsvToHex({ h: 0, s: 1000, v: 1000 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1000, v: 1000 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 1000, v: 1000 })).toBe('#0000ff');
  });
});
