'use client';

import * as React from 'react';

/** Registra o service worker (PWA) no cliente, em produção. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}
