'use client';

import * as React from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

type State = 'idle' | 'recording' | 'processing';

/**
 * FAB de microfone: captura ~3s de áudio (MediaRecorder / Web Audio API) e envia
 * para POST /voice/command, onde o Whisper no hub transcreve e o intent é executado.
 */
export function VoiceFab({ className }: { className?: string }) {
  const [state, setState] = React.useState<State>('idle');
  const qc = useQueryClient();

  async function record(): Promise<void> {
    if (state !== 'idle') return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Permita o acesso ao microfone para usar comandos de voz.');
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState('processing');
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const res = await api.voiceCommandAudio(blob);
        if (res.executed) {
          toast.success(`"${res.transcript}" — executado`);
          void qc.invalidateQueries({ queryKey: ['devices'] });
        } else {
          toast.warning(
            `"${res.transcript}" — não entendi com certeza${
              res.suggestions?.length ? `. Tente: ${res.suggestions.join(', ')}` : ''
            }`,
          );
        }
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setState('idle');
      }
    };
    setState('recording');
    recorder.start();
    setTimeout(() => recorder.stop(), 3000); // 3s de captura
  }

  return (
    <Button
      size="fab"
      onClick={record}
      disabled={state === 'processing'}
      aria-label="Comando de voz"
      className={cn(
        'fixed bottom-6 right-6 z-50 shadow-lg',
        state === 'recording' && 'animate-pulse bg-destructive',
        className,
      )}
    >
      {state === 'processing' ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : (
        <Mic className="h-7 w-7" />
      )}
    </Button>
  );
}
