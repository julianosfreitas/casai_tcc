'use client';

import * as React from 'react';
import Script from 'next/script';
import { useTheme } from 'next-themes';

/* Tipos mínimos do Google Identity Services (a lib é carregada via <script>,
   não tem pacote npm com tipos oficiais). */
interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_black' | 'filled_blue';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'continue_with';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Botão oficial "Entrar com o Google" (Google Identity Services).
 * Renderiza nada se NEXT_PUBLIC_GOOGLE_CLIENT_ID não estiver configurado —
 * assim o login local continua funcionando sem conta Google Cloud.
 */
export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = React.useState(false);
  const { resolvedTheme } = useTheme();

  // Mantém a referência mais recente do callback sem reinicializar o botão.
  const onCredentialRef = React.useRef(onCredential);
  onCredentialRef.current = onCredential;

  React.useEffect(() => {
    const google = window.google;
    if (!scriptReady || !google || !containerRef.current || !CLIENT_ID) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => onCredentialRef.current(response.credential),
    });
    containerRef.current.innerHTML = '';
    google.accounts.id.renderButton(containerRef.current, {
      theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      width: 320,
      locale: 'pt-BR',
    });
  }, [scriptReady, resolvedTheme]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
