'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import { DeviceRow } from './_shared';

export default function DevicesPage() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ['devices'], queryFn: api.devices });

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

  const isEmpty = devices.data?.length === 0;

  return (
    <AppShell title="Dispositivos" subtitle="Seus aparelhos conectados">
      <div className="mb-4 flex justify-end">
        <Button asChild>
          <Link href="/devices/add">
            <Plus className="mr-1 h-4 w-4" />
            Adicionar dispositivo
          </Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        {devices.isLoading && <p className="text-muted-foreground">Carregando…</p>}

        {isEmpty && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado ainda.</p>
            <Button asChild className="mt-3">
              <Link href="/devices/add">
                <Plus className="mr-1 h-4 w-4" />
                Conectar meu primeiro dispositivo
              </Link>
            </Button>
          </div>
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
