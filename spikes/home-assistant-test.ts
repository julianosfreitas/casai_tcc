/**
 * spike: controle de uma entidade via HOME ASSISTANT (REST API), reusando o HomeAssistantAdapter.
 *
 * Valida o caminho "CASAI consome HA" SEM hardware próprio: controla uma entidade (light./switch.)
 * de uma instância Home Assistant existente. CASAI continua o núcleo (ADR-001) — HA é só uma fonte.
 *
 * Credenciais no .env da RAIZ do projeto (este spike carrega ../.env):
 *   HOME_ASSISTANT_BASE_URL   (ex.: http://homeassistant.local:8123)
 *   HOME_ASSISTANT_TOKEN      (Long-Lived Access Token: HA -> perfil -> Tokens de longa duração)
 *   HOME_ASSISTANT_ENTITY_ID  (ex.: light.sala  — a entidade a controlar)
 *
 * Como obter o token: HA -> seu perfil -> "Long-Lived Access Tokens" -> Create Token.
 * Como obter o entity_id: HA -> Ferramentas do Desenvolvedor -> Estados.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HomeAssistantAdapter,
  type HomeAssistantConfig,
} from '../apps/api/src/devices/adapters/home-assistant.adapter';
import type { AdapterContext } from '../apps/api/src/devices/device-adapter.interface';
import type { DeviceState } from '../apps/api/src/devices/device-adapter.interface';

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
  const cfg: HomeAssistantConfig = {
    baseUrl: requireEnv('HOME_ASSISTANT_BASE_URL'),
    token: requireEnv('HOME_ASSISTANT_TOKEN'),
  };
  const entityId = requireEnv('HOME_ASSISTANT_ENTITY_ID');
  const isLight = entityId.startsWith('light.');

  const ctx: AdapterContext = {
    deviceId: 'spike-ha',
    name: 'Entidade HA (spike)',
    externalId: entityId,
    supportsBrightness: isLight,
    supportsColor: isLight,
    supportsColorTemp: isLight,
    supportsEnergy: false,
  };

  const adapter = new HomeAssistantAdapter(ctx, { config: cfg });
  console.log(`→ Home Assistant: ${cfg.baseUrl}  entity=${entityId}\n`);

  console.log('=== ESTADO INICIAL ===');
  console.log(JSON.stringify(await adapter.readState(), null, 2));

  // Algumas entidades (ex.: backed por nuvem) refletem o comando com atraso — fazemos polling.
  const POLL_TRIES = 6;
  const POLL_DELAY = 600;
  async function waitFor(pred: (s: DeviceState) => boolean): Promise<DeviceState> {
    let last = await adapter.readState();
    for (let i = 0; i < POLL_TRIES && !pred(last); i++) {
      await sleep(POLL_DELAY);
      last = await adapter.readState();
    }
    return last;
  }

  console.log('\n=== COMANDOS ===');
  await adapter.turnOn();
  let st = await waitFor((s) => s.on === true);
  check('turnOn -> on=true', st.on === true, JSON.stringify(st));

  if (isLight) {
    for (const level of [20, 100]) {
      await adapter.setBrightness(level);
      st = await waitFor((s) => s.brightness != null && Math.abs(s.brightness - level) <= 5);
      const diff = st.brightness != null ? Math.abs(st.brightness - level) : 999;
      check(`setBrightness ${level} -> lido ~${level}`, diff <= 5, `lido=${st.brightness}`);
    }
    await adapter.setColor('#4F8EF7');
    st = await waitFor((s) => s.color != null);
    check('setColor #4F8EF7', st.color != null, `lido=${st.color}`);
  }

  await adapter.turnOff();
  st = await waitFor((s) => s.on === false);
  check('turnOff -> on=false', st.on === false, JSON.stringify(st));

  console.log(`\n===== PLACAR SPIKE HOME ASSISTANT: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n✗ Spike Home Assistant FALHOU:', err?.message ?? err);
  console.error('  Dicas: (1) BASE_URL certo e acessível? (ex.: http://homeassistant.local:8123).');
  console.error('         (2) token válido? (Long-Lived Access Token, não a senha).');
  console.error('         (3) entity_id existe? confira em Ferramentas do Desenvolvedor -> Estados.');
  process.exit(1);
});
