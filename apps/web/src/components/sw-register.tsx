'use client';

import * as React from 'react';

/** Registra o service worker (PWA) no cliente, em produção. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Em desenvolvimento o SW cacheia chunks do Next e serve versões velhas após
    // rebuild (erro "Cannot read properties of undefined (reading 'call')").
    // Por isso só registra em produção — e remove qualquer SW ativo em dev.
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
  }, []);
  return null;
}
