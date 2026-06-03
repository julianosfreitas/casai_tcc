# CASAI — Runbook de Execução para o Claude Code

> Guia mestre para construir o CASAI com o Claude Code de forma autônoma.
> Siga os passos em ordem. Em cada passo: **cole o bloco no Claude Code** e
> depois rode os comandos de **verificação**. O Claude Code trabalha sozinho;
> você só intervém nos pontos de parada marcados (spike falhou, credenciais,
> ação destrutiva).

---

## PASSO 0 — Preparação (faça você, uma vez)

### 0.1 Organize os arquivos na estrutura correta

Crie a pasta do projeto separada dos documentos do TCC e posicione os arquivos:

```bash
mkdir casai && cd casai
git init                      # CRÍTICO: repositório Git para poder reverter tudo

# Coloque na raiz do projeto:
#   CLAUDE.md
#   .env.example   (renomeie de "env.example" se necessário)
#   .gitignore     (renomeie de "gitignore" se necessário)

# Crie a pasta de skills e mova o SKILL.md para dentro dela:
mkdir -p .claude/skills/device-adapter
mv /caminho/para/SKILL.md .claude/skills/device-adapter/SKILL.md

# Guarde o schema.prisma e os documentos de referência:
mkdir -p docs
#   mova para docs/: o PRD, a Revisão Sênior, o HARDWARE_SETUP.md, a UX 21st.dev
#   guarde o schema.prisma à mão — você vai colá-lo no Passo 2
```

> Os arquivos .docx (PRD, Revisão, TCC) e o PDF são **referência**, não fazem
> parte do código. Mantenha-os em `docs/` ou fora do repositório.

### 0.2 Inicie o Claude Code em modo autônomo

```bash
cd casai
claude                        # inicia o Claude Code na pasta do projeto
```

Dentro do Claude Code:
- Pressione **Shift+Tab** para alternar para o modo **"auto-accept edits"**
  (ele passa a aplicar edições de arquivo sem pedir confirmação a cada uma).
- Como você está num repositório Git, qualquer coisa é reversível com
  `git reset --hard` ou `git checkout .`.

> Por que Git + auto-accept em vez de pular todas as permissões: você ganha
> autonomia sem perder a rede de segurança. Se algo sair errado, você reverte
> o commit. Commitar a cada passo (instruído abaixo) cria pontos de retorno.

### 0.3 Mensagem de KICKOFF (cole esta PRIMEIRO no Claude Code)

```
Você vai construir o projeto CASAI. Leia o CLAUDE.md na raiz — ele é a fonte de
verdade e contém a stack, os princípios inegociáveis e a lista de "não faça".
Leia também o skill em .claude/skills/device-adapter/SKILL.md.

Regras de trabalho autônomo para toda esta sessão:
1. Aceite e siga as especificações sem pedir minha confirmação a cada passo.
2. Ao final de CADA passo: rode o lint e os testes, garanta que passam, e faça
   um commit Git com mensagem no padrão Conventional Commits.
3. Antes de usar qualquer biblioteca de IoT (tuyapi, tp-link-tapo-connect),
   pesquise na web e leia o README atual — as APIs mudam.
4. PARE e me pergunte SOMENTE se: (a) um spike de validação de hardware falhar,
   (b) você precisar de uma credencial que só eu tenho, ou (c) for executar uma
   ação destrutiva/irreversível (apagar dados, force push, etc).
5. Em qualquer outra dúvida de design, tome a decisão mais alinhada ao CLAUDE.md
   e siga em frente, registrando a decisão num comentário ou no commit.

Confirme que leu o CLAUDE.md e o skill, e aguarde meu primeiro passo.
```

---

## PASSO 1 — Spike de validação (PONTO DE PARADA OBRIGATÓRIO)

> Antes de construir qualquer coisa, prove que o controle local funciona.
> Tenha a lâmpada Intelbras EWS 410 e a tomada Tapo P110 ligadas na mesma rede.

**Cole no Claude Code:**
```
Crie um diretório spikes/ com três scripts TypeScript descartáveis.

Antes de codar, pesquise e leia o README atual de `tuyapi` e `tp-link-tapo-connect`
no npm/GitHub. Confirme a API de controle local de cada um.

- spikes/tuya-test.ts: conecta na lâmpada EWS 410 (id, key, ip via env),
  liga, espera 2s, desliga, imprime o estado. Inclua comentários explicando
  como obter a local_key (resumo do processo do Tuya IoT Platform).
- spikes/tapo-test.ts: conecta na tomada P110 (email, senha, ip via env),
  lê a potência atual em watts e imprime. Confirme se o valor vem em W ou mW.
- spikes/whisper-test.ts: transcreve um arquivo de áudio pt-BR e mede o tempo.

Crie um package.json mínimo com tsx para rodar os scripts. NÃO crie o projeto
completo ainda — só os spikes. Depois me diga exatamente quais variáveis de
ambiente preciso preencher para testar.
```

**Como executar e verificar:**
```bash
# Preencha as credenciais (use o HARDWARE_SETUP.md como guia):
export TUYA_EWS410_ID=...   TUYA_EWS410_KEY=...   TUYA_EWS410_IP=192.168.x.x
export TAPO_P110_IP=192.168.x.x  TAPO_EMAIL=...  TAPO_PASS=...

npx tsx spikes/tuya-test.ts      # esperado: lâmpada liga e desliga
npx tsx spikes/tapo-test.ts      # esperado: imprime watts
npx tsx spikes/whisper-test.ts   # esperado: transcreve em < 2s
```

> ⛔ Se o tuya-test falhar na local_key repetidamente, PARE. A arquitetura
> "100% local" depende disso. Me avise para reavaliarmos (fallback de nuvem).
> ✅ Se os três passarem, o maior risco do projeto está eliminado. Prossiga.

---

## PASSO 2 — Scaffold + Prisma + banco

**Cole no Claude Code:**
```
Spikes validados. Agora monte o projeto.

1. Crie a estrutura monorepo: apps/api (NestJS), apps/web (placeholder),
   packages/types. Configure apps/api com NestJS modular (módulos vazios:
   auth, users, devices, automations, scenes, energy, voice, websocket),
   Prisma, @nestjs/config, class-validator, ESLint + Prettier.

2. Vou colar o schema Prisma a seguir. Coloque-o em apps/api/prisma/schema.prisma,
   rode `npx prisma format`, crie a migration inicial e gere o client.

3. Crie um seed (prisma/seed.ts) com: 1 usuário de teste (dev@casai.local /
   Senha@123), 3 cômodos (Sala, Quarto, Cozinha), 1 dispositivo MOCK do tipo
   LIGHT na Sala e 1 MOCK do tipo PLUG (supportsEnergy=true) na Cozinha.

4. Crie um PrismaService injetável.

Ao terminar, rode as migrations e o seed, depois commite.

[COLE AQUI O CONTEÚDO COMPLETO DO schema.prisma]
```

**Como executar e verificar:**
```bash
cd apps/api
docker compose up -d              # sobe o PostgreSQL (se já tiver o compose)
npx prisma migrate dev            # aplica as migrations
npx prisma db seed                # popula dados mock
npx prisma studio                 # abre o GUI — confira as tabelas e o seed
```

---

## PASSO 3 — Autenticação JWT

**Cole no Claude Code:**
```
Implemente o módulo de autenticação conforme o CLAUDE.md.

- Endpoints: /auth/sign_up, /auth/sign_in, /auth/refresh, /auth/sign_out
- Senha com bcrypt; JWT de acesso (15min) + refresh token (30d, salvo com hash)
- Guard global protegendo tudo exceto /auth
- Toda query filtrada por userId
- Rate-limiting no login com @nestjs/throttler (anti força-bruta) — isto é
  CRÍTICO de segurança, não pule
- Headers de segurança com helmet; CORS restrito à origem do app

Escreva testes (supertest): login OK, senha errada, rota protegida sem token (401),
refresh, e um teste provando que um usuário não vê dados de outro.
Mantenha simples (sem rotação complexa nem Redis — TODO para v2). Commite ao fim.
```

**Verificar:**
```bash
npm test                          # testes de auth devem passar
npm run start:dev                 # sobe a API; teste o login via curl/Insomnia
```

---

## PASSO 4 — Dispositivos + Adapter Pattern (NÚCLEO)

**Cole no Claude Code:**
```
Implemente o módulo de dispositivos seguindo o skill device-adapter à risca.

Pesquise e confirme a API atual de tuyapi (connect, set com dps, eventos) e de
tp-link-tapo-connect (loginByIp, getDeviceInfo, energia) ANTES de codar.

1. Interface DeviceAdapter (connect, disconnect, turnOn, turnOff, toggle,
   setBrightness, setColor, setColorTemp, readState, readEnergy).
2. TuyaAdapter, TapoAdapter e MockAdapter implementando a interface.
   - Tuya: conexão TCP persistente reaproveitada entre comandos.
   - Tapo: cache de sessão com re-login sob expiração.
   - Capacidade não suportada lança NotImplementedException.
3. DeviceAdapterFactory que escolhe o adapter pelo campo protocol.
4. FILA SERIALIZADA POR DISPOSITIVO (lock por deviceId): comandos ao mesmo
   dispositivo são processados em série, nunca em paralelo. Isto é obrigatório —
   um dispositivo Tuya aceita só uma conexão local por vez.
5. DevicesService + endpoints REST (CRUD, /discover, /:id/command).
6. local_key cifrada com AES-256-GCM (chave CASAI_ENCRYPTION_KEY do ambiente)
   antes de salvar; nunca logada.

Escreva testes usando o MockAdapter (sem hardware). Commite ao fim.
```

**Verificar:**
```bash
npm test                          # testes do DevicesService com MockAdapter passam
# Teste manual com o dispositivo MOCK do seed via a API
```

---

## PASSO 5 — WebSocket (tempo real)

**Cole no Claude Code:**
```
Implemente o módulo WebSocket (Socket.IO recomendado — pesquise a integração
atual com NestJS).

Eventos servidor→cliente: device:status_changed, device:offline, energy:reading,
automation:triggered. Ao executar um comando via REST, faça broadcast do novo
estado para os clientes do usuário. Autentique a conexão com o mesmo JWT.
Escreva um teste do gateway. Commite ao fim.
```

**Verificar:**
```bash
npm test
# Conecte um cliente WebSocket de teste e confirme o broadcast ao mudar estado
```

---

## PASSO 6 — Polling de energia (Tapo P110)

**Cole no Claude Code:**
```
Implemente a coleta periódica de energia.

Confirme via pesquisa os campos exatos de energia do tp-link-tapo-connect
(current_power, today_energy, month_energy) e as unidades (W/mW, Wh/kWh).

- Job (@nestjs/schedule) a cada 5s lendo energia dos dispositivos TAPO com
  supportsEnergy=true; salva em energy_readings; faz broadcast energy:reading.
- GET /devices/:id/energy/history?period=24h|7d|30d&granularity=hour|day
- GET /energy/summary (total + custo via energyRate + projeção mensal)
- Converta corretamente para R$.

Escreva testes. Commite ao fim.
```

**Verificar:**
```bash
npm test
# Com o Tapo real (ou mock), confira leituras aparecendo na tabela energy_readings
```

> A partir daqui, **comece a coletar energia em paralelo** — o TCC precisa de
> ~30 dias de dados. Deixe a tomada medindo um aparelho real (ex: TV).

---

## PASSO 7 — Voz: Whisper no hub

**Cole no Claude Code:**
```
Implemente o módulo de voz. O STT roda NO BACKEND.

Pesquise a melhor forma atual de rodar Whisper em Node no servidor (whisper.cpp
binding, nodejs-whisper, ou processo Python com faster-whisper) e documente a escolha.

- POST /voice/transcribe (recebe áudio, retorna texto pt-BR). O áudio é
  descartado após a transcrição — nunca persistido (LGPD).
- VoiceCommandParser (texto + dispositivos do usuário → intent, deviceId,
  payload, confidence) com a gramática pt-BR e o dicionário de cores. Resolução
  de ambiguidade: confidence < 0.6 ou múltiplos matches → retorna sugestões.
- POST /voice/command (executa o intent via DevicesService).
- Log em voice_commands (para a métrica de acurácia do TCC), com latencyMs.

Escreva testes do parser com variações de sotaque (ex: 'desligua a luz'). Commite.
```

**Verificar:**
```bash
npm test
# Envie um áudio de teste para /voice/transcribe e confira intent + execução
```

---

## PASSO 8 — Automações e cenas

**Cole no Claude Code:**
```
Implemente automações e cenas conforme o schema.

- CRUD de automações e cenas
- Gatilhos SCHEDULE: registra/cancela jobs cron ao criar/ativar/desativar/remover
- Avalia condições (TIME_RANGE, WEEKDAY) antes de executar
- Executa ações em ordem, respeitando delaySeconds, usando a FILA por dispositivo
- POST /automations/:id/run (simular agora) e POST /scenes/:id/activate

Escreva testes com dispositivos MOCK. Commite ao fim.
```

**Verificar:**
```bash
npm test
# Crie uma automação de teste e dispare com /run; confira a execução
```

---

## PASSO 9 — Dashboard web (Next.js + shadcn + 21st.dev)

**Cole no Claude Code:**
```
Crie o dashboard web em apps/web com Next.js 15 + TypeScript + Tailwind + shadcn/ui,
seguindo a especificação de UX (dark-first, glassmorphism, acento azul/amarelo).

Configure shadcn (npx shadcn init) com tema dark-first e as CSS variables do CASAI.
Instale os componentes-base shadcn e busque blocos no 21st.dev para: dashboard
sidebar, bento grid de cards, stats card, area chart (Recharts), command palette,
mode toggle, multi-step form. Antes de instalar cada bloco do 21st.dev, abra a
página e confirme as peer deps e a compatibilidade com Tailwind v4.

Conecte na API via TanStack Query + Socket.IO client. Implemente:
- Tema claro/escuro/sistema com next-themes
- <DeviceWidget /> usando Card + Switch com glassmorphism
- Dashboard com bento grid de widgets
- Dashboard de energia com area chart (Recharts)
- FAB de microfone com Web Audio API → POST /voice/transcribe
- PWA com next-pwa (instalável no celular)

ACESSIBILIDADE É REQUISITO, não opcional: alvos de toque grandes (mín. 44pt),
contraste WCAG AA, rótulos ARIA em tudo, pt-BR sem jargão, confirmação por voz
(TTS) além de visual, respeitar prefers-reduced-motion. Commite ao fim.
```

**Verificar:**
```bash
cd apps/web && npm run dev        # abre o dashboard no navegador
# Confira: tema claro/escuro, cards, comando de voz, gráfico de energia
```

---

## PASSO 10 — Testes, CI, segurança e docs

**Cole no Claude Code:**
```
Finalize a qualidade e a segurança.

- Cobertura de testes ≥ 80% no backend (foco: DevicesService, VoiceCommandParser,
  auth, isolamento entre usuários)
- GitHub Actions: lint + testes + npm audit + secret scanning (gitleaks).
  O build falha se houver vulnerabilidade alta/crítica ou segredo commitado.
- Swagger/OpenAPI (@nestjs/swagger) dos endpoints
- README completo (setup back, web, banco, variáveis, como rodar testes)
- docker-compose.yml com PostgreSQL (+ Mosquitto para Zigbee futuro), pronto
  para o CasaOS, com volume persistente e healthcheck
- Script de backup do banco (pg_dump) documentado

Rode tudo e me mostre o resultado dos testes e da cobertura. Commite ao fim.
```

**Verificar:**
```bash
npm run test:cov                  # cobertura ≥ 80%
npm run lint                      # sem erros
# Confira o CI verde no GitHub após o push
```

---

## Ordem, pontos de parada e checkpoints

| Passo | Entrega | Você intervém? |
|-------|---------|----------------|
| 0 | Setup + kickoff | Sim (faz você) |
| 1 | Spikes de validação | **SIM — ponto de parada** |
| 2 | Scaffold + Prisma + seed | Cola o schema |
| 3 | Auth + rate-limit | Não |
| 4 | Devices + adapter + fila | Não |
| 5 | WebSocket | Não |
| 6 | Energia | Inicia coleta de 30d |
| 7 | Voz (Whisper no hub) | Não |
| 8 | Automações + cenas | Não |
| 9 | Dashboard web | Não |
| 10 | Testes + CI + segurança | Não |

## Regras de ouro do fluxo autônomo

1. **Sempre num repositório Git.** Commit a cada passo = ponto de retorno.
2. **Auto-accept edits (Shift+Tab)**, não pular todas as permissões.
3. **Pontos de parada inegociáveis:** spike falhou, precisa de credencial, ação
   destrutiva. Fora isso, o Claude Code segue sozinho.
4. **Se um passo quebrar os testes**, deixe o Claude Code corrigir antes de avançar
   — não acumule débito para o passo seguinte.
5. **Comece a coletar dados cedo** (energia e voz) — o TCC depende disso e não
   comprime na véspera.
```
