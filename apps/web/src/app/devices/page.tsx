'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plug, Power, Trash2, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import type { CreateDevicePayload, Device, DeviceType, Protocol } from '@/lib/types';

const PROTOCOL_LABEL: Record<string, string> = {
  TUYA: 'Tuya / Intelbras',
  TAPO: 'TP-Link Tapo',
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
  TAPO: { type: 'PLUG', brightness: false, color: false, colorTemp: false, energy: true },
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
    mutationFn: (id: string) => api.command(id, 'toggle'),
    onSuccess: (state) => {
      toast.success(`Conexão OK — dispositivo respondeu ${state.on ? 'LIGADO' : 'DESLIGADO'}`);
      void qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  function selectProtocol(p: Protocol) {
    setProtocol(p);
    setForm((f) => ({ ...f, ...PROTOCOL_PRESETS[p] }));
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
    if (protocol === 'TAPO') {
      payload.ip = form.ip;
      payload.tapoEmail = form.tapoEmail;
      payload.tapoPass = form.tapoPass;
    }
    create.mutate(payload);
  }

  return (
    <AppShell title="Dispositivos" subtitle="Conecte aparelhos Tuya/Intelbras, Tapo ou simulados">
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
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['TUYA', 'TAPO', 'MOCK'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectProtocol(p)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  protocol === p
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                <span className="font-medium">{PROTOCOL_LABEL[p]}</span>
                <span
                  className={`block text-xs ${
                    protocol === p ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {p === 'TUYA' && 'Ex.: lâmpada Intelbras EWS 410 (controle local)'}
                  {p === 'TAPO' && 'Ex.: tomada Tapo P110 com medição de energia'}
                  {p === 'MOCK' && 'Para testar o sistema sem hardware'}
                </span>
              </button>
            ))}
          </div>

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

            {protocol !== 'MOCK' && (
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
