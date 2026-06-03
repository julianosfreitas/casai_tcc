import { Injectable } from '@nestjs/common';

/**
 * Fila serializada POR dispositivo. Comandos ao mesmo deviceId são processados
 * em série (nunca em paralelo) — um dispositivo Tuya aceita só UMA conexão local
 * por vez (CLAUDE.md / Passo 4). Comandos a dispositivos diferentes correm em paralelo.
 */
@Injectable()
export class DeviceCommandQueue {
  private readonly chains = new Map<string, Promise<unknown>>();

  enqueue<T>(deviceId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(deviceId) ?? Promise.resolve();
    // Encadeia após o anterior, ignorando a rejeição dele para não travar a fila.
    const next = previous.then(task, task);
    // O elo guardado nunca rejeita, senão um erro pararia toda a fila do dispositivo.
    this.chains.set(
      deviceId,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  /** Tamanho aproximado da fila (para diagnóstico/testes). */
  hasPending(deviceId: string): boolean {
    return this.chains.has(deviceId);
  }
}
