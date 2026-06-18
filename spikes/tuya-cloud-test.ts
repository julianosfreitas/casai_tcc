/**
 * spike: controle da lâmpada via TUYA CLOUD Open API (caminho de NUVEM, aditivo ao local).
 *
 * Valida controle REAL sem hardware físico, usando um dispositivo virtual criado na
 * plataforma Tuya. Reusa o TuyaCloudAdapter da API (mesma interface DeviceAdapter).
 *
 * Conector: @tuya/tuya-connector-nodejs v2.1.2 — cuida do token + assinatura HMAC.
 *
 * Credenciais no .env da RAIZ do projeto (este spike carrega ../.env explicitamente):
 *   TUYA_CLOUD_BASE_URL    (ex: https://openapi.tuyaus.com — data center Western America)
 *   TUYA_CLOUD_ACCESS_ID   (Access ID do Cloud Project em iot.tuya.com)
 *   TUYA_CLOUD_ACCESS_SECRET
 *   TUYA_CLOUD_DEVICE_ID   (id do dispositivo virtual/real)
 *
 * IMPORTANTE: imprime o STATUS BRUTO primeiro — os DP codes variam por device. Se o
 * mapeamento não bater (ex: bright_value em vez de bright_value_v2), ajuste os nomes
 * em apps/api/src/devices/adapters/tuya-cloud.adapter.ts (const DP).
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TuyaCloudAdapter,
  type TuyaCloudConfig,
} from '../apps/api/src/devices/adapters/tuya-cloud.adapter';
import type { AdapterContext } from '../apps/api/src/devices/device-adapter.interface';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` -> ${detail}` : ''}`);
  cond ? pass++ : fail++;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Falta a variável de ambiente ${name}. Preencha o .env da raiz.`);
    process.exit(1);
  }
  return v;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const cfg: TuyaCloudConfig = {
    baseUrl: requireEnv('TUYA_CLOUD_BASE_URL'),
    accessId: requireEnv('TUYA_CLOUD_ACCESS_ID'),
    accessSecret: requireEnv('TUYA_CLOUD_ACCESS_SECRET'),
  };
  const deviceId = requireEnv('TUYA_CLOUD_DEVICE_ID');

  const ctx: AdapterContext = {
    deviceId: 'spike-cloud',
    name: 'Lâmpada Tuya Cloud (spike)',
    externalId: deviceId,
    supportsBrightness: true,
    supportsColor: true,
    supportsColorTemp: true,
    supportsEnergy: false,
  };

  const adapter = new TuyaCloudAdapter(ctx, { config: cfg });
  console.log(`→ Tuya Cloud: ${cfg.baseUrl}  device=${deviceId}\n`);

  // 1) STATUS BRUTO — cole esta saída para conferirmos os DP codes reais do bulbo.
  console.log('=== STATUS BRUTO (DP codes reais do dispositivo) ===');
  const raw = await adapter.getRawStatus();
  console.log(JSON.stringify(raw, null, 2));
  check('GET /status retornou DP codes', raw.length > 0, `${raw.length} codes`);

  console.log('\n=== COMANDOS ===');
  // A Tuya Cloud é eventualmente consistente: o status reflete o comando com atraso.
  // Por isso fazemos polling do readState (várias leituras) antes de avaliar — não é
  // defeito do adapter (o comando chega; a nuvem só demora a propagar o shadow).
  const POLL_TRIES = 8;
  const POLL_DELAY = 700;
  async function waitFor(
    pred: (s: DeviceState) => boolean,
  ): Promise<DeviceState> {
    let last = await adapter.readState();
    for (let i = 0; i < POLL_TRIES && !pred(last); i++) {
      await sleep(POLL_DELAY);
      last = await adapter.readState();
    }
    return last;
  }

  // 2) Ligar
  await adapter.turnOn();
  let st = await waitFor((s) => s.on === true);
  check('turnOn -> on=true', st.on === true, JSON.stringify(st));

  // 3) Brilho em 3 níveis (diminuir/intensificar)
  for (const level of [20, 60, 100]) {
    await adapter.setBrightness(level);
    st = await waitFor((s) => s.brightness != null && Math.abs(s.brightness - level) <= 3);
    const diff = st.brightness != null ? Math.abs(st.brightness - level) : 999;
    check(`setBrightness ${level} -> brilho lido ~${level}`, diff <= 3, `lido=${st.brightness}`);
  }

  // 4) Temperatura de cor
  await adapter.setColorTemp(4000);
  st = await waitFor((s) => s.colorTemp != null && Math.abs(s.colorTemp - 4000) <= 100);
  check('setColorTemp 4000K (modo branco)', st.colorTemp != null, `lido=${st.colorTemp}K`);

  // 5) Cor RGB
  await adapter.setColor('#4F8EF7');
  st = await waitFor((s) => s.color != null);
  check('setColor #4F8EF7 (modo colour)', st.color != null, `lido=${st.color}`);

  // 6) Desligar
  await adapter.turnOff();
  st = await waitFor((s) => s.on === false);
  check('turnOff -> on=false', st.on === false, JSON.stringify(st));

  console.log('\n=== STATUS FINAL ===');
  console.log(JSON.stringify(await adapter.getRawStatus(), null, 2));

  console.log(`\n===== PLACAR SPIKE CLOUD: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n✗ Spike Tuya Cloud FALHOU:', err?.message ?? err);
  console.error('  Dicas: (1) base URL do data center certo? (Brasil/EUA => openapi.tuyaus.com).');
  console.error('         (2) o dispositivo está associado ao Cloud Project? (Devices -> Link App Account).');
  console.error('         (3) Access ID/Secret corretos e API "Device Status/Control" habilitada no projeto?');
  process.exit(1);
});
