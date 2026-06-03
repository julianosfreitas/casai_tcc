// API verificada na web em jun/2026: tp-link-tapo-connect v2.0.15.
//   loginDeviceByIp(email, pass, ip) -> objeto com turnOn/turnOff/setBrightness/
//   getDeviceInfo/getEnergyUsage. Suporta KLAP + legado (fallback automático).
// UNIDADES de energia (confirmadas no spike): current_power vem em mW; today/
// month_energy em Wh. Convertendo: W = current_power/1000; kWh = energy/1000.
import { Logger, NotImplementedException } from '@nestjs/common';
import { loginDeviceByIp } from 'tp-link-tapo-connect';
import {
  DeviceOfflineError,
  type AdapterContext,
  type DeviceAdapter,
  type DeviceState,
  type EnergyData,
} from '../device-adapter.interface';

type TapoSession = Awaited<ReturnType<typeof loginDeviceByIp>>;

// Resposta crua de getEnergyUsage (não tipada na lib). Narrowing manual.
interface TapoEnergyRaw {
  current_power?: number;
  today_energy?: number;
  month_energy?: number;
}

export class TapoAdapter implements DeviceAdapter {
  private readonly logger = new Logger(TapoAdapter.name);
  private session: TapoSession | null = null;

  constructor(private readonly ctx: AdapterContext) {
    if (!ctx.ip || !ctx.tapoEmail || !ctx.tapoPass) {
      throw new Error('TapoAdapter exige ip, tapoEmail e tapoPass');
    }
  }

  async connect(): Promise<void> {
    if (this.session) {
      return;
    }
    await this.login();
  }

  async disconnect(): Promise<void> {
    // A lib não mantém socket persistente; basta descartar a sessão cacheada.
    this.session = null;
  }

  async turnOn(): Promise<void> {
    await this.run((s) => s.turnOn());
  }

  async turnOff(): Promise<void> {
    await this.run((s) => s.turnOff());
  }

  async toggle(): Promise<void> {
    const state = await this.readState();
    await this.run((s) => (state.on ? s.turnOff() : s.turnOn()));
  }

  async setBrightness(value: number): Promise<void> {
    if (!this.ctx.supportsBrightness) {
      throw new NotImplementedException('Tomada/dispositivo não suporta brilho');
    }
    await this.run((s) => s.setBrightness(Math.max(0, Math.min(100, value))));
  }

  async setColor(hex: string): Promise<void> {
    if (!this.ctx.supportsColor) {
      throw new NotImplementedException('Dispositivo não suporta cor');
    }
    await this.run((s) => s.setColour(hex));
  }

  async setColorTemp(_kelvin: number): Promise<void> {
    // P110 é tomada; mesmo lâmpadas Tapo usam setColour. Não exposto aqui.
    throw new NotImplementedException('Dispositivo não suporta temperatura de cor');
  }

  async readState(): Promise<DeviceState> {
    const info = await this.run((s) => s.getDeviceInfo());
    const extra = info as unknown as { brightness?: number };
    return { on: info.device_on, brightness: extra.brightness };
  }

  async readEnergy(): Promise<EnergyData | null> {
    if (!this.ctx.supportsEnergy) {
      return null;
    }
    const raw = (await this.run((s) => s.getEnergyUsage())) as unknown as TapoEnergyRaw;
    return {
      watts: (raw.current_power ?? 0) / 1000, // mW → W
      kwhToday: raw.today_energy !== undefined ? raw.today_energy / 1000 : undefined, // Wh → kWh
      kwhMonth: raw.month_energy !== undefined ? raw.month_energy / 1000 : undefined,
    };
  }

  // Executa uma operação com re-login automático em caso de sessão expirada.
  private async run<T>(op: (s: TapoSession) => Promise<T>): Promise<T> {
    const session = this.session ?? (await this.login());
    try {
      return await op(session);
    } catch (err) {
      this.logger.debug(`Tapo ${this.ctx.name}: re-login após erro (${(err as Error).message})`);
      const fresh = await this.login();
      try {
        return await op(fresh);
      } catch (retryErr) {
        throw new DeviceOfflineError(this.ctx.deviceId, retryErr);
      }
    }
  }

  private async login(): Promise<TapoSession> {
    try {
      this.session = await loginDeviceByIp(this.ctx.tapoEmail!, this.ctx.tapoPass!, this.ctx.ip!);
      return this.session;
    } catch (err) {
      throw new DeviceOfflineError(this.ctx.deviceId, err);
    }
  }
}
