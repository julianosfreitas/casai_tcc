import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { DeviceEvents } from '../devices/device-events';
import type { DeviceState } from '../devices/device-adapter.interface';
import type { DeviceStatus } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.types';

/** Sala por usuário — garante que cada cliente só receba eventos dos próprios dados. */
const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Gateway Socket.IO. Autentica a conexão com o MESMO JWT da API e entrega os
 * eventos de tempo real apenas para os sockets do usuário dono dos dados.
 * Implementa DeviceEvents — é a saída real usada por DevicesService/Energy/Automations.
 */
@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class CasaiGateway extends DeviceEvents implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CasaiGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      // Anexa o userId ao socket e o coloca na sala do usuário.
      client.data.userId = payload.sub;
      void client.join(userRoom(payload.sub));
      this.logger.debug(`Cliente conectado (user ${payload.sub})`);
    } catch {
      // Conexão sem token válido é encerrada — nunca recebe eventos.
      client.emit('error', 'Não autenticado');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      this.logger.debug(`Cliente desconectado (user ${userId})`);
    }
  }

  // ───────────── DeviceEvents (servidor → cliente, por usuário) ─────────────

  emitStatusChanged(
    userId: string,
    deviceId: string,
    state: DeviceState,
    status: DeviceStatus,
  ): void {
    this.server.to(userRoom(userId)).emit('device:status_changed', { deviceId, state, status });
  }

  emitOffline(userId: string, deviceId: string): void {
    this.server.to(userRoom(userId)).emit('device:offline', { deviceId });
  }

  emitEnergyReading(userId: string, deviceId: string, watts: number, readAt: Date): void {
    this.server
      .to(userRoom(userId))
      .emit('energy:reading', { deviceId, watts, readAt: readAt.toISOString() });
  }

  emitAutomationTriggered(userId: string, automationId: string, name: string): void {
    this.server.to(userRoom(userId)).emit('automation:triggered', { automationId, name });
  }

  emitDeviceCreated(userId: string, deviceId: string): void {
    this.server.to(userRoom(userId)).emit('device:created', { deviceId });
  }

  emitDeviceRemoved(userId: string, deviceId: string): void {
    this.server.to(userRoom(userId)).emit('device:removed', { deviceId });
  }

  private extractToken(client: Socket): string {
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token;
    const fromQuery = client.handshake.query?.token;
    const token = fromAuth ?? (typeof fromQuery === 'string' ? fromQuery : undefined);
    if (!token) {
      throw new Error('token ausente');
    }
    return token;
  }
}
