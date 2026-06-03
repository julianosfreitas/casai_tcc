import { DeviceCommandQueue } from './device-command.queue';

describe('DeviceCommandQueue', () => {
  it('serializa comandos do MESMO dispositivo (nunca em paralelo)', async () => {
    const queue = new DeviceCommandQueue();
    const order: string[] = [];
    const task = (label: string, delay: number) => async () => {
      order.push(`start:${label}`);
      await new Promise((r) => setTimeout(r, delay));
      order.push(`end:${label}`);
      return label;
    };

    // A é mais lento que B; mesmo assim B só começa depois de A terminar.
    const pA = queue.enqueue('dev', task('A', 30));
    const pB = queue.enqueue('dev', task('B', 1));
    await Promise.all([pA, pB]);

    expect(order).toEqual(['start:A', 'end:A', 'start:B', 'end:B']);
  });

  it('um comando que falha não trava a fila do dispositivo', async () => {
    const queue = new DeviceCommandQueue();
    const failing = queue.enqueue('dev', async () => {
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');

    const ok = await queue.enqueue('dev', async () => 'ok');
    expect(ok).toBe('ok');
  });

  it('dispositivos diferentes correm em paralelo', async () => {
    const queue = new DeviceCommandQueue();
    const order: string[] = [];
    const slow = queue.enqueue('a', async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('a');
    });
    const fast = queue.enqueue('b', async () => {
      order.push('b');
    });
    await Promise.all([slow, fast]);
    // b (outro dispositivo) termina antes de a, provando paralelismo entre devices.
    expect(order[0]).toBe('b');
  });
});
