# CASAI — Memória do Projeto

> Este arquivo é lido pelo Claude Code em toda sessão. É a fonte de verdade
> sobre o projeto. Mantenha-o atualizado conforme decisões mudam.

## 1. O que é o CASAI

Sistema de automação residencial de baixo custo, controlável por voz em português
brasileiro, que funciona 100% na rede local (offline-first). É um projeto de TCC cujo
objetivo é provar que uma família brasileira consegue montar automação funcional por
menos de R$ 200 em hardware, sem depender de nuvem nem de conhecimento técnico.

## 2. Stack (DECIDIDA — não trocar sem registrar um ADR)

- **Backend:** Node.js 20 LTS + TypeScript + NestJS + Prisma + PostgreSQL 16
- **Frontend:** Next.js 15 + React 19 + **PWA instalável no celular** (ADR-002 —
  substituiu o plano original de Expo/React Native durante o build)
- **Tempo real:** WebSocket (Socket.IO)
- **IoT:** `tuyapi` (Tuya/Intelbras — Intelbras Izy É Tuya white-label, mesmo protocolo)
  · `tp-link-tapo-connect` (Tapo) · MQTT (Zigbee, fase 2)
- **Voz (STT):** Whisper rodando NO BACKEND/hub — nunca no celular
- **Testes:** Jest + supertest (backend) · Testing Library (web)
- **Estado web:** TanStack Query (server state) — sem Zustand no MVP
- **Estilo web:** Tailwind 4 + shadcn/ui · tema monocromático neutro
  (light branco/preto, dark `#0a0a0a`), azul SOMENTE nos gráficos (`--chart-1..5`),
  sem neon/amarelo/glow

### ADRs (decisões registradas)

- **ADR-001 — Não usar Home Assistant como núcleo.** O hub CASAI é a contribuição
  do TCC; HA entra na monografia só como trabalho relacionado. Não existe "API
  Intelbras" separada: a linha Izy é Tuya white-label, coberta pelo `tuyapi`.
- **ADR-002 — Frontend é web PWA (Next.js), não Expo.** O app "no celular" é o
  PWA instalado (Add to Home Screen). Os trechos sobre Expo/NativeWind abaixo
  são históricos.

## 3. Hardware-alvo (já adquirido)

| Dispositivo | Modelo | Protocolo | Capacidades |
|-------------|--------|-----------|-------------|
| Lâmpada LED | Intelbras EWS 410 | Wi-Fi / Tuya | on/off, brilho, cor RGB |
| Tomada | TP-Link Tapo P110 | Wi-Fi / Tapo | on/off, energia (W, kWh) |

## 4. Princípios inegociáveis

1. **Local-first.** Todo controle tenta a rede local primeiro. Nuvem só como
   fallback explícito e comentado. Se o controle local quebrar, o sistema avisa —
   não cai silenciosamente para a nuvem.
2. **Adapter pattern sempre.** Nenhum controller ou serviço chama `tuyapi` ou
   `tp-link-tapo-connect` diretamente. Tudo passa pela interface `DeviceAdapter`.
3. **Modo MOCK obrigatório.** O sistema inteiro roda sem hardware. Todo dispositivo
   tem um equivalente MOCK para desenvolvimento e testes.
4. **Pesquisar antes de usar lib de IoT.** As APIs de `tuyapi` e `tp-link-tapo-connect`
   mudam entre versões. Antes de escrever código que as use, leia o README atual no
   npm/GitHub. Nunca confie na memória do treino para essas libs.
5. **Segredos nunca em texto puro.** A `local_key` do Tuya é criptografada (AES-256-GCM)
   antes de salvar. Nunca logada, nunca commitada.
6. **Escopo por usuário.** Toda query de dados filtra por `userId`. Um usuário nunca
   acessa dados de outro.

## 5. Estrutura do monorepo

```
casai/
├── apps/
│   ├── api/                 # NestJS backend (hub)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── devices/
│   │   │   │   ├── adapters/     # TuyaAdapter, TapoAdapter, MockAdapter
│   │   │   │   └── device-adapter.interface.ts
│   │   │   ├── automations/
│   │   │   ├── scenes/
│   │   │   ├── energy/
│   │   │   ├── voice/
│   │   │   └── websocket/
│   │   ├── prisma/schema.prisma
│   │   └── test/
│   └── web/                 # Next.js 15 PWA (dashboard, rotinas, dispositivos)
├── packages/types/          # tipos TS compartilhados
├── spikes/                  # scripts de validação (descartáveis)
└── docker-compose.yml
```

## 6. Convenções de código

- **Nomes:** camelCase para variáveis/funções, PascalCase para classes/tipos,
  kebab-case para arquivos (`device-adapter.interface.ts`).
- **DTOs:** todo endpoint valida entrada com class-validator. Nunca confie no body cru.
- **Erros:** use exceptions do NestJS (`NotFoundException`, `UnprocessableEntityException`).
  Mensagens de erro voltadas ao usuário sempre em português.
- **Async:** sempre async/await, nunca callbacks crus (exceto eventos do `tuyapi`,
  que são EventEmitter — encapsule no adapter).
- **Tipos:** zero `any`. Se precisar, use `unknown` e faça narrowing.
- **Comentários:** explique o PORQUÊ, não o O QUÊ. Código óbvio não precisa de comentário.

## 7. Comandos

```bash
# Backend
npm run start:dev          # dev com hot reload
npm run build              # build de produção
npm test                   # testes
npm run test:cov           # testes com cobertura

# Banco
npx prisma migrate dev     # aplicar migrations em dev
npx prisma studio          # GUI do banco
npx prisma db seed         # popular dados de teste (inclui devices MOCK)

# Web
cd apps/web && npm run dev    # http://localhost:3000
```

## 8. Lista de "NÃO FAÇA"

- NÃO chame libs de IoT fora dos adapters.
- NÃO commite `.env`, `local_key`, ou qualquer credencial.
- NÃO implemente Zigbee, Matter ou controle remoto fora da LAN no MVP (é fase futura).
- NÃO adicione Redis, rotação de refresh token ou TLS na LAN no MVP (over-engineering).
- NÃO logue áudio de voz nem credenciais.
- NÃO use `any` em TypeScript.
- NÃO assuma a API de uma lib de IoT — verifique o README atual primeiro.

## 9. Corte MVP vs. Futuro

**MVP (TCC 1) — construir:**
controle local de Tuya + Tapo, voz pt-BR no hub, dashboard com widgets, automações
por horário, dashboard de energia, tema claro/escuro, auth JWT simples, modo MOCK.

**Futuro (TCC 2 / pós-defesa) — NÃO construir agora:**
Zigbee (Sonoff ZBDongle-P), Matter, controle remoto fora da LAN, multiusuário,
TLS/WSS na LAN, rotação de refresh token, integração com câmeras/fechaduras.

## 10. Abordagem de testes

- Cobertura mínima: 80% no backend.
- Use o `MockAdapter` para testar `DevicesService` sem hardware.
- Teste o `VoiceCommandParser` com variações de sotaque (ex: "desligua a luz").
- Request specs (supertest) para todos os endpoints de auth e devices.
- Não escreva testes que dependam de hardware físico no CI.

## 11. Métricas do TCC (coletar durante o uso)

- Acurácia de intenção de voz (meta ≥ 88%) — log na tabela `voice_commands`.
- Latência voz→execução (meta < 2s) — campo `latencyMs`.
- Consumo de energia antes/depois de automações — tabela `energy_readings`.
- Custo total do hardware (meta < R$ 200) — já em ~R$ 130.

## 12. Commits

Padrão Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
Exemplo: `feat(devices): adiciona TapoAdapter com leitura de energia`.
