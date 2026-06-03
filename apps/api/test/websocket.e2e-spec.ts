import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { io, Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { CasaiGateway } from '../src/websocket/casai.gateway';

describe('WebSocket Gateway (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let gateway: CasaiGateway;
  let token: string;
  const userId = 'user-ws-1';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);

    const server = app.getHttpServer();
    const { port } = server.address() as AddressInfo;
    url = `http://localhost:${port}`;

    const jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    token = jwt.sign(
      { sub: userId, email: 'ws@casai.local' },
      { secret: config.get<string>('JWT_SECRET'), expiresIn: '15m' },
    );
    gateway = app.get(CasaiGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  function connect(authToken?: string): Socket {
    return io(url, {
      transports: ['websocket'],
      auth: authToken ? { token: authToken } : {},
      reconnection: false,
    });
  }

  it('entrega device:status_changed ao cliente autenticado', async () => {
    const client = connect(token);
    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', reject);
    });

    type StatusPayload = { deviceId: string; state: { on: boolean } };
    const received = new Promise<StatusPayload>((resolve) => {
      client.on('device:status_changed', (p: StatusPayload) => resolve(p));
    });

    // Pequena folga para garantir o join na sala antes do emit.
    await new Promise((r) => setTimeout(r, 50));
    gateway.emitStatusChanged(userId, 'dev-1', { on: true }, 'ONLINE');

    const payload = await received;
    expect(payload.deviceId).toBe('dev-1');
    expect(payload.state.on).toBe(true);
    client.disconnect();
  });

  it('desconecta cliente sem token válido', async () => {
    const client = connect('token-invalido');
    const outcome = await new Promise<'disconnected' | 'connected'>((resolve) => {
      client.on('disconnect', () => resolve('disconnected'));
      client.on('connect', () => setTimeout(() => resolve('connected'), 200));
    });
    expect(outcome).toBe('disconnected');
    client.disconnect();
  });
});
