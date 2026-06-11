'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  Plug,
  Layers,
  Cpu,
  Clock,
  Sparkles,
  Wand2,
  Mic,
  MessageCircle,
  Zap,
  Sunrise,
  Moon,
  Lock,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';

/** Ícones que o backend referencia por nome (gamification.service). */
const ICONS: Record<string, LucideIcon> = {
  home: Home,
  plug: Plug,
  layers: Layers,
  cpu: Cpu,
  clock: Clock,
  sparkles: Sparkles,
  wand: Wand2,
  mic: Mic,
  'message-circle': MessageCircle,
  zap: Zap,
  sunrise: Sunrise,
  moon: Moon,
};

export default function AchievementsPage() {
  const game = useQuery({ queryKey: ['gamification'], queryFn: api.gamification });
  const data = game.data;

  return (
    <AppShell title="Conquistas" subtitle="Sua jornada na automação">
      {data && (
        <>
          {/* Nível e progresso */}
          <Card className="mb-6">
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-chart-2/15">
                  <Trophy className="h-7 w-7 text-chart-2" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Nível {data.level.index + 1}</p>
                  <p className="truncate text-xl font-bold">{data.level.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">{data.points}</p>
                  <p className="text-xs text-muted-foreground">pontos</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-2 transition-all"
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {data.level.nextAt
                  ? `Faltam ${data.level.nextAt - data.points} pts para o próximo nível`
                  : 'Nível máximo — a casa é sua! 👑'}
              </p>
            </CardContent>
          </Card>

          {/* Como ganhar pontos */}
          <section className="mb-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Dispositivos" value={data.stats.devices} />
            <Stat label="Reais (Tuya/Tapo)" value={data.stats.realDevices} />
            <Stat label="Rotinas" value={data.stats.automations} />
            <Stat label="Cenas" value={data.stats.scenes} />
            <Stat label="Comandos de voz" value={data.stats.voiceOk} />
            <Stat label="Leituras de energia" value={data.stats.energyReadings} />
          </section>

          {/* Grade de conquistas */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.achievements.map((a) => {
              const Icon = ICONS[a.icon] ?? Trophy;
              return (
                <Card key={a.id} className={a.unlocked ? '' : 'opacity-55'}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        a.unlocked ? 'bg-chart-2/15 text-chart-2' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {a.unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </>
      )}
      {game.isLoading && <p className="text-muted-foreground">Carregando…</p>}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-lg font-bold tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
