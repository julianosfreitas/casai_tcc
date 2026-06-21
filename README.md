# CASAI — Casa Inteligente de baixo custo, por voz, 100% local

Sistema de automação residencial controlável por **voz em português brasileiro**,
que funciona na **rede local** (offline-first), sem depender de nuvem. Projeto de TCC
cujo objetivo é provar que uma família brasileira monta automação funcional por
menos de **R$ 200** em hardware, sem nuvem nem conhecimento técnico.

- **Hub (backend):** NestJS + Prisma + PostgreSQL — controle local de Tuya/Intelbras
  e Tapo, voz (Whisper no hub), energia, rotinas, cenas e gamificação.
- **App (web PWA):** Next.js 15 — instalável no celular ("Adicionar à tela inicial"),
  tema monocromático claro/escuro, tempo real via Socket.IO.
- **Princípios:** local-first, adapter pattern, modo MOCK (roda sem hardware),
  segredos cifrados (AES-256-GCM), escopo por usuário. Ver [CLAUDE.md](CLAUDE.md).

> **Por que web PWA e não app nativo?** Decisão registrada (ADR-002 no CLAUDE.md):
> o PWA instala como app no celular sem loja, roda em qualquer aparelho e simplifica
> a demo do TCC. **Não existe "API Intelbras" separada** (ADR-001): a linha Izy é
> Tuya white-label, coberta pelo mesmo `tuyapi`.

## 📍 Status atual — onde paramos (21/06/2026)

**✅ Pronto e verde:** app completo (login/Google/demo, dispositivos, rotinas, cenas,
voz, energia, gamificação, PWA, tempo real) · **Tapo P110 controlado LOCAL de verdade**
(KLAP) · Tuya Cloud provado 8/8 contra device virtual · CI verde (cobertura ~80%) ·
deploy Render + Vercel.

**🟡 Em andamento — controle FÍSICO da lâmpada Intelbras EWS 410:**

| Item | Estado |
|------|--------|
| Hardware confirmado | **Wi-Fi 2,4 GHz + Tuya** (não Zigbee), RGBCW E27, Kelvin 3000–6500K — fontes oficiais. Ver [docs/EWS410-integracao.md](docs/EWS410-integracao.md). |
| Via escolhida | **Controle LOCAL na LAN via `tuyapi`** (adapter `TUYA` já existe). Cloud/HA = fallback. |
| **GARGALO atual** | A lâmpada **não está no projeto Tuya** (só o device virtual) nem na LAN. Falta **provisionar**: parear no **SmartLife** (não Izy) → **Link App Account** no projeto `casai`. Bloqueio no link: *"upper limit of 2 projects"* → **desvincular a conta SmartLife de 1 projeto antigo** em iot.tuya.com (cada projeto → Devices → Link Tuya App Account → Unlink). |
| Motor pronto | [`spikes/ews410-bootstrap.cjs`](spikes/ews410-bootstrap.cjs) — assim que a lâmpada parear+linkar, faz tudo: pega device_id+local_key da nuvem, lê `/specification` (v1 vs v2 + Kelvin), acha IP+protocolo na LAN, e **controla local** (dump DPS real + on/off/brilho/temp/cor). |

**▶️ Como retomar (na ordem):**
1. No celular: SmartLife → reset da lâmpada (liga/desliga interruptor **5× ~2s** → pisca rápido) → Add Device na Wi-Fi **2,4 GHz**.
2. iot.tuya.com → liberar 1 slot (Unlink de projeto antigo) → projeto `casai` → **Link Tuya App Account** (QR).
3. Confirmar a lâmpada em **Devices → All Devices** (Online).
4. Rodar: `node spikes/ews410-bootstrap.cjs` → ele imprime os **DPS reais**.
5. Ajustar o adapter com base no dump (ver pendências abaixo) e cadastrar o device (`protocol='TUYA'`).

**🔧 Pendências de código (aplicar APÓS o dump real da lâmpada):**
- **Resolver contradição de DPS:** `apps/api/src/devices/adapters/tuya.adapter.ts:16` usa `POWER:20` (esquema v2) mas `spikes/tuya-test.ts` **assume** `POWER:1` (v1) — **nenhum verificado em hardware**. Só `get({schema:true})` decide.
- Tornar escala brilho/temp **configurável** (v1 0–255 vs v2 0–1000) em vez de hardcoded.
- Calibrar Kelvin: piso **2700→3000K** (hardware é 3000–6500K).
- Escrever `work_mode='colour'` no caminho LAN se a cor não "pegar".

**📝 WIP não commitado (do dono, preservado no working tree — NÃO subido):** tela de
sign-up (`apps/web/src/app/login/page.tsx`, `components/ui/sign-up.tsx`, `package.json`).

```
casai/
├── apps/
│   ├── api/        # NestJS (hub): auth, devices+discovery, energy, voice,
│   │              #   automations, scenes, gamification, demo, websocket
│   └── web/        # Next.js 15 PWA: login, dashboard, rotinas, dispositivos, conquistas
├── packages/types/ # tipos TS compartilhados
├── spikes/         # validação de hardware (Passo 1)
├── docker/         # initdb + mosquitto
├── scripts/        # backup do banco
├── render.yaml     # blueprint de deploy (Render + Postgres)
└── docker-compose.yml
```

## Funcionalidades

| Área | O que faz |
|------|-----------|
| **Login** | E-mail/senha (JWT), **Google** (Identity Services) e **botão demo** (1 clique). |
| **Dispositivos** | Cadastro guiado por protocolo (Tuya/Intelbras, Tapo, MOCK), **descoberta automática na rede**, status online/offline, testar conexão, remover. |
| **Rotinas** | Automações por horário + dias da semana, com construtor de ações (ligar/desligar/brilho, atraso). Ativar/desativar e executar agora. |
| **Cenas** | Vários comandos em um toque (ex.: 🎬 Modo cinema), ativáveis no dashboard. |
| **Voz** | Comando em pt-BR (Whisper no hub) via FAB de microfone. |
| **Energia** | Potência atual, kWh do dia, custo em R$ e projeção mensal, gráfico 24h. |
| **Gamificação** | Pontos, níveis e conquistas que recompensam usar o sistema. |
| **Tempo real** | Mudanças de estado/energia chegam via WebSocket sem recarregar. |
| **PWA** | Instalável no celular, tabs no rodapé, tema claro/escuro. |

## Pré-requisitos

- Node.js 20+ · Docker + Docker Compose · (opcional) hardware Tuya/Tapo para uso real.

## 1. Banco de dados

```bash
docker compose up -d casai-db        # sobe o PostgreSQL (cria casai_dev e casai_test)
```

## 2. Backend (apps/api)

```bash
cd apps/api
cp ../../.env.example .env            # preencha JWT_SECRET e CASAI_ENCRYPTION_KEY
#   gere a chave: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm install
npx prisma migrate deploy             # aplica as migrations
npx prisma db seed                    # usuário demo + dispositivos MOCK + rotinas + cenas
npm run start:dev                     # API em http://localhost:4000
```

Credencial de demonstração semeada: **`dev@casai.local` / `Senha@123`**
(3 dispositivos MOCK incl. ☕ Cafeteira, 4 rotinas e 3 cenas de exemplo).

### Variáveis de ambiente principais

| Variável | Para quê |
|----------|----------|
| `DATABASE_URL` / `TEST_DATABASE_URL` | conexão Postgres (dev/test) |
| `JWT_SECRET` | assinatura dos tokens (≥ 32 chars) |
| `CASAI_ENCRYPTION_KEY` | AES-256-GCM dos segredos de device (64 hex) |
| `WHISPER_MODEL` / `WHISPER_LANGUAGE` | STT no hub (padrão `small` / `pt`) |
| `ENERGY_POLL_INTERVAL_SECONDS` | intervalo do polling de energia |
| `WEB_ORIGIN` | origem permitida no CORS |
| `GOOGLE_CLIENT_ID` | login com Google (opcional — sem ele, `/auth/google` responde 503) |
| `DEMO_MODE` | `true` semeia dados de demonstração no boot (deploy público) |

### Login com Google (opcional)

1. Crie um **OAuth Client ID** (tipo *Web application*) em
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. Em *Authorized JavaScript origins*, adicione `http://localhost:3000` (dev) e a
   URL pública do deploy.
3. Coloque o MESMO valor em `GOOGLE_CLIENT_ID` (API) e
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web, em `apps/web/.env.local`).

Sem as variáveis o botão "Entrar com o Google" não aparece e o login local por
e-mail/senha continua funcionando. Contas Google são criadas sem senha local
(`passwordHash` nulo) e vinculadas pelo `googleId`; se já existir conta com o mesmo
e-mail (verificado pelo Google), ela é vinculada em vez de duplicada.

## 3. Web (apps/web)

```bash
cd apps/web
npm install
npm run dev                           # dashboard em http://localhost:3000
```

`apps/web/.env.local` aponta a web para a API:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=        # opcional (mesmo valor de GOOGLE_CLIENT_ID)
```

### Instalar no celular (PWA)

Acesse a web pelo navegador do celular (na mesma rede, ou pela URL pública) e use
**"Adicionar à tela inicial"**. O CASAI abre como app em tela cheia.

## 4. Dispositivos: descoberta e cadastro

A tela **Dispositivos** tem dois caminhos:

1. **Procurar na rede** — varre a LAN automaticamente: escuta broadcast Tuya
   (UDP 6666/6667), prova portas TCP (80/6668/9999) e identifica o fabricante pelo
   MAC (OUI). Lista os candidatos (Tuya/Intelbras ou Tapo) e preenche o cadastro
   com um clique. *Funciona melhor com o hub rodando direto no host (vê a LAN).*
2. **Cadastro manual** por protocolo.

> A descoberta **identifica** o aparelho, mas **controlar exige credenciais**:
> - **Tuya/Intelbras:** `local_key` + Device ID (obtenha pelo portal Tuya IoT —
>   ver [docs/HARDWARE_SETUP.md](docs/HARDWARE_SETUP.md)). A `local_key` é cifrada
>   no banco; nunca é logada nem commitada.
> - **Tapo:** e-mail e senha da conta TP-Link (também cifrada).

## 5. Voz (Whisper no hub)

O STT roda no backend. Para habilitar a transcrição real, instale a lib (compila
o whisper.cpp — precisa de build tools):

```bash
cd apps/api && npm i nodejs-whisper
```

Sem ela, `/voice/command` por **texto** funciona normalmente; o áudio responde 503
com orientação. O áudio é **descartado** após transcrever (LGPD).

## 6. Testes

```bash
cd apps/api
npm test            # unitários (sem banco) — 68 testes
npm run test:e2e    # e2e supertest (usa casai_test)
npm run test:cov    # cobertura combinada (meta ≥ 80% statements/lines)
npm run lint

cd ../web
npm run lint && npm run build
```

Adapters Tuya/Tapo, o scanner de rede e o STT nativo ficam fora da cobertura
(não testáveis sem hardware/rede — regra do CLAUDE.md).

## 7. Hardware (Tuya/Tapo)

Antes de usar dispositivos reais, valide com os **spikes** (Passo 1): veja
[spikes/README.md](spikes/README.md) e [docs/HARDWARE_SETUP.md](docs/HARDWARE_SETUP.md).

## 8. Deploy (apresentação do TCC)

Guia completo em **[docs/DEPLOY.md](docs/DEPLOY.md)**. Resumo:

- **Defesa ao vivo (hardware real):** `docker compose up -d` no notebook + hotspot
  próprio + lâmpada/tomada na mesa. PWA instalado no celular.
- **URL pública (banca acessa):** **Vercel** (web) + **Render** (API+Postgres free,
  via `render.yaml`) com `DEMO_MODE=true` — banco se popula sozinho no boot.
  Custo: **R$ 0**.

### Deploy local com Docker

```bash
# Defina JWT_SECRET e CASAI_ENCRYPTION_KEY no .env da raiz, então:
docker compose up -d                  # db + mqtt + api + web
# Web: http://localhost:3100   API: http://localhost:4000
```

## 9. Backup do banco

```bash
./scripts/backup-db.sh ./backups      # pg_dump comprimido; mantém os 14 últimos
```

## 10. CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)): lint + testes +
cobertura + `npm audit` (falha em alta/crítica) + secret scanning (gitleaks).

## Endpoints principais (API, prefixo `/api`)

- `POST /auth/sign_up | sign_in | google | refresh | sign_out`, `GET /auth/me`
- `GET/POST/PATCH/DELETE /devices`, `POST /devices/:id/command`, `POST /devices/discover`
- `GET /devices/:id/energy/history`, `GET /energy/summary`
- `POST /voice/transcribe`, `POST /voice/command`
- `GET/POST/PATCH/DELETE /automations`, `POST /automations/:id/run`
- `GET/POST/PATCH/DELETE /scenes`, `POST /scenes/:id/activate`
- `GET /gamification/summary`
- WebSocket: `device:status_changed`, `device:offline`, `energy:reading`, `automation:triggered`

## Capturas

Em [docs/screenshots/](docs/screenshots/): login (claro/escuro), dashboard, rotinas,
conquistas, descoberta de rede e telas no formato de celular.

## Escopo e roadmap

MVP e cortes em [CLAUDE.md](CLAUDE.md) §9. Plano de evolução em
[docs/ESCOPO_MELHORIA.md](docs/ESCOPO_MELHORIA.md). Geofencing por GPS (ex.: ligar a
luz ao chegar em casa) é item de **fase futura** — o CASAI é local-first e não faz
controle por geolocalização no MVP.
