'use client';

/* Componentes e mapas compartilhados entre a página de dispositivos ATIVOS
   (`/devices`) e a página de CONEXÃO/adicionar (`/devices/add`). Mantido aqui
   para zero duplicação após a separação das abas. */
import * as React from 'react';
import { Lightbulb, Plug, Power, Trash2, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Device, DeviceType, Protocol } from '@/lib/types';

export const PROTOCOL_LABEL: Record<string, string> = {
  TUYA: 'Tuya / Intelbras',
  TUYA_CLOUD: 'Tuya Cloud',
  TAPO: 'TP-Link Tapo',
  HOME_ASSISTANT: 'Home Assistant',
  MOCK: 'Simulado (MOCK)',
};

export const TYPE_LABEL: Record<DeviceType, string> = {
  LIGHT: 'Lâmpada',
  PLUG: 'Tomada',
  SWITCH: 'Interruptor',
  SENSOR: 'Sensor',
  OTHER: 'Outro',
};

export function DeviceRow({
  device,
  onTest,
  testing,
  onRemove,
}: {
  device: Device;
  onTest: () => void;
  testing: boolean;
  onRemove: () => void;
}) {
  const Icon = device.type === 'PLUG' ? Plug : Lightbulb;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{device.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="rounded bg-secondary px-1.5 py-0.5">
              {PROTOCOL_LABEL[device.protocol] ?? device.protocol}
            </span>
            <span>{TYPE_LABEL[device.type]}</span>
            {device.ip && (
              <span className="inline-flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {device.ip}
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={device.status} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            <Power className="mr-1 h-4 w-4" />
            {testing ? 'Testando…' : 'Testar conexão'}
          </Button>
          <Button variant="outline" size="icon" onClick={onRemove} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: Device['status'] }) {
  const map = {
    ONLINE: { dot: 'bg-chart-2', label: 'Online' },
    OFFLINE: { dot: 'bg-destructive', label: 'Offline' },
    UNKNOWN: { dot: 'bg-muted-foreground', label: 'Não testado' },
  } as const;
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Cap({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

/* Passo a passo de conexão por protocolo. Texto conciso, sem jargão não explicado,
   para uma família brasileira não-técnica. Painel <details> nativo (sem dependência). */
const CONNECT_GUIDES: Record<Protocol, { steps: React.ReactNode[]; note?: React.ReactNode }> = {
  TUYA: {
    steps: [
      'Instale o app Tuya Smart (ou Intelbras Izy) e pareie a lâmpada na rede Wi-Fi de 2.4GHz — a de 5GHz não funciona.',
      'Garanta que o hub CASAI e a lâmpada estão na MESMA rede 2.4GHz.',
      'Clique em “Procurar dispositivos” acima para preencher IP e Device ID automaticamente.',
      'Pegue a local_key: o jeito mais fácil é a ferramenta tuya-cli (npm i -g @tuyapi/cli e depois tuya-cli wizard), que lista id, chave e IP. Detalhes em docs/HARDWARE_SETUP.md.',
      'Cole IP, Device ID, versão (geralmente 3.3; se falhar tente 3.4) e a local_key abaixo.',
    ],
  },
  TUYA_CLOUD: {
    steps: [
      'Crie ou abra um projeto em iot.tuya.com.',
      'Vincule a conta do app Tuya/Izy ao projeto (Devices → Link Tuya App Account).',
      'Em Devices, copie o “Device ID” da lâmpada.',
      'Peça ao responsável pelo hub para configurar as variáveis TUYA_CLOUD_* no servidor.',
      'Cole só o Device ID abaixo — não precisa de IP nem de local_key.',
    ],
    note: 'Pela nuvem, o status pode levar 1–2s para atualizar.',
  },
  TAPO: {
    steps: [
      'Instale o app TP-Link Tapo e crie uma conta TP-Link (guarde e-mail e senha — serão usados aqui).',
      'Ligue a tomada P110, aguarde o LED piscar laranja e verde, e siga o app (botão + → Tomadas → P110) para conectá-la à Wi-Fi de 2.4GHz.',
      'Veja o IP no app Tapo (dispositivo → engrenagem → Informações do dispositivo) ou no roteador; de preferência, fixe o IP no roteador.',
      'Cole o IP e o MESMO e-mail/senha da conta TP-Link abaixo.',
    ],
    note: (
      <>
        O firmware novo (KLAP) exige a conta TP-Link mesmo no controle local, e a tomada pode não
        aparecer em “Procurar dispositivos” — nesse caso cadastre pelo IP. Guia oficial:{' '}
        <a
          href="https://www.tp-link.com/br/support/faq/2846/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Como configurar a tomada Tapo
        </a>
        .
      </>
    ),
  },
  HOME_ASSISTANT: {
    steps: [
      'Tenha uma instância Home Assistant rodando na sua rede, com o dispositivo já adicionado nela.',
      'No HA, crie um token: perfil → “Tokens de Acesso de Longa Duração” → Criar Token. Guarde-o.',
      'Peça ao responsável pelo hub para configurar HOME_ASSISTANT_BASE_URL e HOME_ASSISTANT_TOKEN no servidor.',
      'Descubra o entity_id em HA → Ferramentas do Desenvolvedor → Estados (ex.: light.sala, switch.tomada).',
      'Cole só o entity_id abaixo. Não precisa de IP nem de local_key.',
    ],
    note: 'O CASAI controla a entidade através do HA; o pareamento dos aparelhos continua sendo feito no próprio HA.',
  },
  MOCK: {
    steps: [
      'Não precisa de hardware nem de credenciais.',
      'Escolha um nome e clique em “Cadastrar dispositivo” para testar o sistema.',
    ],
  },
};

export function ConnectGuide({ protocol }: { protocol: Protocol }) {
  const guide = CONNECT_GUIDES[protocol];
  return (
    <details className="mb-4 rounded-lg border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Como conectar — {PROTOCOL_LABEL[protocol]}
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        {guide.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {guide.note && <p className="mt-2 text-xs text-muted-foreground">{guide.note}</p>}
    </details>
  );
}
