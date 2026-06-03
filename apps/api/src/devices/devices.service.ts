import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Prisma, type Device } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { DeviceAdapterFactory } from './device-adapter.factory';
import { DeviceCommandQueue } from './device-command.queue';
import { DeviceEvents } from './device-events';
import {
  DeviceOfflineError,
  type DeviceAdapter,
  type DeviceState,
} from './device-adapter.interface';
import type { CreateDeviceDto } from './dto/create-device.dto';
import type { UpdateDeviceDto } from './dto/update-device.dto';
import type { DeviceCommandDto } from './dto/device-command.dto';

// Campos seguros para devolver à API — NUNCA expõe segredos cifrados.
const PUBLIC_SELECT = {
  id: true,
  name: true,
  type: true,
  protocol: true,
  status: true,
  ip: true,
  roomId: true,
  protocolVersion: true,
  supportsBrightness: true,
  supportsColor: true,
  supportsColorTemp: true,
  supportsEnergy: true,
  lastSeen: true,
  lastState: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeviceSelect;

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  // Cache de adapters por dispositivo (conexões persistentes reaproveitadas).
  private readonly adapters = new Map<string, DeviceAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly factory: DeviceAdapterFactory,
    private readonly queue: DeviceCommandQueue,
    private readonly events: DeviceEvents,
  ) {}

  list(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(userId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, userId },
      select: PUBLIC_SELECT,
    });
    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado');
    }
    return device;
  }

  async create(userId: string, dto: CreateDeviceDto) {
    const device = await this.prisma.device.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        protocol: dto.protocol,
        roomId: dto.roomId ?? null,
        ip: dto.ip ?? null,
        externalId: dto.externalId ?? null,
        protocolVersion: dto.protocolVersion ?? null,
        // Segredos cifrados antes de persistir (AES-256-GCM). Nunca em texto puro.
        localKeyEnc: dto.localKey ? this.crypto.encrypt(dto.localKey) : null,
        tapoEmail: dto.tapoEmail ?? null,
        tapoPassEnc: dto.tapoPass ? this.crypto.encrypt(dto.tapoPass) : null,
        supportsBrightness: dto.supportsBrightness ?? false,
        supportsColor: dto.supportsColor ?? false,
        supportsColorTemp: dto.supportsColorTemp ?? false,
        supportsEnergy: dto.supportsEnergy ?? false,
      },
      select: PUBLIC_SELECT,
    });
    return device;
  }

  async update(userId: string, id: string, dto: UpdateDeviceDto) {
    await this.assertOwnership(userId, id);
    const data: Prisma.DeviceUpdateInput = {
      name: dto.name,
      type: dto.type,
      protocol: dto.protocol,
      ip: dto.ip,
      externalId: dto.externalId,
      protocolVersion: dto.protocolVersion,
      tapoEmail: dto.tapoEmail,
      supportsBrightness: dto.supportsBrightness,
      supportsColor: dto.supportsColor,
      supportsColorTemp: dto.supportsColorTemp,
      supportsEnergy: dto.supportsEnergy,
      ...(dto.roomId !== undefined ? { room: { connect: { id: dto.roomId } } } : {}),
      ...(dto.localKey ? { localKeyEnc: this.crypto.encrypt(dto.localKey) } : {}),
      ...(dto.tapoPass ? { tapoPassEnc: this.crypto.encrypt(dto.tapoPass) } : {}),
    };
    this.invalidateAdapter(id);
    return this.prisma.device.update({ where: { id }, data, select: PUBLIC_SELECT });
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    await this.assertOwnership(userId, id);
    this.invalidateAdapter(id);
    await this.prisma.device.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Executa um comando passando pela FILA serializada do dispositivo.
   * Em sucesso: atualiza estado/última-vez-visto e faz broadcast.
   * Em offline: marca OFFLINE, avisa via WebSocket e responde 503.
   */
  async executeCommand(userId: string, id: string, dto: DeviceCommandDto): Promise<DeviceState> {
    const device = await this.findEntity(userId, id);
    const adapter = this.getAdapter(device);

    return this.queue.enqueue(device.id, async () => {
      try {
        await adapter.connect();
        await this.applyCommand(adapter, dto);
        const state = await adapter.readState();
        await this.prisma.device.update({
          where: { id: device.id },
          data: {
            lastState: state as unknown as Prisma.InputJsonValue,
            lastSeen: new Date(),
            status: 'ONLINE',
          },
        });
        this.events.emitStatusChanged(userId, device.id, state, 'ONLINE');
        return state;
      } catch (err) {
        if (err instanceof DeviceOfflineError) {
          this.invalidateAdapter(device.id);
          await this.prisma.device.update({
            where: { id: device.id },
            data: { status: 'OFFLINE' },
          });
          this.events.emitOffline(userId, device.id);
          throw new ServiceUnavailableException('Dispositivo offline ou inacessível');
        }
        throw err;
      }
    });
  }

  /**
   * Descoberta de dispositivos na LAN. No MVP o pareamento é manual (a obtenção da
   * local_key exige o fluxo do Tuya IoT — ver HARDWARE_SETUP.md), então retornamos
   * vazio com orientação. Hook para descoberta automática em versão futura.
   */
  async discover(_userId: string): Promise<{ found: unknown[]; hint: string }> {
    return {
      found: [],
      hint: 'Cadastre o dispositivo manualmente com id/local_key/ip (ver docs/HARDWARE_SETUP.md).',
    };
  }

  // ───────────────────────── internos ─────────────────────────

  /** Carrega a entidade completa (com segredos) — uso interno; nunca retornado à API. */
  private async findEntity(userId: string, id: string): Promise<Device> {
    const device = await this.prisma.device.findFirst({ where: { id, userId } });
    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado');
    }
    return device;
  }

  private async assertOwnership(userId: string, id: string): Promise<void> {
    const count = await this.prisma.device.count({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Dispositivo não encontrado');
    }
  }

  private getAdapter(device: Device): DeviceAdapter {
    let adapter = this.adapters.get(device.id);
    if (!adapter) {
      adapter = this.factory.create(device);
      this.adapters.set(device.id, adapter);
    }
    return adapter;
  }

  private invalidateAdapter(id: string): void {
    const adapter = this.adapters.get(id);
    if (adapter) {
      void adapter
        .disconnect()
        .catch((e: unknown) => this.logger.debug(`disconnect: ${String(e)}`));
      this.adapters.delete(id);
    }
  }

  private async applyCommand(adapter: DeviceAdapter, dto: DeviceCommandDto): Promise<void> {
    switch (dto.command) {
      case 'turnOn':
        return adapter.turnOn();
      case 'turnOff':
        return adapter.turnOff();
      case 'toggle':
        return adapter.toggle();
      case 'setBrightness':
        if (dto.brightness === undefined) {
          throw new UnprocessableEntityException('Informe "brightness" (0-100)');
        }
        return adapter.setBrightness(dto.brightness);
      case 'setColor':
        if (!dto.color) {
          throw new UnprocessableEntityException('Informe "color" (hex)');
        }
        return adapter.setColor(dto.color);
      case 'setColorTemp':
        if (dto.colorTemp === undefined) {
          throw new UnprocessableEntityException('Informe "colorTemp" (kelvin)');
        }
        return adapter.setColorTemp(dto.colorTemp);
    }
  }
}
