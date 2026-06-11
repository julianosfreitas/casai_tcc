'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, setTokens } from '@/lib/api';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('dev@casai.local');
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('Senha@123');
  const [loading, setLoading] = React.useState(false);

  /** Um toque para a banca: entra com o usuário de demonstração do seed. */
  async function demoSignIn() {
    setLoading(true);
    try {
      const tokens = await api.signIn('dev@casai.local', 'Senha@123');
      setTokens(tokens.accessToken, tokens.refreshToken);
      router.replace('/dashboard');
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  async function googleSignIn(idToken: string) {
    setLoading(true);
    try {
      const tokens = await api.googleSignIn(idToken);
      setTokens(tokens.accessToken, tokens.refreshToken);
      router.replace('/dashboard');
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const tokens =
        mode === 'signin'
          ? await api.signIn(email, password)
          : await api.signUp(email, name, password);
      setTokens(tokens.accessToken, tokens.refreshToken);
      router.replace('/dashboard');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Home className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">CASAI</CardTitle>
          <CardDescription>
            {mode === 'signin' ? 'Entre na sua casa inteligente' : 'Crie sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <Input
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-label="Nome"
              />
            )}
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="E-mail"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Senha"
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton onCredential={googleSignIn} />
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={demoSignIn}
            disabled={loading}
          >
            🚀 Entrar como demonstração
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === 'signin' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
