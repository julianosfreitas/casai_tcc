'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Play, Plus, Trash2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import type { Automation, AutomationAction, Device, Scene } from '@/lib/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

const COMMAND_LABEL: Record<string, string> = {
  turnOn: 'Ligar',
  turnOff: 'Desligar',
  toggle: 'Alternar',
  setBrightness: 'Brilho',
};

/** "Seg–Sex às 07:00" — resumo humano do gatilho, nunca cron cru. */
function triggerSummary(a: Automation): string {
  const t = a.triggerConfig;
  if (a.triggerType === 'MANUAL') return 'Execução manual';
  const days =
    !t.weekdays || t.weekdays.length === 0 || t.weekdays.length === 7
      ? 'Todos os dias'
      : t.weekdays.length === 5 && !t.weekdays.includes(0) && !t.weekdays.includes(6)
        ? 'Seg–Sex'
        : t.weekdays.length === 2 && t.weekdays.includes(0) && t.weekdays.includes(6)
          ? 'Fim de semana'
          : t.weekdays.map((d) => WEEKDAYS[d]).join(', ');
  return t.time ? `${days} às ${t.time}` : (t.cron ?? days);
}

interface DraftAction {
  deviceId: string;
  command: string;
  brightness: number;
  delaySeconds: number;
}

export default function AutomationsPage() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ['devices'], queryFn: api.devices });
  const automations = useQuery({ queryKey: ['automations'], queryFn: api.automations });
  const scenes = useQuery({ queryKey: ['scenes'], queryFn: api.scenes });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['automations'] });
    void qc.invalidateQueries({ queryKey: ['scenes'] });
    void qc.invalidateQueries({ queryKey: ['gamification'] });
  };

  return (
    <AppShell title="Rotinas" subtitle="Sua casa no piloto automático">
      <NewAutomationForm devices={devices.data ?? []} onCreated={invalidate} />

      <section className="mb-8 flex flex-col gap-3">
        {automations.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma rotina ainda — crie a primeira acima. ☝️
          </p>
        )}
        {automations.data?.map((a) => (
          <AutomationRow key={a.id} automation={a} onChanged={invalidate} />
        ))}
      </section>

      <h2 className="mb-1 text-lg font-semibold">Cenas</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Vários comandos em um toque — também aparecem no Início.
      </p>
      <NewSceneForm devices={devices.data ?? []} onCreated={invalidate} />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {scenes.data?.map((s) => (
          <SceneRow key={s.id} scene={s} onChanged={invalidate} />
        ))}
      </section>
    </AppShell>
  );
}

/* ───────────────────────── Rotinas ───────────────────────── */

function AutomationRow({
  automation,
  onChanged,
}: {
  automation: Automation;
  onChanged: () => void;
}) {
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.updateAutomation(automation.id, { enabled }),
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: () => api.runAutomation(automation.id),
    onSuccess: () => toast.success(`"${automation.name}" executada agora`),
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAutomation(automation.id),
    onSuccess: () => {
      toast.success('Rotina removida');
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{automation.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {triggerSummary(automation)} · {automation.actions.length}{' '}
            {automation.actions.length === 1 ? 'ação' : 'ações'}
          </p>
        </div>
        <Switch
          checked={automation.enabled}
          onCheckedChange={(v) => toggle.mutate(v)}
          aria-label="Ativar rotina"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => run.mutate()}
          disabled={run.isPending}
        >
          <Play className="mr-1 h-4 w-4" />
          {run.isPending ? 'Executando…' : 'Executar'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Remover rotina"
          onClick={() => {
            if (window.confirm(`Remover "${automation.name}"?`)) remove.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function NewAutomationForm({
  devices,
  onCreated,
}: {
  devices: Device[];
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [time, setTime] = React.useState('07:00');
  const [weekdays, setWeekdays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [actions, setActions] = React.useState<DraftAction[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api.createAutomation({
        name,
        triggerType: 'SCHEDULE',
        triggerConfig: { time, weekdays: weekdays.length === 7 ? undefined : weekdays },
        actions: actions.map(toApiAction),
      }),
    onSuccess: () => {
      toast.success(`Rotina "${name}" criada 🎉`);
      setName('');
      setActions([]);
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button className="mb-4" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Nova rotina
      </Button>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Nova rotina</CardTitle>
        <CardDescription>Quando chegar o horário, o CASAI executa as ações em ordem.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (actions.length === 0) {
              toast.error('Adicione pelo menos uma ação');
              return;
            }
            create.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Nome</span>
              <Input
                placeholder="Ex.: ☕ Café da manhã"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Horário</span>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs text-muted-foreground">Dias da semana</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    weekdays.includes(i)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <ActionBuilder devices={devices} actions={actions} setActions={setActions} />

          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar rotina'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Cenas ───────────────────────── */

function SceneRow({ scene, onChanged }: { scene: Scene; onChanged: () => void }) {
  const activate = useMutation({
    mutationFn: () => api.activateScene(scene.id),
    onSuccess: () => toast.success(`Cena "${scene.name}" ativada`),
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteScene(scene.id),
    onSuccess: () => {
      toast.success('Cena removida');
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{scene.name}</p>
          <p className="text-xs text-muted-foreground">
            {scene.actions.length} {scene.actions.length === 1 ? 'ação' : 'ações'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => activate.mutate()}
          disabled={activate.isPending}
        >
          <Play className="mr-1 h-4 w-4 text-chart-2" />
          Ativar
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Remover cena"
          onClick={() => {
            if (window.confirm(`Remover "${scene.name}"?`)) remove.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function NewSceneForm({ devices, onCreated }: { devices: Device[]; onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [actions, setActions] = React.useState<DraftAction[]>([]);

  const create = useMutation({
    mutationFn: () => api.createScene({ name, actions: actions.map(toApiAction) }),
    onSuccess: () => {
      toast.success(`Cena "${name}" criada 🎉`);
      setName('');
      setActions([]);
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="outline" className="mb-4" onClick={() => setOpen(true)}>
        <Wand2 className="mr-1 h-4 w-4" />
        Nova cena
      </Button>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Nova cena</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (actions.length === 0) {
              toast.error('Adicione pelo menos uma ação');
              return;
            }
            create.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Nome</span>
            <Input
              placeholder="Ex.: 🎬 Modo cinema"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <ActionBuilder devices={devices} actions={actions} setActions={setActions} />
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar cena'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Construtor de ações ───────────────────────── */

function toApiAction(a: DraftAction): AutomationAction {
  return {
    deviceId: a.deviceId,
    command: a.command,
    ...(a.command === 'setBrightness' ? { brightness: a.brightness } : {}),
    ...(a.delaySeconds > 0 ? { delaySeconds: a.delaySeconds } : {}),
  };
}

function ActionBuilder({
  devices,
  actions,
  setActions,
}: {
  devices: Device[];
  actions: DraftAction[];
  setActions: React.Dispatch<React.SetStateAction<DraftAction[]>>;
}) {
  function add() {
    if (devices.length === 0) {
      toast.error('Cadastre um dispositivo primeiro');
      return;
    }
    setActions((a) => [
      ...a,
      { deviceId: devices[0].id, command: 'turnOn', brightness: 80, delaySeconds: 0 },
    ]);
  }

  function patch(i: number, p: Partial<DraftAction>) {
    setActions((a) => a.map((act, j) => (j === i ? { ...act, ...p } : act)));
  }

  const selectCls = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm';

  return (
    <div>
      <span className="mb-1.5 block text-xs text-muted-foreground">Ações (em ordem)</span>
      <div className="flex flex-col gap-2">
        {actions.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <span className="text-xs text-muted-foreground">{i + 1}.</span>
            <select
              className={`${selectCls} min-w-0 flex-1`}
              value={a.deviceId}
              onChange={(e) => patch(i, { deviceId: e.target.value })}
              aria-label="Dispositivo"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              value={a.command}
              onChange={(e) => patch(i, { command: e.target.value })}
              aria-label="Comando"
            >
              {Object.entries(COMMAND_LABEL).map(([cmd, label]) => (
                <option key={cmd} value={cmd}>
                  {label}
                </option>
              ))}
            </select>
            {a.command === 'setBrightness' && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={a.brightness}
                  onChange={(e) => patch(i, { brightness: Number(e.target.value) })}
                  className="h-9 w-16"
                  aria-label="Brilho"
                />
                %
              </label>
            )}
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              após
              <Input
                type="number"
                min={0}
                max={3600}
                value={a.delaySeconds}
                onChange={(e) => patch(i, { delaySeconds: Number(e.target.value) })}
                className="h-9 w-20"
                aria-label="Atraso em segundos"
              />
              s
            </label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remover ação"
              onClick={() => setActions((arr) => arr.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        Adicionar ação
      </Button>
    </div>
  );
}
