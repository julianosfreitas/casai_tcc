import {
  PrismaClient,
  Prisma,
  DeviceType,
  Protocol,
  DeviceStatus,
  TriggerType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  DEMO_AUTOMATIONS,
  DEMO_DEVICES,
  DEMO_ROOMS,
  DEMO_SCENES,
  DEMO_USER,
  resolveActions,
} from '../src/demo/demo-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: {},
    create: { email: DEMO_USER.email, name: DEMO_USER.name, passwordHash },
  });
  console.log(`✓ Usuário de teste: ${DEMO_USER.email} / ${DEMO_USER.password}`);

  const roomIdByName: Record<string, string> = {};
  for (const r of DEMO_ROOMS) {
    const room = await prisma.room.upsert({
      where: { userId_name: { userId: user.id, name: r.name } },
      update: { order: r.order },
      create: { name: r.name, order: r.order, userId: user.id },
    });
    roomIdByName[r.name] = room.id;
  }
  console.log(`✓ Cômodos: ${DEMO_ROOMS.map((r) => r.name).join(', ')}`);

  const deviceIdByName: Record<string, string> = {};
  for (const d of DEMO_DEVICES) {
    const existing = await prisma.device.findFirst({
      where: { userId: user.id, name: d.name },
    });
    const device =
      existing ??
      (await prisma.device.create({
        data: {
          name: d.name,
          type: DeviceType[d.type],
          protocol: Protocol.MOCK,
          status: DeviceStatus.ONLINE,
          supportsBrightness: d.supportsBrightness ?? false,
          supportsColor: d.supportsColor ?? false,
          supportsColorTemp: d.supportsColorTemp ?? false,
          supportsEnergy: d.supportsEnergy ?? false,
          roomId: roomIdByName[d.room],
          userId: user.id,
          lastState: d.lastState,
        },
      }));
    deviceIdByName[d.name] = device.id;
  }
  console.log(`✓ Dispositivos MOCK: ${DEMO_DEVICES.map((d) => d.name).join(', ')}`);

  for (const a of DEMO_AUTOMATIONS) {
    const exists = await prisma.automation.findFirst({
      where: { userId: user.id, name: a.name },
    });
    if (exists) continue;
    await prisma.automation.create({
      data: {
        name: a.name,
        userId: user.id,
        enabled: true,
        triggerType: TriggerType.SCHEDULE,
        triggerConfig: a.triggerConfig as unknown as Prisma.InputJsonValue,
        actions: resolveActions(a.actions, deviceIdByName) as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`✓ Rotinas: ${DEMO_AUTOMATIONS.map((a) => a.name).join(' · ')}`);

  for (const s of DEMO_SCENES) {
    const exists = await prisma.scene.findFirst({
      where: { userId: user.id, name: s.name },
    });
    if (exists) continue;
    await prisma.scene.create({
      data: {
        name: s.name,
        icon: s.icon,
        userId: user.id,
        actions: resolveActions(s.actions, deviceIdByName) as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`✓ Cenas: ${DEMO_SCENES.map((s) => s.name).join(' · ')}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('✓ Seed concluído.');
  })
  .catch(async (e) => {
    console.error('✗ Seed falhou:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
