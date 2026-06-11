'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Zap, Gauge, TrendingUp, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeToggle } from '@/components/mode-toggle';
import { DeviceWidget } from '@/components/device-widget';
import { EnergyChart } from '@/components/energy-chart';
import { VoiceFab } from '@/components/voice-fab';
import { api, getToken, clearTokens } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { formatBRL } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  const devices = useQuery({ queryKey: ['devices'], queryFn: api.devices, enabled: ready });
  const summary = useQuery({ queryKey: ['energy'], queryFn: api.energySummary, enabled: ready });

  const energyDevice = devices.data?.find((d) => d.supportsEnergy);
  const history = useQuery({
    queryKey: ['energy-history', energyDevice?.id],
    queryFn: () => api.energyHistory(energyDevice!.id, '24h', 'hour'),
    enabled: !!energyDevice,
  });

  // Tempo real: atualiza ao receber mudanças de estado/energia.
  React.useEffect(() => {
    if (!ready) return;
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
  }, [ready, qc]);

  function logout() {
    clearTokens();
    disconnectSocket();
    router.replace('/login');
  }

  if (!ready) return null;

  return (
    <main className="mx-auto min-h-dvh max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CASAI</h1>
          <p className="text-sm text-muted-foreground">Sua casa, no controle</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/devices">
              <Plug className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Dispositivos</span>
            </Link>
          </Button>
          <ModeToggle />
          <Button variant="outline" size="icon" onClick={logout} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Resumo de energia (bento) */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Gauge className="h-5 w-5" />} label="Agora" value={`${summary.data?.totalWatts ?? 0} W`} />
        <StatCard icon={<Zap className="h-5 w-5" />} label="Hoje" value={`${summary.data?.kwhToday ?? 0} kWh`} />
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

      <VoiceFab />
    </main>
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
