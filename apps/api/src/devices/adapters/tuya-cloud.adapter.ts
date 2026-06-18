// API verificada na web (jun/2026): @tuya/tuya-connector-nodejs v2.1.2.
//   new TuyaContext({ baseUrl, accessKey, secretKey })  — cuida do token + assinatura HMAC-SHA256.
//   tuya.request<T>({ method, path, body }) -> AxiosResponse, ou seja { data: { success, result, msg, code } }.
// Caminho de NUVEM (aditivo ao TuyaAdapter local). NÃO reimplementa a assinatura — usa o conector.
//   - enviar comando: POST /v1.0/devices/{deviceId}/commands  body { commands: [{ code, value }] }
//   - ler estado:     GET  /v1.0/devices/{deviceId}/status    -> result: [{ code, value }]
// DP codes de lâmpada Tuya RGBCW (padrão; VARIAM por device — o spike imprime o status BRUTO
// primeiro para confirmar e, se preciso, ajustar estes nomes):
//   switch_led(bool) · bright_value_v2(10..1000) · temp_value_v2(0..1000) ·
//   colour_data_v2({h:0..360,s:0..1000,v:0..1000}) · work_mode("white"|"colour")
import { Logger, NotImplementedException } from '@nestjs/common';
import { TuyaContext } from '@tuya/tuya-connector-nodejs';
import {
  DeviceOfflineError,
  type AdapterContext,
  type DeviceAdapter,
  type DeviceState,
  type EnergyData,
} from '../device-adapter.interface';

/** Nomes dos DP codes da lâmpada RGBCW. Centralizados para ajuste rápido se o bulbo divergir. */
export const DP = {
  POWER: 'switch_led',
  BRIGHTNESS: 'bright_value_v2',
  COLOR_TEMP: 'temp_value_v2',
  COLOR: 'colour_data_v2',
  WORK_MODE: 'work_mode',
} as const;

const KELVIN_MIN = 2700;
const KELVIN_MAX = 6500;
const TUYA_SCALE_MAX = 1000;
const TUYA_BRIGHT_MIN = 10;

export interface TuyaCloudConfig {
  baseUrl: string;
  accessId: string;
  accessSecret: string;
}

interface TuyaApiBody<T> {
  success: boolean;
  result: T;
  msg?: string | null;
  code?: number;
}

interface TuyaCommand {
  code: string;
  value: unknown;
}

type StatusItem = { code: string; value: unknown };

/** Subconjunto do TuyaContext que usamos — injetável para teste (conector mockado). */
export interface TuyaCloudClient {
  request<T>(opts: {
    method: string;
    path: string;
    body?: unknown;
    query?: unknown;
  }): Promise<{ data: TuyaApiBody<T> } | TuyaApiBody<T>>;
}

export interface TuyaCloudAdapterOptions {
  client?: TuyaCloudClient;
  config?: TuyaCloudConfig;
}

export class TuyaCloudAdapter implements DeviceAdapter {
  private readonly logger = new Logger(TuyaCloudAdapter.name);
  private readonly client: TuyaCloudClient;
  private readonly deviceId: string; // device id na Tuya Cloud (ctx.externalId)

  constructor(
    private readonly ctx: AdapterContext,
    opts: TuyaCloudAdapterOptions = {},
  ) {
    if (!ctx.externalId) {
      throw new Error('TuyaCloudAdapter exige externalId (Tuya Cloud device id)');
    }
    this.deviceId = ctx.externalId;
    this.client = opts.client ?? buildTuyaContext(opts.config ?? configFromEnv());
  }

  // Tuya Cloud é HTTP stateless (o conector gerencia/renova o token) — sem conexão persistente.
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async turnOn(): Promise<void> {
    await this.sendCommands([{ code: DP.POWER, value: true }]);
  }

  async turnOff(): Promise<void> {
    await this.sendCommands([{ code: DP.POWER, value: false }]);
  }

  async toggle(): Promise<void> {
    const state = await this.readState();
    await this.sendCommands([{ code: DP.POWER, value: !state.on }]);
  }

  async setBrightness(value: number): Promise<void> {
    if (!this.ctx.supportsBrightness) {
      throw new NotImplementedException('Dispositivo não suporta brilho');
    }
    // 0-100 (CASAI) -> 10-1000 (Tuya).
    const pct = Math.max(0, Math.min(100, value));
    const scaled = Math.round(TUYA_BRIGHT_MIN + (pct / 100) * (TUYA_SCALE_MAX - TUYA_BRIGHT_MIN));
    await this.sendCommands([{ code: DP.BRIGHTNESS, value: scaled }]);
  }

  async setColorTemp(kelvin: number): Promise<void> {
    if (!this.ctx.supportsColorTemp) {
      throw new NotImplementedException('Dispositivo não suporta temperatura de cor');
    }
    // 2700-6500K -> 0-1000. Temperatura só vale no modo branco.
    const clamped = Math.max(KELVIN_MIN, Math.min(KELVIN_MAX, kelvin));
    const scaled = Math.round(
      ((clamped - KELVIN_MIN) / (KELVIN_MAX - KELVIN_MIN)) * TUYA_SCALE_MAX,
    );
    await this.sendCommands([
      { code: DP.WORK_MODE, value: 'white' },
      { code: DP.COLOR_TEMP, value: scaled },
    ]);
  }

  async setColor(hex: string): Promise<void> {
    if (!this.ctx.supportsColor) {
      throw new NotImplementedException('Dispositivo não suporta cor');
    }
    await this.sendCommands([
      { code: DP.WORK_MODE, value: 'colour' },
      { code: DP.COLOR, value: hexToHsv(hex) },
    ]);
  }

  async readState(): Promise<DeviceState> {
    const status = await this.getRawStatus();
    const by = new Map(status.map((s) => [s.code, s.value]));

    const on = Boolean(by.get(DP.POWER));
    const state: DeviceState = { on };

    const rawBright = Number(by.get(DP.BRIGHTNESS) ?? 0);
    if (rawBright) {
      state.brightness = Math.round(
        ((rawBright - TUYA_BRIGHT_MIN) / (TUYA_SCALE_MAX - TUYA_BRIGHT_MIN)) * 100,
      );
    }

    const rawTemp = by.get(DP.COLOR_TEMP);
    if (rawTemp != null) {
      state.colorTemp = Math.round(
        KELVIN_MIN + (Number(rawTemp) / TUYA_SCALE_MAX) * (KELVIN_MAX - KELVIN_MIN),
      );
    }

    // colour_data_v2 volta como objeto OU string JSON (varia por device/firmware).
    const rawColor = coerceHsv(by.get(DP.COLOR));
    if (by.get(DP.WORK_MODE) === 'colour' && rawColor) {
      state.color = hsvToHex(rawColor);
    }

    return state;
  }

  // Lâmpada RGBCW não mede energia.
  async readEnergy(): Promise<EnergyData | null> {
    return null;
  }

  /** Status BRUTO do dispositivo ([{code,value}]). O spike imprime isto para conferir os DP codes. */
  async getRawStatus(): Promise<StatusItem[]> {
    const body = await this.call<StatusItem[]>('GET', `/v1.0/devices/${this.deviceId}/status`);
    return Array.isArray(body.result) ? body.result : [];
  }

  private async sendCommands(commands: TuyaCommand[]): Promise<void> {
    await this.call<boolean>('POST', `/v1.0/devices/${this.deviceId}/commands`, { commands });
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<TuyaApiBody<T>> {
    let resp: { data: TuyaApiBody<T> } | TuyaApiBody<T>;
    try {
      resp = await this.client.request<T>({ method, path, body });
    } catch (err) {
      throw new DeviceOfflineError(this.ctx.deviceId, err);
    }
    // O conector devolve AxiosResponse ({ data: corpo }); toleramos também o corpo cru.
    const payload = (isWrapped<T>(resp) ? resp.data : resp) as TuyaApiBody<T>;
    if (!payload || payload.success !== true) {
      const msg = payload?.msg ?? `code ${payload?.code ?? '?'}`;
      this.logger.warn(`Tuya Cloud ${this.ctx.name}: ${method} ${path} falhou: ${msg}`);
      throw new DeviceOfflineError(this.ctx.deviceId, new Error(String(msg)));
    }
    return payload;
  }
}

function isWrapped<T>(
  resp: { data: TuyaApiBody<T> } | TuyaApiBody<T>,
): resp is { data: TuyaApiBody<T> } {
  return typeof resp === 'object' && resp !== null && 'data' in resp;
}

function buildTuyaContext(config: TuyaCloudConfig): TuyaCloudClient {
  return new TuyaContext({
    baseUrl: config.baseUrl,
    accessKey: config.accessId,
    secretKey: config.accessSecret,
  }) as unknown as TuyaCloudClient;
}

function configFromEnv(): TuyaCloudConfig {
  const baseUrl = process.env.TUYA_CLOUD_BASE_URL;
  const accessId = process.env.TUYA_CLOUD_ACCESS_ID;
  const accessSecret = process.env.TUYA_CLOUD_ACCESS_SECRET;
  if (!baseUrl || !accessId || !accessSecret) {
    throw new Error(
      'TuyaCloudAdapter exige TUYA_CLOUD_BASE_URL, TUYA_CLOUD_ACCESS_ID e TUYA_CLOUD_ACCESS_SECRET no ambiente',
    );
  }
  return { baseUrl, accessId, accessSecret };
}

interface Hsv {
  h: number; // 0-360
  s: number; // 0-1000
  v: number; // 0-1000
}

function isHsv(v: unknown): v is Hsv {
  return typeof v === 'object' && v !== null && 'h' in v && 's' in v && 'v' in v;
}

/** colour_data_v2 chega como objeto {h,s,v} ou como string JSON. Normaliza para Hsv|null. */
function coerceHsv(v: unknown): Hsv | null {
  if (isHsv(v)) return v;
  if (typeof v === 'string' && v) {
    try {
      const parsed: unknown = JSON.parse(v);
      if (isHsv(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

/** Converte hex (#RRGGBB) para o objeto HSV que o colour_data_v2 espera. */
export function hexToHsv(hex: string): Hsv {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : Math.round((delta / max) * TUYA_SCALE_MAX);
  const v = Math.round(max * TUYA_SCALE_MAX);
  return { h, s, v };
}

/** Converte o objeto HSV do Tuya de volta para hex (#RRGGBB). */
export function hsvToHex(hsv: Hsv): string {
  const h = hsv.h / 360;
  const s = hsv.s / TUYA_SCALE_MAX;
  const v = hsv.v / TUYA_SCALE_MAX;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  const toHex = (n: number): string =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
