'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './socket';

/**
 * Mantém a lista de dispositivos (`['devices']`) sincronizada em tempo real via
 * WebSocket: cadastro (`device:created`), remoção (`device:removed`), mudança de
 * estado (`device:status_changed`) e offline (`device:offline`) invalidam a query,
 * então qualquer dispositivo recém-conectado aparece na hora — sem reload.
 */
export function useDeviceSync(): void {
  const qc = useQueryClient();
  React.useEffect(() => {
    const socket = getSocket();
    const refresh = () => void qc.invalidateQueries({ queryKey: ['devices'] });
    const events = [
      'device:created',
      'device:removed',
      'device:status_changed',
      'device:offline',
    ] as const;
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [qc]);
}
