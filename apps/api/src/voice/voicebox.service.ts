import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente do Voicebox (https://voicebox.sh) — estúdio de voz local-first que roda
 * na máquina do usuário e expõe uma REST API local. Usado para (1) síntese de voz
 * da assistente com vozes clonadas/preset e (2) transcrição (STT) alternativa.
 *
 * É OPCIONAL: se o app não estiver instalado/rodando (127.0.0.1:17493), os métodos
 * de status devolvem `available:false` e os de síntese lançam 503 — o chamador cai
 * de volta no TTS do navegador (pt-BR) e no Whisper do hub, sem regressão.
 *
 * Local-first: nada sai da máquina — alinhado à tese do CASAI.
 */
export interface VoiceboxProfile {
  id: string;
  name: string;
  description?: string | null;
  language?: string | null;
}

@Injectable()
export class VoiceboxService {
  private readonly logger = new Logger(VoiceboxService.name);
  private readonly baseUrl: string;
  private readonly defaultProfileId?: string;
  private readonly ttsLanguage: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('VOICEBOX_URL') ?? 'http://127.0.0.1:17493').replace(
      /\/$/,
      '',
    );
    this.defaultProfileId = this.config.get<string>('VOICEBOX_PROFILE_ID') || undefined;
    // /generate aceita apenas en|zh (engine Qwen3-TTS). pt-BR fica no fallback do navegador.
    this.ttsLanguage = this.config.get<string>('VOICEBOX_TTS_LANGUAGE') ?? 'en';
  }

  private async fetchWithTimeout(path: string, init: RequestInit, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Status para o front decidir mostrar o seletor de voz. NUNCA lança. */
  async status(): Promise<{ available: boolean; baseUrl: string; profiles: VoiceboxProfile[] }> {
    try {
      const health = await this.fetchWithTimeout('/health', { method: 'GET' }, 1500);
      if (!health.ok) return { available: false, baseUrl: this.baseUrl, profiles: [] };
      const profiles = await this.listProfiles().catch(() => []);
      return { available: true, baseUrl: this.baseUrl, profiles };
    } catch {
      return { available: false, baseUrl: this.baseUrl, profiles: [] };
    }
  }

  async listProfiles(): Promise<VoiceboxProfile[]> {
    const res = await this.fetchWithTimeout('/profiles', { method: 'GET' }, 3000);
    if (!res.ok) throw new Error(`GET /profiles ${res.status}`);
    const data = (await res.json()) as VoiceboxProfile[];
    return Array.isArray(data)
      ? data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          language: p.language ?? null,
        }))
      : [];
  }

  /**
   * Sintetiza `text` na voz `profileId` (ou padrão). Fluxo: POST /generate → id →
   * GET /audio/{id} (poll até o áudio ficar pronto). Lança 503 se indisponível.
   */
  async speak(
    text: string,
    profileId?: string,
    language?: string,
  ): Promise<{ audio: Buffer; contentType: string }> {
    const profile = profileId || this.defaultProfileId || (await this.firstProfileId());
    if (!profile) {
      throw new ServiceUnavailableException('Voicebox sem perfis de voz — crie uma voz no app.');
    }

    let genRes: Response;
    try {
      genRes = await this.fetchWithTimeout(
        '/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            profile_id: profile,
            language: language || this.ttsLanguage,
          }),
        },
        8000,
      );
    } catch (err) {
      this.logger.warn(`Voicebox indisponível: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Voicebox não está acessível (app rodando em 127.0.0.1:17493?).',
      );
    }
    if (!genRes.ok) {
      throw new ServiceUnavailableException(`Voicebox /generate falhou (${genRes.status}).`);
    }
    const gen = (await genRes.json()) as { id?: string; generation_id?: string };
    const id = gen.id ?? gen.generation_id;
    if (!id) throw new ServiceUnavailableException('Voicebox não retornou id de geração.');

    // Poll do áudio até ficar pronto (síntese é assíncrona/enfileirada).
    for (let i = 0; i < 30; i++) {
      const audioRes = await this.fetchWithTimeout(`/audio/${id}`, { method: 'GET' }, 4000).catch(
        () => null,
      );
      if (audioRes && audioRes.ok) {
        const ct = audioRes.headers.get('content-type') ?? 'audio/wav';
        const buf = Buffer.from(await audioRes.arrayBuffer());
        if (buf.length > 0 && ct.startsWith('audio')) {
          return { audio: buf, contentType: ct };
        }
      }
      await new Promise((r) => setTimeout(r, 400)); // ~12s no total
    }
    throw new ServiceUnavailableException('Voicebox demorou demais para gerar o áudio.');
  }

  /** STT alternativo: envia o áudio ao Whisper do Voicebox (agnóstico de idioma). */
  async transcribe(audio: Buffer, model = 'whisper-turbo'): Promise<string> {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(audio)], { type: 'audio/webm' }), 'comando.webm');
    form.append('model', model);
    let res: Response;
    try {
      res = await this.fetchWithTimeout('/transcribe', { method: 'POST', body: form }, 30000);
    } catch (err) {
      throw new ServiceUnavailableException(`Voicebox STT indisponível: ${(err as Error).message}`);
    }
    if (!res.ok)
      throw new ServiceUnavailableException(`Voicebox /transcribe falhou (${res.status}).`);
    const data = (await res.json()) as { text?: string; transcript?: string };
    return (data.text ?? data.transcript ?? '').trim();
  }

  private async firstProfileId(): Promise<string | undefined> {
    const profiles = await this.listProfiles().catch(() => []);
    return profiles[0]?.id;
  }
}
