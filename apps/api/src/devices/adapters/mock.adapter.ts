import { Logger, NotImplementedException } from '@nestjs/common';
import type {
  AdapterContext,
  DeviceAdapter,
  DeviceState,
  EnergyData,
} from '../device-adapter.interface';

/**
 * Adapter MOCK — simula um dispositivo em memória. Permite rodar e testar o
 * sistema inteiro sem hardware (CLAUDE.md §4.3). Modela luz e tomada.
 */
export class MockAdapter implements DeviceAdapter {
  private readonly logger = new Logger(MockAdapter.name);
  private state: DeviceState = { on: false, brightness: 80 };
  private connected = false;

  constructor(private readonly ctx: AdapterContext) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async turnOn(): Promise<void> {
    this.ensureConnected();
    this.state.on = true;
  }

  async turnOff(): Promise<void> {
    this.ensureConnected();
    this.state.on = false;
  }

  async toggle(): Promise<void> {
    this.ensureConnected();
    this.state.on = !this.state.on;
  }

  async setBrightness(value: number): Promise<void> {
    if (!this.ctx.supportsBrightness) {
      throw new NotImplementedException('Este dispositivo não suporta brilho');
    }
    this.state.brightness = Math.max(0, Math.min(100, value));
  }

  async setColor(hex: string): Promise<void> {
    if (!this.ctx.supportsColor) {
      throw new NotImplementedException('Este dispositivo não suporta cor');
    }
    this.state.color = hex;
  }

  async setColorTemp(kelvin: number): Promise<void> {
    if (!this.ctx.supportsColorTemp) {
      throw new NotImplementedException('Este dispositivo não suporta temperatura de cor');
    }
    this.state.colorTemp = kelvin;
  }

  async readState(): Promise<DeviceState> {
    return { ...this.state };
  }

  async readEnergy(): Promise<EnergyData | null> {
    if (!this.ctx.supportsEnergy) {
      return null;
    }
    // Simula consumo plausível: ~0W desligado, ~120W ligado (ex.: uma TV).
    const watts = this.state.on ? 110 + Math.round((this.state.brightness ?? 0) / 5) : 0.5;
    return { watts, kwhToday: 0.42, kwhMonth: 12.8 };
  }

  private ensureConnected(): void {
    if (!this.connected) {
      // No mock não falhamos de fato; apenas registramos para paridade de comportamento.
      this.logger.debug(`MockAdapter de ${this.ctx.name} operando sem connect() prévio`);
    }
  }
}
