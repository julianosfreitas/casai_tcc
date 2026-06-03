// API verificada na web em jun/2026: tuyapi v7.7.x (classe default TuyaDevice).
//   connect()/disconnect(), get({schema:true}), set({dps,set}), eventos 'data'/'error'.
// Os números de DPS de lâmpadas Tuya "tipo B" (Intelbras EWS 410) seguem o padrão
// 20=power, 22=brilho(10..1000), 23=temperatura, 24=cor(HSV hex). CONFIRME com o
// dump de get({schema:true}) do spike — firmwares variam (ver docs/HARDWARE_SETUP.md).
import { Logger, NotImplementedException } from '@nestjs/common';
import TuyaDevice from 'tuyapi';
import {
  DeviceOfflineError,
  type AdapterContext,
  type DeviceAdapter,
  type DeviceState,
  type EnergyData,
} from '../device-adapter.interface';

const DPS = { POWER: 20, BRIGHTNESS: 22, COLOR_TEMP: 23, COLOR: 24 } as const;
const CONNECT_TIMEOUT_MS = 5000;

export class TuyaAdapter implements DeviceAdapter {
  private readonly logger = new Logger(TuyaAdapter.name);
  private device: TuyaDevice | null = null;

  constructor(private readonly ctx: AdapterContext) {
    if (!ctx.externalId || !ctx.localKey || !ctx.ip) {
      throw new Error('TuyaAdapter exige externalId, localKey e ip');
    }
  }

  // Conexão TCP persistente reaproveitada entre comandos (a lâmpada aceita 1 por vez).
  async connect(): Promise<void> {
    if (this.device?.isConnected()) {
      return;
    }
    const device = new TuyaDevice({
      id: this.ctx.externalId!,
      key: this.ctx.localKey!,
      ip: this.ctx.ip!,
      version: this.ctx.protocolVersion ?? '3.3',
      issueGetOnConnect: false,
    });
    // Erros do EventEmitter encapsulados aqui (CLAUDE.md §6: nunca callbacks crus fora do adapter).
    device.on('error', (err) => this.logger.warn(`Tuya ${this.ctx.name}: ${err.message}`));

    try {
      await this.withTimeout(device.connect(), 'connect');
      this.device = device;
    } catch (err) {
      throw new DeviceOfflineError(this.ctx.deviceId, err);
    }
  }

  async disconnect(): Promise<void> {
    this.device?.disconnect();
    this.device = null;
  }

  async turnOn(): Promise<void> {
    await this.setDps(DPS.POWER, true);
  }

  async turnOff(): Promise<void> {
    await this.setDps(DPS.POWER, false);
  }

  async toggle(): Promise<void> {
    const state = await this.readState();
    await this.setDps(DPS.POWER, !state.on);
  }

  async setBrightness(value: number): Promise<void> {
    if (!this.ctx.supportsBrightness) {
      throw new NotImplementedException('Dispositivo não suporta brilho');
    }
    // 0-100 (CASAI) → 10-1000 (Tuya).
    const scaled = Math.round(10 + (Math.max(0, Math.min(100, value)) / 100) * 990);
    await this.setDps(DPS.BRIGHTNESS, scaled);
  }

  async setColor(hex: string): Promise<void> {
    if (!this.ctx.supportsColor) {
      throw new NotImplementedException('Dispositivo não suporta cor');
    }
    await this.setDps(DPS.COLOR, hexToTuyaHsv(hex));
  }

  async setColorTemp(kelvin: number): Promise<void> {
    if (!this.ctx.supportsColorTemp) {
      throw new NotImplementedException('Dispositivo não suporta temperatura de cor');
    }
    // 2700-6500K → 0-1000 (aprox.).
    const clamped = Math.max(2700, Math.min(6500, kelvin));
    const scaled = Math.round(((clamped - 2700) / (6500 - 2700)) * 1000);
    await this.setDps(DPS.COLOR_TEMP, scaled);
  }

  async readState(): Promise<DeviceState> {
    const device = await this.ensureConnected();
    try {
      const res = await this.withTimeout(device.get({ schema: true }), 'get');
      const dps = (
        typeof res === 'object' && res !== null && 'dps' in res ? res.dps : {}
      ) as Record<string, unknown>;
      const on = Boolean(dps[DPS.POWER]);
      const rawBright = Number(dps[DPS.BRIGHTNESS] ?? 0);
      const brightness = rawBright ? Math.round(((rawBright - 10) / 990) * 100) : undefined;
      return { on, brightness };
    } catch (err) {
      throw new DeviceOfflineError(this.ctx.deviceId, err);
    }
  }

  // Lâmpada não mede energia.
  async readEnergy(): Promise<EnergyData | null> {
    return null;
  }

  private async setDps(dps: number, set: string | number | boolean): Promise<void> {
    const device = await this.ensureConnected();
    try {
      await this.withTimeout(device.set({ dps, set }), 'set');
    } catch (err) {
      throw new DeviceOfflineError(this.ctx.deviceId, err);
    }
  }

  private async ensureConnected(): Promise<TuyaDevice> {
    if (!this.device?.isConnected()) {
      await this.connect();
    }
    if (!this.device) {
      throw new DeviceOfflineError(this.ctx.deviceId);
    }
    return this.device;
  }

  private withTimeout<T>(promise: Promise<T>, op: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout em ${op}`)), CONNECT_TIMEOUT_MS),
      ),
    ]);
  }
}

/** Converte hex (#RRGGBB) no formato HSV-hex de 12 chars que o Tuya espera. */
export function hexToTuyaHsv(hex: string): string {
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
  const s = max === 0 ? 0 : Math.round((delta / max) * 1000);
  const v = Math.round(max * 1000);

  const toHex = (n: number, len: number): string => n.toString(16).padStart(len, '0');
  return `${toHex(h, 4)}${toHex(s, 4)}${toHex(v, 4)}`;
}
