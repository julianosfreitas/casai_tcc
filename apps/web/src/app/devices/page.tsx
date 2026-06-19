'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lightbulb, Plug, Power, Radar, Trash2, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import type {
  CreateDevicePayload,
  Device,
  DeviceType,
  DiscoveredDevice,
  Protocol,
} from '@/lib/types';

const PROTOCOL_LABEL: Record<string, string> = {
  TUYA: 'Tuya / Intelbras',
  TUYA_CLOUD: 'Tuya Cloud',
  TAPO: 'TP-Link Tapo',
  HOME_ASSISTANT: 'Home Assistant',
  MOCK: 'Simulado (MOCK)',
};

const TYPE_LABEL: Record<DeviceType, string> = {
  LIGHT: 'Lâmpada',
  PLUG: 'Tomada',
  SWITCH: 'Interruptor',
  SENSOR: 'Sensor',
  OTHER: 'Outro',
};

/* Presets ao escolher o protocolo — espelham o hardware-alvo do TCC
   (Intelbras EWS 410 e Tapo P110), mas tudo pode ser ajustado no formulário. */
const PROTOCOL_PRESETS: Record<Protocol, Partial<FormState>> = {
  TUYA: { type: 'LIGHT', brightness: true, color: true, colorTemp: true, energy: false },
  TUYA_CLOUD: { type: 'LIGHT', brightness: true, color: true, colorTemp: true, energy: false },
  TAPO: { type: 'PLUG', brightness: false, color: false, colorTemp: false, energy: true },
  HOME_ASSISTANT: { type: 'LIGHT', brightness: true, color: true, colorTemp: true, energy: false },
  MOCK: { type: 'LIGHT', brightness: true, color: true, colorTemp: true, energy: false },
};

interface FormState {
  name: string;
  type: DeviceType;
  ip: string;
  externalId: string;
  localKey: string;
  protocolVersion: string;
  tapoEmail: string;
  tapoPass: string;
  brightness: boolean;
  color: boolean;
  colorTemp: boolean;
  energy: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'LIGHT',
  ip: '',
  externalId: '',
  localKey: '',
  protocolVersion: '3.3',
  tapoEmail: '',
  tapoPass: '',
  brightness: false,
  color: false,
  colorTemp: false,
  energy: false,
};

export default function DevicesPage() {
  const qc = useQueryClient();
  const [protocol, setProtocol] = React.useState<Protocol>('TUYA');
  const [form, setForm] = React.useState<FormState>({ ...EMPTY_FORM, ...PROTOCOL_PRESETS.TUYA });

  const devices = useQuery({ queryKey: ['devices'], queryFn: api.devices });

  const create = useMutation({
    mutationFn: (payload: CreateDevicePayload) => api.createDevice(payload),
    onSuccess: (d) => {
      toast.success(`"${d.name}" cadastrado`);
      setForm({ ...EMPTY_FORM, ...PROTOCOL_PRESETS[protocol] });
      void qc.invalidateQueries({ queryKey: ['devices'] });
      void qc.invalidateQueries({ queryKey: ['gamification'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDevice(id),
    onSuccess: () => {
      toast.success('Dispositivo removido');
      void qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const test = useMutation({
    // Leitura de estado (NÃO liga/desliga o aparelho) — só verifica se responde.
    mutationFn: (id: string) => api.testConnection(id),
    onSuccess: (state) => {
      toast.success(`Conexão OK — o dispositivo está ${state.on ? 'LIGADO' : 'DESLIGADO'}.`);
      void qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => {
      toast.error(
        `${e.message}. Verifique se está ligado, na mesma rede Wi-Fi 2.4GHz e com a local_key/credenciais corretas.`,
      );
      void qc.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const scan = useMutation({
    mutationFn: () => api.discoverDevices(),
    onError: (e) => toast.error(e.message),
  });

  function selectProtocol(p: Protocol) {
    setProtocol(p);
    setForm((f) => ({ ...f, ...PROTOCOL_PRESETS[p] }));
  }

  /** Pré-preenche o formulário com um candidato achado na varredura. */
  function applyDiscovered(d: DiscoveredDevice) {
    const p: Protocol = d.protocolGuess ?? 'TUYA';
    setProtocol(p);
    setForm({
      ...EMPTY_FORM,
      ...PROTOCOL_PRESETS[p],
      ip: d.ip,
      externalId: d.externalId ?? '',
      protocolVersion: d.protocolVersion ?? '3.3',
      name: p === 'TAPO' ? 'Tomada Tapo' : 'Lâmpada Intelbras',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (p === 'TAPO') {
      toast.info(`${d.ip} preenchido — falta o e-mail/senha da conta Tapo.`);
    } else {
      toast.info(
        `${d.ip} preenchido — falta a local_key. Não tem a chave? Troque para "Tuya Cloud" e controle pela nuvem.`,
      );
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: CreateDevicePayload = {
      name: form.name,
      type: form.type,
      protocol,
      supportsBrightness: form.brightness,
      supportsColor: form.color,
      supportsColorTemp: form.colorTemp,
      supportsEnergy: form.energy,
    };
    if (protocol === 'TUYA') {
      payload.ip = form.ip;
      payload.externalId = form.externalId;
      payload.localKey = form.localKey;
      payload.protocolVersion = form.protocolVersion;
    }
    if (protocol === 'TUYA_CLOUD') {
      // Cloud não usa IP nem local_key: as credenciais do projeto Tuya vivem no
      // env do servidor (TUYA_CLOUD_*). O device só informa o id da nuvem.
      payload.externalId = form.externalId;
    }
    if (protocol === 'HOME_ASSISTANT') {
      // entity_id da entidade HA; URL+token vivem no env do servidor (HOME_ASSISTANT_*).
      payload.externalId = form.externalId;
    }
    if (protocol === 'TAPO') {
      payload.ip = form.ip;
      payload.tapoEmail = form.tapoEmail;
      payload.tapoPass = form.tapoPass;
    }
    create.mutate(payload);
  }

  return (
    <AppShell title="Dispositivos" subtitle="Conecte aparelhos Tuya/Intelbras, Tapo ou simulados">
      {/* Descoberta automática na rede */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Procurar na rede</CardTitle>
              <CardDescription>
                Reconhece automaticamente aparelhos Tuya/Intelbras e Tapo na sua LAN.
              </CardDescription>
            </div>
            <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
              <Radar className={`mr-1 h-4 w-4 ${scan.isPending ? 'animate-spin' : ''}`} />
              {scan.isPending ? 'Procurando…' : 'Procurar dispositivos'}
            </Button>
          </div>
        </CardHeader>
        {scan.data && (
          <CardContent className="flex flex-col gap-2">
            {scan.data.found.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum dispositivo encontrado.</p>
            )}
            {scan.data.found.map((d) => (
              <div
                key={d.ip}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    d.protocolGuess === 'TAPO' ? 'bg-secondary' : 'bg-secondary'
                  }`}
                >
                  {d.protocolGuess === 'TAPO' ? (
                    <Plug className="h-4 w-4" />
                  ) : (
                    <Lightbulb className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {d.ip}
                    <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">
                      {d.protocolGuess ? PROTOCOL_LABEL[d.protocolGuess] : 'Desconhecido'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.vendor ?? 'Fabricante desconhecido'}
                    {d.externalId ? ` · id ${d.externalId}` : ''}
                    {d.openPorts.length ? ` · portas ${d.openPorts.join(', ')}` : ''}
                  </p>
                </div>
                {d.alreadyAdded ? (
                  <span className="text-xs text-muted-foreground">Já adicionado</span>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => applyDiscovered(d)}>
                    Usar
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{scan.data.hint}</p>
          </CardContent>
        )}
      </Card>

      {/* Cadastro guiado por protocolo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Adicionar dispositivo</CardTitle>
          <CardDescription>
            Escolha o protocolo — as credenciais ficam criptografadas no hub e nunca saem da sua
            rede.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="group"
            aria-label="Protocolo do dispositivo"
            className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5"
          >
            {(['TUYA', 'TUYA_CLOUD', 'TAPO', 'HOME_ASSISTANT', 'MOCK'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={protocol === p}
                onClick={() => selectProtocol(p)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  protocol === p
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                <span className="font-medium">
                  {PROTOCOL_LABEL[p]}
                  {protocol === p && <Check className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <span
                  className={`block text-xs ${
                    protocol === p ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {p === 'TUYA' && 'Ex.: lâmpada Intelbras EWS 410 (controle local)'}
                  {p === 'TUYA_CLOUD' && 'Lâmpada Tuya via nuvem (sem IP/local_key)'}
                  {p === 'TAPO' && 'Ex.: tomada Tapo P110 com medição de energia'}
                  {p === 'HOME_ASSISTANT' && 'Controla uma entidade de um Home Assistant existente'}
                  {p === 'MOCK' && 'Para testar o sistema sem hardware'}
                </span>
              </button>
            ))}
          </div>

          <ConnectGuide protocol={protocol} />

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <Input
                  placeholder="Ex.: Luz do quarto"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              </Field>
              <Field label="Tipo">
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.type}
                  onChange={(e) => set('type', e.target.value as DeviceType)}
                >
                  {(Object.keys(TYPE_LABEL) as DeviceType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {(protocol === 'TUYA' || protocol === 'TAPO') && (
              <Field label="IP na rede local">
                <Input
                  placeholder="Ex.: 192.168.0.50"
                  value={form.ip}
                  onChange={(e) => set('ip', e.target.value)}
                  required
                />
              </Field>
            )}

            {protocol === 'TUYA' && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Device ID (Tuya)">
                    <Input
                      placeholder="ID do dispositivo na plataforma Tuya"
                      value={form.externalId}
                      onChange={(e) => set('externalId', e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Versão do protocolo">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={form.protocolVersion}
                      onChange={(e) => set('protocolVersion', e.target.value)}
                    >
                      <option value="3.3">3.3</option>
                      <option value="3.4">3.4</option>
                      <option value="3.5">3.5</option>
                    </select>
                  </Field>
                </div>
                <Field label="Local key (será criptografada)">
                  <Input
                    type="password"
                    placeholder="local_key do dispositivo"
                    value={form.localKey}
                    onChange={(e) => set('localKey', e.target.value)}
                    required
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Como obter o Device ID e a local_key: veja docs/HARDWARE_SETUP.md no repositório.
                </p>
              </>
            )}

            {protocol === 'TUYA_CLOUD' && (
              <>
                <Field label="Device ID (Tuya Cloud)">
                  <Input
                    placeholder="ID do dispositivo no projeto Tuya Cloud"
                    value={form.externalId}
                    onChange={(e) => set('externalId', e.target.value)}
                    required
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Controle via nuvem: as credenciais do projeto (TUYA_CLOUD_*) ficam no servidor;
                  aqui informe só o id do dispositivo. Não precisa de IP nem de local_key. Após
                  salvar, use &quot;Testar conexão&quot; para confirmar.
                </p>
              </>
            )}

            {protocol === 'HOME_ASSISTANT' && (
              <>
                <Field label="Entity ID (Home Assistant)">
                  <Input
                    placeholder="Ex.: light.sala ou switch.tomada"
                    value={form.externalId}
                    onChange={(e) => set('externalId', e.target.value)}
                    required
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Controla uma entidade de um Home Assistant existente: a URL e o token (HOME_ASSISTANT_*)
                  ficam no servidor; aqui informe só o entity_id (em HA: Ferramentas do Desenvolvedor →
                  Estados). Não precisa de IP nem de local_key.
                </p>
              </>
            )}

            {protocol === 'TAPO' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="E-mail da conta Tapo">
                  <Input
                    type="email"
                    placeholder="conta do app Tapo"
                    value={form.tapoEmail}
                    onChange={(e) => set('tapoEmail', e.target.value)}
                    required
                  />
                </Field>
                <Field label="Senha Tapo (será criptografada)">
                  <Input
                    type="password"
                    placeholder="senha do app Tapo"
                    value={form.tapoPass}
                    onChange={(e) => set('tapoPass', e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}

            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-1 text-xs text-muted-foreground">Capacidades</legend>
              <p className="w-full text-xs text-muted-foreground">
                Já preenchemos conforme o aparelho escolhido — só altere se souber o que faz.
              </p>
              <Cap label="Brilho" checked={form.brightness} onChange={(v) => set('brightness', v)} />
              <Cap label="Cor RGB" checked={form.color} onChange={(v) => set('color', v)} />
              <Cap
                label="Temp. de cor"
                checked={form.colorTemp}
                onChange={(v) => set('colorTemp', v)}
              />
              <Cap label="Medição de energia" checked={form.energy} onChange={(v) => set('energy', v)} />
            </fieldset>

            <Button type="submit" disabled={create.isPending} className="sm:self-start">
              {create.isPending ? 'Cadastrando…' : 'Cadastrar dispositivo'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de dispositivos */}
      <section className="flex flex-col gap-3">
        {devices.isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {devices.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado ainda.</p>
        )}
        {!!devices.data?.length && (
          <p className="text-xs text-muted-foreground">
            Cinza = ainda não testado · Verde = respondeu (online) · Vermelho = não respondeu
            (offline). Use &quot;Testar conexão&quot; para verificar — não liga nem desliga o
            aparelho.
          </p>
        )}
        {devices.data?.map((d) => (
          <DeviceRow
            key={d.id}
            device={d}
            onTest={() => test.mutate(d.id)}
            testing={test.isPending && test.variables === d.id}
            onRemove={() => {
              if (window.confirm(`Remover "${d.name}"?`)) remove.mutate(d.id);
            }}
          />
        ))}
      </section>
    </AppShell>
  );
}

function DeviceRow({
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

function StatusBadge({ status }: { status: Device['status'] }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Cap({
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
const CONNECT_GUIDES: Record<
  Protocol,
  { steps: React.ReactNode[]; note?: React.ReactNode }
> = {
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

function ConnectGuide({ protocol }: { protocol: Protocol }) {
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
