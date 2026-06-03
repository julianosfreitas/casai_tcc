---
name: device-adapter
description: Use este skill ao adicionar suporte a um novo protocolo ou dispositivo de automação residencial no CASAI (ex: novo dispositivo Tuya, Tapo, Zigbee, ou um novo fabricante). Garante que a integração siga o adapter pattern, que a API da biblioteca seja verificada na web antes de codar, e que exista uma implementação MOCK e testes.
---

# Skill: Adicionar um Device Adapter

Este skill define o procedimento obrigatório para integrar qualquer novo dispositivo
ou protocolo de automação residencial ao CASAI. Seguir estes passos na ordem.

## Passo 1 — Pesquisar a API atual (OBRIGATÓRIO, antes de codar)

As bibliotecas de IoT mudam de API entre versões e quebram em silêncio. Antes de
escrever qualquer linha:

1. Identifique a biblioteca npm a usar (ex: `tuyapi`, `tp-link-tapo-connect`,
   um cliente MQTT para Zigbee).
2. Pesquise na web e abra o README atual no npm e no GitHub. Confirme:
   - A versão mais recente e se está mantida.
   - Os métodos de conexão local (não de nuvem).
   - O formato de credenciais necessárias.
   - Como mapear comandos (on/off, brilho, cor, energia) para a API da lib.
   - Mudanças recentes de protocolo (ex: Tuya 3.3→3.4, Tapo PASSTHROUGH→KLAP).
3. Anote num comentário no topo do adapter qual versão da lib foi verificada e quando.

## Passo 2 — Implementar a interface DeviceAdapter

Toda integração implementa a interface comum. Nunca chame a lib fora do adapter.

```typescript
// src/devices/device-adapter.interface.ts
export interface DeviceState {
  on: boolean;
  brightness?: number;   // 0-100
  color?: string;        // hex
  colorTemp?: number;    // kelvin
}

export interface EnergyData {
  watts: number;
  kwhToday?: number;
  kwhMonth?: number;
}

export interface DeviceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  toggle(): Promise<void>;
  setBrightness(value: number): Promise<void>;
  setColor(hex: string): Promise<void>;
  setColorTemp(kelvin: number): Promise<void>;
  readState(): Promise<DeviceState>;
  readEnergy(): Promise<EnergyData | null>;
}
```

O novo adapter fica em `src/devices/adapters/<nome>.adapter.ts` e implementa
`DeviceAdapter`. Capacidades não suportadas devem lançar `NotImplementedException`
em vez de falhar silenciosamente (ex: TapoAdapter.setColor numa tomada).

## Passo 3 — Registrar na factory

```typescript
// src/devices/device-adapter.factory.ts
switch (device.protocol) {
  case 'TUYA': return new TuyaAdapter(device);
  case 'TAPO': return new TapoAdapter(device);
  case 'ZIGBEE': return new ZigbeeAdapter(device);  // novo
  case 'MOCK': return new MockAdapter(device);
  default: throw new Error(`Protocolo não suportado: ${device.protocol}`);
}
```

Adicione o novo valor ao enum `Protocol` no schema Prisma se necessário, e gere
a migration.

## Passo 4 — Implementação MOCK

Todo protocolo novo ganha um caminho no `MockAdapter` (ou um mock dedicado) que
simula o comportamento em memória, para desenvolvimento e testes sem hardware.

## Passo 5 — Tratamento de erros e estado

- Timeout de conexão → marcar o dispositivo como OFFLINE e lançar
  `DeviceOfflineError`.
- Toda operação bem-sucedida atualiza `lastSeen` e `lastState` no banco.
- Mudanças de estado fazem broadcast via WebSocket (`device:status_changed`).

## Passo 6 — Segurança

- Credenciais sensíveis (local_key) são criptografadas no banco e descriptografadas
  só em memória, no momento do uso. Nunca logar.

## Passo 7 — Testes

- Escreva testes do novo adapter usando mocks da biblioteca (não hardware real).
- Verifique: connect/disconnect, cada comando, leitura de estado, e o caminho de erro
  (dispositivo offline).
- Os testes devem rodar no CI sem hardware.

## Passo 8 — Validação manual com hardware

Antes de considerar pronto, valide com o dispositivo físico via um spike em `spikes/`
e registre o resultado. Atualize o `HARDWARE_SETUP.md` com qualquer armadilha nova
descoberta.

## Checklist de conclusão

- [ ] API da lib verificada na web e versão anotada no código
- [ ] Adapter implementa toda a interface DeviceAdapter
- [ ] Registrado na factory + enum Protocol atualizado
- [ ] Caminho MOCK existe
- [ ] Erros tratados (offline, timeout, capacidade não suportada)
- [ ] Credenciais criptografadas, nunca logadas
- [ ] Testes passando no CI sem hardware
- [ ] Validado com hardware real e HARDWARE_SETUP.md atualizado
