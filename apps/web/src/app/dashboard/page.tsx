'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap, Gauge, TrendingUp, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import { DeviceWidget } from '@/components/device-widget';
import { EnergyChart } from '@/components/energy-chart';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { formatBRL } from '@/lib/utils';

export default function DashboardPage() {
  const qc = useQueryClient();

  const devices = useQuery({ queryKey: ['devices'], queryFn: api.devices });
  const summary = useQuery({ queryKey: ['energy'], queryFn: api.energySummary });
  const scenes = useQuery({ queryKey: ['scenes'], queryFn: api.scenes });

  const energyDevice = devices.data?.find((d) => d.supportsEnergy);
  const history = useQuery({
    queryKey: ['energy-history', energyDevice?.id],
    queryFn: () => api.energyHistory(energyDevice!.id, '24h', 'hour'),
    enabled: !!energyDevice,
  });

  // Tempo real: atualiza ao receber mudanças de estado/energia.
  React.useEffect(() => {
    const socket = getSocket();
    const refresh = () => void qc.invalidateQueries({ queryKey: ['devices'] });
    socket.on('device:status_changed', refresh);
    socket.on('device:offline', refresh);
    socket.on('energy:reading', () => {
      void qc.invalidateQueries({ queryKey: ['energy'] });
      void qc.invalidateQueries({ queryKey: ['energy-history'] });
    });
    return () => {
      socket.off('device:status_changed', refresh);
      socket.off('device:offline', refresh);
      socket.off('energy:reading');
    };
  }, [qc]);

  async function activateScene(id: string, name: string) {
    try {
      await api.activateScene(id);
      toast.success(`Cena "${name}" ativada`);
      void qc.invalidateQueries({ queryKey: ['devices'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <AppShell title="CASAI" subtitle="Sua casa, no controle">
      {/* Cenas em um toque */}
      {scenes.data && scenes.data.length > 0 && (
        <section className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {scenes.data.map((s) => (
            <Button
              key={s.id}
              variant="outline"
              className="shrink-0"
              onClick={() => void activateScene(s.id, s.name)}
            >
              <Play className="mr-1.5 h-3.5 w-3.5 text-chart-2" />
              {s.name}
            </Button>
          ))}
        </section>
      )}

      {/* Resumo de energia (bento) */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Gauge className="h-5 w-5" />}
          label="Agora"
          value={`${summary.data?.totalWatts ?? 0} W`}
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Hoje"
          value={`${summary.data?.kwhToday ?? 0} kWh`}
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Custo hoje"
          value={formatBRL(summary.data?.costToday ?? 0)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Projeção mês"
          value={formatBRL(summary.data?.projectedMonthlyCost ?? 0)}
        />
      </section>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Consumo (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <EnergyChart buckets={history.data?.buckets ?? []} />
        </CardContent>
      </Card>

      {/* Bento grid de dispositivos */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {devices.isLoading && <p className="text-muted-foreground">Carregando dispositivos…</p>}
        {devices.data?.length === 0 && (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">
              Nenhum dispositivo ainda.{' '}
              <Link href="/devices" className="underline hover:text-foreground">
                Cadastre o primeiro aqui
              </Link>
              .
            </CardContent>
          </Card>
        )}
        {devices.data?.map((device) => (
          <DeviceWidget key={device.id} device={device} />
        ))}
      </section>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-5">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}
