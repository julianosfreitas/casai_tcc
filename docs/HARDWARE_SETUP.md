# HARDWARE_SETUP.md — Runbook de Credenciais e Conexão

> Este é o passo mais frágil e mais importante do projeto. A obtenção da `local_key`
> do Tuya falha com frequência e o processo muda quando a Tuya altera a plataforma.
> **Antes de seguir, peça ao Claude Code para verificar na web se os passos abaixo
> ainda são os atuais** (busque "tuyapi how to get local key 2026" ou similar).

---

## Parte 1 — Lâmpada Intelbras EWS 410 (Tuya)

A EWS 410 usa o ecossistema Tuya por baixo. Para controlá-la localmente, você
precisa de três dados: `id` (device ID), `key` (local key) e `ip` (na sua rede).

### 1.1 Pré-requisitos
- A lâmpada já configurada e funcionando no app **Izy** (Intelbras) ou **Smart Life**.
- A lâmpada e seu computador na mesma rede Wi-Fi 2.4GHz.

### 1.2 Obter device ID e local key (via Tuya IoT Platform)

> A estrutura deste processo é estável, mas os nomes de menus mudam. Verifique.

1. Crie uma conta em **iot.tuya.com** (Tuya IoT Development Platform). É gratuito.
2. No painel, crie um **Cloud Project** (tipo: Smart Home, data center: escolha o
   mais próximo — para o Brasil normalmente "Western America" funciona).
3. Anote o **Access ID/Client ID** e o **Access Secret/Client Secret** do projeto.
4. Na aba do projeto, vá em **Devices → Link Tuya App Account → Add App Account**.
   Será exibido um QR code.
5. No app Izy/Smart Life no celular: **Eu → ícone de scan (canto superior) →**
   escaneie o QR. Isso vincula sua conta de app ao projeto cloud.
6. Volte ao painel. Em **Devices**, sua lâmpada EWS 410 deve aparecer. Anote o
   **Device ID**.
7. A **local key** aparece na visão de detalhes do dispositivo OU pode ser obtida
   via o **API Explorer** (chamada `Get Device Details`) ou pela CLI do tuyapi
   (`@tuya/tuya-cli wizard`), que automatiza os passos 3–7.

### 1.3 Atalho recomendado: CLI do tuyapi

```bash
npm i -g @tuyapi/cli
tuya-cli wizard
# Cole o Access ID, Access Secret e o código do QR (escaneado no app)
# A CLI lista todos os dispositivos com id, key e ip prontos para copiar.
```

### 1.4 Descobrir o IP local

```bash
# O tuyapi pode descobrir via broadcast, mas se precisar manualmente:
# Veja a lista de dispositivos conectados no painel do seu roteador,
# ou rode um scan:
npx tuya-cli list-app  # já traz o IP em muitos casos
```

### 1.5 Validar (use o spike)

```bash
TUYA_ID=xxx TUYA_KEY=yyy TUYA_IP=192.168.1.x npx tsx spikes/tuya-test.ts
# Esperado: lâmpada liga, espera 2s, desliga.
```

### ⚠️ Armadilhas conhecidas
- **A local key muda toda vez que você remove e re-adiciona o dispositivo no app.**
  Se der erro de decriptação, obtenha a key de novo.
- Firmware novo pode usar protocolo **3.4** ou **3.5** — passe a `protocolVersion`
  correta ao `tuyapi`. Se 3.3 falhar, tente 3.4.
- A lâmpada só aceita uma conexão local por vez. Feche o app antes de testar.

---

## Parte 2 — Tomada TP-Link Tapo P110

O Tapo é mais simples: a autenticação local usa seu e-mail e senha da conta TP-Link.

### 2.1 Pré-requisitos
- Tomada configurada no app **Tapo** e na mesma rede Wi-Fi.
- E-mail e senha da sua conta TP-Link.
- Firmware da tomada atualizado (o protocolo local KLAP exige firmware recente).

### 2.2 Descobrir o IP
- No app Tapo: **dispositivo → engrenagem → Informações do dispositivo → IP**.
- Ou no painel do roteador.

### 2.3 Validar (use o spike)

```bash
TAPO_EMAIL=voce@email.com TAPO_PASS=suasenha TAPO_IP=192.168.1.y \
  npx tsx spikes/tapo-test.ts
# Esperado: imprime a potência atual em watts e o estado on/off.
```

### ⚠️ Armadilhas conhecidas
- TP-Link mudou o protocolo de **PASSTHROUGH** para **KLAP** em firmwares novos.
  A lib `tp-link-tapo-connect` v2+ suporta ambos, mas confirme a versão.
- A senha tem limites de caracteres especiais em algumas versões — se a auth falhar,
  teste com uma senha simples temporária.
- O P110 retorna energia em campos `current_power` (W), `today_energy` e
  `month_energy` — **confirme se a unidade é Wh ou kWh** antes de calcular R$.
- A lib pode imprimir `console.warn("Failed to login... Falling back to legacy login method")`
  quando o login KLAP falha e ela cai no protocolo legado. **É benigno**: ela sempre
  tenta KLAP primeiro; no firmware KLAP recente do P110 o login funciona de primeira e
  o aviso nem aparece. O `error` impresso é de transporte/HTTP — **nunca** a senha. Não
  desabilite o fallback. Como a lib escreve fora do `Logger` do Nest, o adapter não
  intercepta o aviso (interceptar exigiria fork/monkey-patch — fora de escopo); o
  logging do próprio `TapoAdapter` é limpo e nunca registra e-mail/senha.
- No CASAI, a busca automática de dispositivos sonda as portas 80/443 (Tapo KLAP) além
  de 6668 (Tuya) e 9999 (legado), mas uma P110 nova pode não aparecer — nesse caso
  cadastre manualmente pelo IP. O controle independe da busca (usa `loginDeviceByIp`).

---

## Parte 2B — Home Assistant (adapter `HOME_ASSISTANT`)

Caminho **aditivo**: o CASAI controla uma entidade de uma instância **Home Assistant
existente** via REST API. O CASAI continua o núcleo (ADR-001) — o HA é só mais uma
fonte atrás do adapter pattern. Útil para reaproveitar dispositivos que o usuário já
pareou no HA (o HA continua responsável pelo pareamento; ver
`RELATED_WORK_Home_Assistant.md`).

### 2B.1 Pré-requisitos
- Uma instância HA acessível na rede (ex.: `http://homeassistant.local:8123`), com o
  dispositivo já adicionado nela.
- Um **Long-Lived Access Token**: HA → seu perfil → "Long-Lived Access Tokens" →
  *Create Token*. Guarde — não aparece de novo.

### 2B.2 Configurar no servidor (`.env` da API)
```
HOME_ASSISTANT_BASE_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=<long-lived access token>
```
No app, cadastre o dispositivo com protocolo **Home Assistant** e informe só o
`entity_id` (ex.: `light.sala`) — descoberto em HA → **Ferramentas do Desenvolvedor →
Estados**. Sem IP, sem local_key.

### 2B.3 Validar (use o spike)
```
HOME_ASSISTANT_BASE_URL=... HOME_ASSISTANT_TOKEN=... HOME_ASSISTANT_ENTITY_ID=light.sala \
  npm --prefix spikes run ha
```
Liga, ajusta brilho/cor (se for `light.`) e desliga, lendo o estado de volta.

### ⚠️ Armadilhas conhecidas
- O **token** é segredo: fica no `.env` do servidor, nunca no código nem commitado, e
  nunca é logado pelo adapter.
- `entity_id` errado → a API do HA responde **404** → o CASAI marca *comando rejeitado*
  (não "offline"). Confira em Ferramentas do Desenvolvedor → Estados.
- Energia (W/kWh) no HA é uma **entidade de sensor separada**, não atributo da
  luz/tomada — por isso `readEnergy()` retorna `null` neste adapter (fora de escopo).
- `color_temp_kelvin` exige HA recente (2022.11+); versões antigas usavam `color_temp`
  em mireds.

---

## Parte 3 — Onde guardar as credenciais

NUNCA no código. Use o `.env` (que está no `.gitignore`):

```bash
# .env (local, nunca commitado)
TUYA_EWS410_ID=...
TUYA_EWS410_KEY=...
TUYA_EWS410_IP=192.168.1.10
TAPO_P110_IP=192.168.1.11
TAPO_EMAIL=voce@email.com
TAPO_PASS=...
CASAI_ENCRYPTION_KEY=  # 32 bytes para criptografar a local_key no banco
```

No banco, a `local_key` é salva no campo `localKeyEnc` do modelo `Device`,
já criptografada com AES-256-GCM usando a `CASAI_ENCRYPTION_KEY`.

---

## Parte 4 — Checklist de validação (antes de construir o app)

- [ ] CLI tuyapi retornou id + key + ip da EWS 410
- [ ] spike tuya-test liga e desliga a lâmpada
- [ ] spike tapo-test lê a potência da tomada
- [ ] Confirmada a unidade de energia do P110 (Wh ou kWh)
- [ ] Confirmada a versão de protocolo Tuya que funciona (3.3 / 3.4 / 3.5)
- [ ] spike whisper-test transcreve pt-BR em tempo aceitável (< 2s)

Se todos os itens passarem, a arquitetura está validada e o build pode começar.
Se o item da local_key falhar repetidamente, **pare e reavalie** — talvez seja
necessário usar a Tuya Cloud API como fallback (o que muda a tese de "100% local").
