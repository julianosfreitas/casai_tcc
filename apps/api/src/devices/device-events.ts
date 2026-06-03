import { Injectable } from '@nestjs/common';
import type { DeviceState } from './device-adapter.interface';
import type { DeviceStatus } from '@prisma/client';

/**
 * Porta de saída para eventos de tempo real. O DevicesService depende desta
 * abstração; quem entrega de fato é o gateway WebSocket (Passo 5). No Passo 4
 * usamos a implementação no-op para manter o módulo desacoplado e testável.
 */
@Injectable()
export abstract class DeviceEvents {
  abstract emitStatusChanged(
    userId: string,
    deviceId: string,
    state: DeviceState,
    status: DeviceStatus,
  ): void;
  abstract emitOffline(userId: string, deviceId: string): void;
  abstract emitEnergyReading(userId: string, deviceId: string, watts: number, readAt: Date): void;
  abstract emitAutomationTriggered(userId: string, automationId: string, name: string): void;
}

@Injectable()
export class NoopDeviceEvents extends DeviceEvents {
  emitStatusChanged(): void {}
  emitOffline(): void {}
  emitEnergyReading(): void {}
  emitAutomationTriggered(): void {}
}
