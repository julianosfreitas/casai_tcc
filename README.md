# CASAI — Casa Inteligente de baixo custo, por voz, 100% local

Sistema de automação residencial controlável por voz em **português brasileiro**,
que funciona na **rede local** (offline-first), sem depender de nuvem. Projeto de TCC.

- **Backend (hub):** NestJS + Prisma + PostgreSQL — controle local de Tuya/Tapo,
  voz (Whisper no hub), energia, automações e cenas.
- **Web:** Next.js 15 + shadcn/ui (dark-first glass) + PWA, tempo real via Socket.IO.
- **Princípios:** local-first, adapter pattern, modo MOCK (roda sem hardware),
  segredos cifrados (AES-256-GCM), escopo por usuário. Ver [CLAUDE.md](CLAUDE.md).

```
casai/
├── apps/
│   ├── api/        # NestJS (hub): auth, devices, energy, voice, automations, scenes, websocket
│   └── web/        # Next.js 15 dashboard (PWA)
├── packages/types/ # tipos TS compartilhados
├── spikes/         # validação de hardware (Passo 1)
├── docker/         # initdb + mosquitto
├── scripts/        # backup do banco
└── docker-compose.yml
```

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
npx prisma migrate dev                # aplica as migrations
npx prisma db seed                    # usuário dev@casai.local / Senha@123 + devices MOCK
npm run start:dev                     # API em http://localhost:4000  (Swagger em /docs)
```

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

### Login com Google (opcional)

1. Crie um **OAuth Client ID** (tipo *Web application*) em
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. Em *Authorized JavaScript origins*, adicione `http://localhost:3000` (dev) e a
   URL pública do deploy.
3. Coloque o MESMO valor em `GOOGLE_CLIENT_ID` (API) e
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web, em `apps/web/.env.local`).

Sem as variáveis o botão "Entrar com o Google" simplesmente não aparece e o login
local por e-mail/senha continua funcionando. Contas Google são criadas sem senha
local (`passwordHash` nulo) e vinculadas pelo `googleId`; se já existir conta com
o mesmo e-mail (verificado pelo Google), ela é vinculada em vez de duplicada.

## 3. Web (apps/web)

```bash
cd apps/web
npm install
npm run dev                           # dashboard em http://localhost:3000
```

`NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WS_URL` em `apps/web/.env.local` apontam para a API.

## 4. Voz (Whisper no hub)

O STT roda no backend. Para habilitar a transcrição real, instale a lib (compila
o whisper.cpp — precisa de build tools):

```bash
cd apps/api && npm i nodejs-whisper
```

Sem ela, `/voice/command` por **texto** funciona normalmente; o áudio responde 503
com orientação. O áudio é **descartado** após transcrever (LGPD).

## 5. Testes

```bash
cd apps/api
npm test            # unitários (sem banco)
npm run test:e2e    # e2e supertest (usa casai_test)
npm run test:cov    # cobertura combinada (meta ≥ 80% statements/lines)
npm run lint
```

Cobertura atual: **~87% statements / ~87% lines**. Adapters Tuya/Tapo e o STT
nativo ficam fora da cobertura (não testáveis sem hardware — regra do CLAUDE.md).

## 6. Hardware (Tuya/Tapo)

Antes de usar dispositivos reais, valide com os **spikes** (Passo 1): veja
[spikes/README.md](spikes/README.md) e [docs/HARDWARE_SETUP.md](docs/HARDWARE_SETUP.md).
A `local_key` do Tuya é cifrada no banco; nunca é logada nem commitada.

## 7. Deploy (CasaOS / Docker)

```bash
# Defina JWT_SECRET e CASAI_ENCRYPTION_KEY no .env da raiz, então:
docker compose up -d                  # db + mqtt + api + web
# Web: http://localhost:3100   API: http://localhost:4000
```

O stack inclui Mosquitto (MQTT) já provisionado para Zigbee (fase futura).

## 8. Backup do banco

```bash
./scripts/backup-db.sh ./backups      # pg_dump comprimido; mantém os 14 últimos
```

Agende no cron do host/CasaOS (ex.: diário).

## 9. CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)): lint + testes +
cobertura + `npm audit` (falha em alta/crítica) + secret scanning (gitleaks).

## Endpoints principais (API, prefixo `/api`)

- `POST /auth/sign_up | sign_in | google | refresh | sign_out`, `GET /auth/me`
- `GET/POST/PATCH/DELETE /devices`, `POST /devices/:id/command`, `POST /devices/discover`
- `GET /devices/:id/energy/history`, `GET /energy/summary`
- `POST /voice/transcribe`, `POST /voice/command`
- `GET/POST/PATCH/DELETE /automations`, `POST /automations/:id/run`
- `GET/POST/PATCH/DELETE /scenes`, `POST /scenes/:id/activate`
- WebSocket: `device:status_changed`, `device:offline`, `energy:reading`, `automation:triggered`
