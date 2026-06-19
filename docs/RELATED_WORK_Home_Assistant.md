# Trabalho Relacionado — Home Assistant e o problema de *commissioning* local-first

> Documento de apoio à monografia do CASAI. Expande a **ADR-001** (CLAUDE.md §2),
> que decidiu **não usar o Home Assistant como núcleo**. Aqui está a justificativa
> técnica, com fontes oficiais, de por que o HA **não resolve** o problema-alvo do
> CASAI (parear dispositivos Wi-Fi de fábrica sem o app do fabricante) e do que o
> CASAI legitimamente toma emprestado dele.

**Data:** 2026-06-19
**Método:** análise multi-fonte das integrações oficiais do HA (Tuya, TP-Link/Tapo,
Matter, Improv-via-BLE), da WebSocket API e da arquitetura do HA, do LocalTuya e do
GPL Code Center da TP-Link, com **verificação adversarial** de cada afirmação contra
a documentação citada (cada citação foi reconferida na fonte antes de entrar aqui).

---

## 1. A distinção que decide tudo: CONTROLE ≠ PAREAMENTO

- **Controle** (dispositivo já na Wi-Fi → liga/desliga/estado): o HA é forte e amplo.
- **Pareamento / *commissioning*** (dispositivo de fábrica → entra na Wi-Fi + recebe
  uma credencial de controle, **sem o app do fabricante**): é exatamente o problema
  que o CASAI ataca — e o HA **não** o resolve para Tuya/Tapo Wi-Fi proprietários.

**Veredito:** o Home Assistant **não** resolve o problema de pareamento do CASAI.

### Onde o HA comissiona nativamente — e por que não se aplica ao hardware-alvo

- **Matter:** comissiona empurrando credenciais Wi-Fi/Thread por BLE, mas usando o
  rádio Bluetooth **do celular** (app Companion), não o do servidor HA —
  *"Although your Home Assistant server might have a Bluetooth adapter on board that
  the controller can use to commission devices, Home Assistant does not use that
  adapter."* — e exige QR/código impresso (*"Without this information, commissioning
  won't be possible"*). Dispositivos Thread ainda exigem um Thread Border Router.
- **Improv via BLE:** provisiona Wi-Fi por BLE, mas é **gated por firmware** — só
  funciona com dispositivos que embarcam o firmware aberto Improv (ex.: ESP32/ESPHome)
  e exige o rádio Bluetooth **do próprio HA**.

A lâmpada **Intelbras EWS 410** (Tuya SmartConfig/AP) e a tomada **TP-Link Tapo P110**
(BLE proprietário no setup, depois Wi-Fi 2.4GHz 802.11b/g/n) **não implementam nem
Matter nem Improv** → nenhum caminho nativo de *commissioning* do HA os alcança.

---

## 2. O que o HA ainda EXIGE — por integração

| Integração | Pareia device de fábrica na Wi-Fi? | App do fabricante? | Conta na nuvem? | Credencial extra |
|---|---|---|---|---|
| **HA Tuya** | Não | **Sim, obrigatório** | **Sim (Tuya cloud)** | *User Code* + QR scaneado dentro do Smart Life |
| **HA TP-Link (Tapo)** | Não | Sim (ou CLI python-kasa, instável p/ P110) | **Sim (TP-Link cloud)** | usuário/senha TP-Link p/ acesso local |
| **LocalTuya** | Não | Sim (pré-requisito) | Opcional em runtime; `local_key` vem da nuvem | `local_key` por dispositivo |

### HA Tuya — integração de **controle via nuvem**, não de provisionamento
- *"You need to have the Tuya Smart or Smart Life app installed, with an account
  created and at least one device added to that account."*
- *"After adding new devices to your Tuya account through the Smart Life or Tuya Smart
  app, you need to reload the Tuya integration in Home Assistant for the new devices
  to appear."* (decisivo: o pareamento Wi-Fi/nuvem acontece no app; o HA só recarrega.)
- Roda sobre o SDK de nuvem `tuya-device-sharing-sdk` — dependência de controle em
  nuvem, não um stack de provisionamento local.

### HA TP-Link (Tapo P110) — provisionamento é pré-requisito **fora** da integração
- *"You need to provision your newly purchased device to connect to your network
  before it can be added via the integration. This can be done either by using kasa
  command-line tool ... or by adding it to the official Kasa or Tapo app before trying
  to add them to Home Assistant."*
- O *config flow* só recebe Host + Username + Password e conecta a um device **já na
  rede**; para Tapo/Kasa novos a credencial de nuvem TP-Link é obrigatória —
  *"it will require your TP-Link cloud username and password to authenticate for local
  access."*
- Controle é **local** — *"The integration connects locally to the devices without
  going via the TP-Link cloud."*
- O caminho sem-app via CLI (`kasa wifi scan` / `kasa wifi join`, **não** existe um
  comando `provision`) é documentado como **instável para Tapo SMART novos** — issues
  abertas python-kasa #1359, #1325 e #852 (erro ao conectar o P110 à Wi-Fi). Não é
  escape confiável.

### LocalTuya — controle local sem nuvem em runtime, mas não comissiona
- *"The Cloud API account configuration is not mandatory (LocalTuya can work also
  without it) ... Cloud API calls are performed only at startup, and when a local_key
  update is needed."*
- Ainda exige a **`local_key`** por dispositivo, **gerada pela nuvem Tuya no
  pareamento**; e **não** faz provisionamento Wi-Fi — só descobre/controla devices
  **já pareados** pelo app: *"you cannot access a device that has not been paired"*
  (fonte canônica: TinyTuya).

### Confirmação independente de que o gap continua aberto
- python-kasa #565: *"It is unknown if offline onboarding is possible with Tapo
  devices, so initial setup needs to be done currently using the official mobile app."*
- O **TP-Link GPL Code Center não expõe** o protocolo de setup BLE/app do Tapo —
  releases GPL contêm apenas código de terceiros (kernel, u-boot, busybox), sem o
  firmware proprietário de pareamento.
- Usar o HA via **WebSocket API** não muda nada: é canal de controle/estado
  (*"stream information from a Home Assistant instance to any client that implements
  WebSockets"*) — **não há comando para colocar um device de fábrica na Wi-Fi.**

---

## 3. Reconciliação com a ADR-001

Adotar o HA como **núcleo** (embutindo o HA Core, ou virando uma casca de UI sobre a
WebSocket API) **inverteria a tese**: o HA passaria a ser a contribuição e o CASAI um
*shell*. E, decisivamente, **nem resolveria** o problema-alvo, porque as próprias
integrações Tuya/TP-Link do HA **pressupõem o app do fabricante** para o pareamento.
Ou seja, a premissa da ADR-001 — *o gap de commissioning local-first é real e
não-resolvido* — sai **confirmada** pela investigação.

### O que o CASAI PODE tomar emprestado do HA (como *related work*, sem virar HA)

1. **Adapter / integration model:** o padrão de "integration" do HA (cada protocolo
   isolado atrás de uma interface comum, com *config flow*) valida o *adapter pattern*
   já adotado pelo CASAI. Citar como *prior art* de arquitetura.
2. **Design da WebSocket API:** o esquema de comandos do HA (`subscribe_events`,
   `call_service`, `get_states`, *streaming* de estado) é referência madura para o
   canal tempo-real (Socket.IO) do PWA do CASAI.
3. **Separação CONTROLE vs COMMISSIONING:** o próprio HA demonstra essa fronteira
   (controle amplo via integrações; *commissioning* só via padrões abertos
   Matter/Improv). Usar isso para **posicionar a contribuição do CASAI exatamente no
   gap** que o HA deixa aberto.
4. **Reuso de bibliotecas de controle:** python-kasa (KLAP), tuya-device-sharing-sdk e
   TinyTuya são *reverse-engineering* de **controle** já consolidado — o CASAI reusa
   bibliotecas equivalentes (`tp-link-tapo-connect`, `tuyapi`, `@tuya/tuya-connector`)
   na camada de controle e concentra a contribuição no **pareamento local-first**.

**A fronteira a não cruzar:** usar o HA como orquestrador/núcleo de runtime — isso
esvazia a tese.

---

## 4. Bottom line + recomendação

**Bottom line:** o Home Assistant entrega amplitude de **controle** (inclusive local,
pós-onboarding), mas **não comissiona** Tuya/Tapo Wi-Fi de fábrica sem o app do
fabricante — o gap "device de fábrica → Wi-Fi + credencial" continua aberto e é
justamente a contribuição do CASAI.

**Recomendação:** manter a **ADR-001**. HA fica como *trabalho relacionado* no TCC,
citado para (a) validar o *adapter/integration model* e o design da WebSocket API, e
(b) provar, com documentação oficial, que **mesmo o HA terceiriza o commissioning para
o app do fabricante**. Posicionar o hub de pareamento local-first do CASAI explicitamente
como o fechamento desse gap.

---

## Referências

- HA — Tuya integration: https://www.home-assistant.io/integrations/tuya/
- HA — TP-Link Smart Home (Kasa/Tapo): https://www.home-assistant.io/integrations/tplink/
- HA — Matter integration (commissioning por BLE): https://www.home-assistant.io/integrations/matter/
- HA — Improv via BLE: https://www.home-assistant.io/integrations/improv_ble/
- HA — WebSocket API (dev docs): https://developers.home-assistant.io/docs/api/websocket/
- HA — Architecture overview (dev docs): https://developers.home-assistant.io/docs/architecture_index/
- LocalTuya (HA): https://github.com/rospogrigio/localtuya
- TinyTuya (origem da `local_key` / pareamento): https://github.com/jasonacox/tinytuya
- python-kasa #565 (onboarding offline do Tapo desconhecido): https://github.com/python-kasa/python-kasa/issues/565
- python-kasa #1359 / #1325 / #852 (Wi-Fi join instável p/ Tapo novo):
  https://github.com/python-kasa/python-kasa/issues/1359 ·
  https://github.com/python-kasa/python-kasa/issues/1325 ·
  https://github.com/python-kasa/python-kasa/issues/852
- TP-Link GPL Code Center: https://www.tp-link.com/us/support/gpl-code/
- TP-Link Tapo P110 — especificações (Wi-Fi 2.4GHz; BLE só no setup):
  https://www.tp-link.com/br/home-networking/smart-plug/tapo-p110/#specifications
