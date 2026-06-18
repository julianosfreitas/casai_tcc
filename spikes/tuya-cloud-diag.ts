/** Diagnóstico Tuya Cloud: sonda vários endpoints e imprime code+msg exatos. Descartável. */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TuyaContext } from '@tuya/tuya-connector-nodejs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const baseUrl = process.env.TUYA_CLOUD_BASE_URL!;
const id = process.env.TUYA_CLOUD_DEVICE_ID!;
const tuya = new TuyaContext({
  baseUrl,
  accessKey: process.env.TUYA_CLOUD_ACCESS_ID!,
  secretKey: process.env.TUYA_CLOUD_ACCESS_SECRET!,
});

async function probe(label: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<void> {
  try {
    const r: any = await tuya.request({ method, path, body });
    const d = r?.data ?? r;
    console.log(`\n[${label}] ${method} ${path}`);
    console.log(`  success=${d?.success} code=${d?.code ?? '-'} msg=${d?.msg ?? '-'}`);
    if (d?.success) console.log(`  result=${JSON.stringify(d.result).slice(0, 600)}`);
  } catch (e: any) {
    console.log(`\n[${label}] ${method} ${path}  -> THREW: ${e?.message}`);
  }
}

async function main(): Promise<void> {
  console.log(`baseUrl=${baseUrl}\ndevice=${id}`);
  await probe('token', 'GET', '/v1.0/token?grant_type=1');
  await probe('device-detail-v1', 'GET', `/v1.0/devices/${id}`);
  await probe('device-status-v1', 'GET', `/v1.0/devices/${id}/status`);
  await probe('device-functions', 'GET', `/v1.0/devices/${id}/functions`);
  await probe('iot-03-status', 'GET', `/v1.0/iot-03/devices/${id}/status`);
  await probe('thing-shadow-v2', 'GET', `/v2.0/cloud/thing/${id}/shadow/properties`);
  await probe('associated-users-devices', 'GET', '/v1.0/iot-01/associated-users/devices?size=20');
}

main().catch((e) => console.error('FATAL', e));
