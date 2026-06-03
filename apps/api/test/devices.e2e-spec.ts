import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './test-utils';

describe('Devices (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    http = request(app.getHttpServer() as Parameters<typeof request>[0]);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function signUp(email: string): Promise<string> {
    const res = await http
      .post('/api/auth/sign_up')
      .send({ email, name: 'Teste', password: 'Senha@123' });
    return res.body.accessToken as string;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('cria um dispositivo MOCK e o controla (turnOn → on:true)', async () => {
    const token = await signUp('a@casai.local');
    const created = await http
      .post('/api/devices')
      .set(auth(token))
      .send({ name: 'Luz', type: 'LIGHT', protocol: 'MOCK', supportsBrightness: true })
      .expect(201);

    const id = created.body.id as string;
    const res = await http
      .post(`/api/devices/${id}/command`)
      .set(auth(token))
      .send({ command: 'turnOn' })
      .expect(200);
    expect(res.body.on).toBe(true);
  });

  it('a listagem nunca expõe segredos cifrados', async () => {
    const token = await signUp('a@casai.local');
    await http
      .post('/api/devices')
      .set(auth(token))
      .send({
        name: 'Lâmpada Tuya',
        type: 'LIGHT',
        protocol: 'TUYA',
        localKey: 'segredo',
        ip: '192.168.0.9',
        externalId: 'abc',
      })
      .expect(201);

    const list = await http.get('/api/devices').set(auth(token)).expect(200);
    const json = JSON.stringify(list.body);
    expect(json).not.toContain('segredo');
    expect(json).not.toContain('localKeyEnc');
  });

  it('isolamento: usuário B não acessa nem comanda o dispositivo de A', async () => {
    const tokenA = await signUp('a@casai.local');
    const tokenB = await signUp('b@casai.local');
    const dev = await http
      .post('/api/devices')
      .set(auth(tokenA))
      .send({ name: 'Luz', type: 'LIGHT', protocol: 'MOCK' })
      .expect(201);
    const id = dev.body.id as string;

    await http.get(`/api/devices/${id}`).set(auth(tokenB)).expect(404);
    await http
      .post(`/api/devices/${id}/command`)
      .set(auth(tokenB))
      .send({ command: 'turnOn' })
      .expect(404);
  });

  it('capacidade não suportada retorna 501 (NotImplemented)', async () => {
    const token = await signUp('a@casai.local');
    const dev = await http
      .post('/api/devices')
      .set(auth(token))
      .send({ name: 'Luz simples', type: 'LIGHT', protocol: 'MOCK', supportsColor: false })
      .expect(201);
    const id = dev.body.id as string;

    await http
      .post(`/api/devices/${id}/command`)
      .set(auth(token))
      .send({ command: 'setColor', color: '#4F8EF7' })
      .expect(501);
  });

  it('valida o corpo: comando inválido retorna 400', async () => {
    const token = await signUp('a@casai.local');
    const dev = await http
      .post('/api/devices')
      .set(auth(token))
      .send({ name: 'Luz', type: 'LIGHT', protocol: 'MOCK' })
      .expect(201);
    await http
      .post(`/api/devices/${dev.body.id}/command`)
      .set(auth(token))
      .send({ command: 'explode' })
      .expect(400);
  });
});
