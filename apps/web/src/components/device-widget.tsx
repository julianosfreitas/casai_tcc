'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plug, Power, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Device } from '@/lib/types';

/** Fala a confirmação (TTS) — acessibilidade: confirmar por voz além de visual. */
function speak(text: string): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    window.speechSynthesis.speak(u);
  }
}

export function DeviceWidget({ device }: { device: Device }) {
  const qc = useQueryClient();
  const on = device.lastState?.on ?? false;
  const brightness = device.lastState?.brightness ?? 80;
  const offline = device.status === 'OFFLINE';

  const mutation = useMutation({
    mutationFn: (vars: { command: string; extra?: Record<string, unknown> }) =>
      api.command(device.id, vars.command, vars.extra ?? {}),
    onSuccess: (_state, vars) => {
      void qc.invalidateQueries({ queryKey: ['devices'] });
      if (vars.command === 'turnOn') speak(`${device.name} ligado`);
      if (vars.command === 'turnOff') speak(`${device.name} desligado`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const Icon = device.type === 'PLUG' ? Plug : Lightbulb;

  return (
    <Card className={cn('transition-opacity', offline && 'opacity-60')}>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-md',
                on ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">{device.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {offline ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                {offline ? 'Offline' : on ? 'Ligado' : 'Desligado'}
              </p>
            </div>
          </div>
          <Switch
            checked={on}
            disabled={offline || mutation.isPending}
            onCheckedChange={(checked) =>
              mutation.mutate({ command: checked ? 'turnOn' : 'turnOff' })
            }
            aria-label={`${on ? 'Desligar' : 'Ligar'} ${device.name}`}
          />
        </div>

        {device.supportsBrightness && on && (
          <div className="flex items-center gap-3">
            <Power className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Slider
              defaultValue={[brightness]}
              min={0}
              max={100}
              step={5}
              aria-label={`Brilho de ${device.name}`}
              onValueCommit={(v) =>
                mutation.mutate({ command: 'setBrightness', extra: { brightness: v[0] } })
              }
            />
            <span className="w-10 text-right text-sm tabular-nums">{brightness}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
