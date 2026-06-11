'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Home, Sparkles, Plug, Trophy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { VoiceFab } from '@/components/voice-fab';
import { api, getToken, clearTokens } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/automations', label: 'Rotinas', icon: Sparkles },
  { href: '/devices', label: 'Dispositivos', icon: Plug },
  { href: '/achievements', label: 'Conquistas', icon: Trophy },
] as const;

/**
 * Shell autenticado: sidebar no desktop, tabs fixas no rodapé no celular (PWA).
 * Inclui guarda de token, FAB de voz global e chip de nível (gamificação).
 */
export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  const game = useQuery({ queryKey: ['gamification'], queryFn: api.gamification, enabled: ready });

  function logout() {
    clearTokens();
    disconnectSocket();
    router.replace('/login');
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-56 flex-col border-r bg-sidebar p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">CASAI</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        {game.data && (
          <Link
            href="/achievements"
            className="mb-3 rounded-lg border bg-card p-3 text-xs hover:bg-accent"
          >
            <p className="font-medium">{game.data.level.name}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-2 transition-all"
                style={{ width: `${game.data.progress}%` }}
              />
            </div>
            <p className="mt-1 text-muted-foreground">{game.data.points} pts</p>
          </Link>
        )}
        <div className="flex items-center justify-between">
          <ModeToggle />
          <Button variant="outline" size="icon" onClick={logout} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 p-4 sm:p-6 sm:pb-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {game.data && (
              <Link
                href="/achievements"
                className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs sm:inline-flex md:hidden"
              >
                <Trophy className="h-3.5 w-3.5 text-chart-2" />
                {game.data.points} pts
              </Link>
            )}
            <div className="md:hidden">
              <ModeToggle />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={logout}
              aria-label="Sair"
              className="md:hidden"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Conteúdo — espaço extra embaixo para as tabs do celular */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 sm:px-6 md:pb-10">
          {children}
        </main>
      </div>

      {/* Tabs — celular (PWA na palma da mão) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/95 py-1.5 backdrop-blur md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px]',
              pathname === href ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('h-5 w-5', pathname === href && 'text-chart-2')} />
            {label}
          </Link>
        ))}
      </nav>

      {/* FAB de voz global — acima das tabs no celular */}
      <VoiceFab className="bottom-20 md:bottom-6" />
    </div>
  );
}
