// API verificada na web (jun/2026): Home Assistant REST API (developers.home-assistant.io/docs/api/rest).
//   Auth: header `Authorization: Bearer <long-lived token>` (porta padrão 8123).
//   - ler estado:  GET  /api/states/{entity_id}   -> { state: "on"|"off"|..., attributes: {...} }
//   - controlar:   POST /api/services/{domain}/{service}  body { entity_id, ...service_data } -> 200/201
// Mapeamento (DeviceAdapter -> serviços HA):
//   on/off/toggle -> homeassistant.turn_on / turn_off / toggle (universal p/ light e switch)
//   brilho -> light.turn_on { brightness_pct: 0..100 }   (attr lido `brightness` é 0..255)
//   cor    -> light.turn_on { rgb_color: [r,g,b] }        (attr lido `rgb_color`)
//   temp   -> light.turn_on { color_temp_kelvin }         (attr lido `color_temp_kelvin`)
// CASAI continua o NÚCLEO (ADR-001): o HA é apenas mais uma FONTE atrás do adapter pattern;
// controlamos uma entidade (ctx.externalId = entity_id, ex.: "light.sala") de uma instância
// HA existente. NÃO usamos o HA como orquestrador. Provisionamento Wi-Fi continua fora daqui.
import { Logger, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
import {
  DeviceCommandError,
  DeviceOfflineError,
  type AdapterContext,
  type DeviceAdapter,
  type DeviceState,
  type EnergyData,
} from '../device-adapter.interface';

const HA_TIMEOUT_MS = 5000;

export interface HomeAssistantConfig {
  baseUrl: string; // ex.: http://homeassistant.local:8123
  token: string; // long-lived access token
}

/** Resposta de GET /api/states/{entity_id}. */
interface HaState {
  entity_id?: string;
  state?: string;
  attributes?: {
    brightness?: number; // 0-255
    color_temp_kelvin?: number;
    rgb_color?: [number, number, number];
  };
}

/** Resultado cru de uma chamada HTTP ao HA — status + corpo já parseado. */
export interface HaResponse {
  status: number;
  body: unknown;
}

/** Subconjunto do cliente HTTP que usamos — injetável para teste (sem rede real). */
export interface HomeAssistantClient {
  request(method: string, path: string, body?: unknown): Promise<HaResponse>;
}

export interface HomeAssistantAdapterOptions {
  client?: HomeAssistantClient;
  config?: HomeAssistantConfig;
}

export class HomeAssistantAdapter implements DeviceAdapter {
  private readonly logger = new Logger(HomeAssistantAdapter.name);
  private readonly client: HomeAssistantClient;
  private readonly entityId: string; // entity_id no HA (ctx.externalId), ex.: "light.sala"

  constructor(
    private readonly ctx: AdapterContext,
    opts: HomeAssistantAdapterOptions = {},
  ) {
    if (!ctx.externalId) {
      throw new Error('HomeAssistantAdapter exige externalId (entity_id, ex.: "light.sala")');
    }
    this.entityId = ctx.externalId;
    this.client = opts.client ?? buildClient(opts.config ?? configFromEnv());
  }

  // HA REST é stateless (token no header) — sem conexão persistente.
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async turnOn(): Promise<void> {
    await this.callService('homeassistant', 'turn_on');
  }

  async turnOff(): Promise<void> {
    await this.callService('homeassistant', 'turn_off');
  }

  async toggle(): Promise<void> {
    await this.callService('homeassistant', 'toggle');
  }

  async setBrightness(value: number): Promise<void> {
    if (!this.ctx.supportsBrightness) {
      throw new NotImplementedException('Dispositivo não suporta brilho');
    }
    const pct = Math.round(Math.max(0, Math.min(100, value)));
    await this.callService('light', 'turn_on', { brightness_pct: pct });
  }

  async setColor(hex: string): Promise<void> {
    if (!this.ctx.supportsColor) {
      throw new NotImplementedException('Dispositivo não suporta cor');
    }
    await this.callService('light', 'turn_on', { rgb_color: hexToRgb(hex) });
  }

  async setColorTemp(kelvin: number): Promise<void> {
    if (!this.ctx.supportsColorTemp) {
      throw new NotImplementedException('Dispositivo não suporta temperatura de cor');
    }
    await this.callService('light', 'turn_on', { color_temp_kelvin: Math.round(kelvin) });
  }

  async readState(): Promise<DeviceState> {
    const resp = await this.call('GET', `/api/states/${encodeURIComponent(this.entityId)}`);
    const data = resp.body as HaState;
    const state: DeviceState = { on: data.state === 'on' };

    const attrs = data.attributes ?? {};
    if (typeof attrs.brightness === 'number') {
      // HA reporta brightness 0-255; CASAI usa 0-100.
      state.brightness = Math.round((attrs.brightness / 255) * 100);
    }
    if (typeof attrs.color_temp_kelvin === 'number') {
      state.colorTemp = attrs.color_temp_kelvin;
    }
    if (Array.isArray(attrs.rgb_color) && attrs.rgb_color.length === 3) {
      state.color = rgbToHex(attrs.rgb_color);
    }
    return state;
  }

  // Energia no HA é uma ENTIDADE de sensor separada (não atributo da luz/tomada).
  // Fora do escopo deste adapter — retorna null (o poller pula).
  async readEnergy(): Promise<EnergyData | null> {
    return null;
  }

  private callService(
    domain: string,
    service: string,
    data: Record<string, unknown> = {},
  ): Promise<HaResponse> {
    return this.call('POST', `/api/services/${domain}/${service}`, {
      entity_id: this.entityId,
      ...data,
    });
  }

  /** Faz a chamada e mapeia falhas: transporte/5xx -> offline; 4xx -> comando rejeitado. */
  private async call(method: string, path: string, body?: unknown): Promise<HaResponse> {
    let resp: HaResponse;
    try {
      resp = await this.client.request(method, path, body);
    } catch (err) {
      // Sem resposta (timeout/rede/HA fora do ar) = offline.
      throw new DeviceOfflineError(this.ctx.deviceId, err);
    }
    if (resp.status >= 200 && resp.status < 300) {
      return resp;
    }
    if (resp.status >= 500) {
      // HA respondeu erro de servidor — tratamos como indisponível.
      throw new DeviceOfflineError(this.ctx.deviceId, new Error(`HTTP ${resp.status}`));
    }
    // 4xx: o HA respondeu e RECUSOU (token inválido 401, entidade inexistente 404,
    // serviço/campo inválido 400). Não é offline.
    const detail = `HTTP ${resp.status}`;
    this.logger.warn(
      `Home Assistant ${this.ctx.name} (${this.entityId}): ${method} ${path} -> ${detail}`,
    );
    throw new DeviceCommandError(this.ctx.deviceId, detail);
  }
}

/** Cliente HTTP real (fetch nativo do Node 20) com timeout. Injetável -> testável. */
function buildClient(config: HomeAssistantConfig): HomeAssistantClient {
  const base = config.baseUrl.replace(/\/$/, '');
  return {
    async request(method, path, body) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(HA_TIMEOUT_MS),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      return { status: res.status, body: parsed };
    },
  };
}

function configFromEnv(): HomeAssistantConfig {
  const baseUrl = process.env.HOME_ASSISTANT_BASE_URL;
  const token = process.env.HOME_ASSISTANT_TOKEN;
  if (!baseUrl || !token) {
    // Exceção Nest (não Error cru) -> 503 localizado pelo filtro global.
    throw new ServiceUnavailableException(
      'Integração Home Assistant indisponível: configure HOME_ASSISTANT_BASE_URL e HOME_ASSISTANT_TOKEN no servidor.',
    );
  }
  return { baseUrl, token };
}

/** Converte hex (#RRGGBB) para [r,g,b] (0-255) que o serviço light.turn_on espera. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Converte [r,g,b] (0-255) do atributo rgb_color de volta para hex (#RRGGBB). */
export function rgbToHex(rgb: [number, number, number]): string {
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}
