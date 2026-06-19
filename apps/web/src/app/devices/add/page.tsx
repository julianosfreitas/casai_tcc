'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Lightbulb, Plug, Radar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import type { CreateDevicePayload, DeviceType, DiscoveredDevice, Protocol } from '@/lib/types';
import { ConnectGuide, Cap, Field, PROTOCOL_LABEL, TYPE_LABEL } from '../_shared';

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

export default function AddDevicePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [protocol, setProtocol] = React.useState<Protocol>('TUYA');
  const [form, setForm] = React.useState<FormState>({ ...EMPTY_FORM, ...PROTOCOL_PRESETS.TUYA });

  const create = useMutation({
    mutationFn: (payload: CreateDevicePayload) => api.createDevice(payload),
    onSuccess: (d) => {
      toast.success(`"${d.name}" cadastrado`);
      void qc.invalidateQueries({ queryKey: ['devices'] });
      void qc.invalidateQueries({ queryKey: ['gamification'] });
      router.push('/devices'); // volta para a lista de ativos
    },
    onError: (e) => toast.error(e.message),
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
    <AppShell title="Adicionar dispositivo" subtitle="Conecte aparelhos Tuya/Intelbras, Tapo, Home Assistant ou simulados">
      <Link
        href="/devices"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para meus dispositivos
      </Link>

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
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
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
              <Cap
                label="Medição de energia"
                checked={form.energy}
                onChange={(v) => set('energy', v)}
              />
            </fieldset>

            <Button type="submit" disabled={create.isPending} className="sm:self-start">
              {create.isPending ? 'Cadastrando…' : 'Cadastrar dispositivo'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
