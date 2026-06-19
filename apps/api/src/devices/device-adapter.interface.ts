export interface DeviceState {
  on: boolean;
  brightness?: number; // 0-100
  color?: string; // hex (#RRGGBB)
  colorTemp?: number; // kelvin
}

export interface EnergyData {
  watts: number;
  kwhToday?: number;
  kwhMonth?: number;
}

/**
 * Contrato único para qualquer dispositivo. Nenhum controller/serviço chama
 * tuyapi/tp-link-tapo-connect diretamente — tudo passa por aqui (CLAUDE.md §4.2).
 * Capacidades não suportadas devem lançar NotImplementedException.
 */
export interface DeviceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  toggle(): Promise<void>;
  setBrightness(value: number): Promise<void>;
  setColor(hex: string): Promise<void>;
  setColorTemp(kelvin: number): Promise<void>;
  readState(): Promise<DeviceState>;
  readEnergy(): Promise<EnergyData | null>;
}

/** Lançada quando o dispositivo não responde no tempo esperado (timeout/conexão). */
export class DeviceOfflineError extends Error {
  constructor(
    public readonly deviceId: string,
    cause?: unknown,
  ) {
    super(`Dispositivo ${deviceId} está offline ou não respondeu`);
    this.name = 'DeviceOfflineError';
    if (cause instanceof Error) {
      this.stack += `\nCausado por: ${cause.message}`;
    }
  }
}

/**
 * Lançada quando o dispositivo RESPONDEU mas rejeitou o comando (DP/credencial
 * inválida, permissão, rate-limit). NÃO é "offline" — não deve marcar OFFLINE.
 */
export class DeviceCommandError extends Error {
  constructor(
    public readonly deviceId: string,
    public readonly detail?: string,
  ) {
    super(`Dispositivo ${deviceId} rejeitou o comando${detail ? `: ${detail}` : ''}`);
    this.name = 'DeviceCommandError';
  }
}

/** Dados (descriptografados em memória) que um adapter precisa para conectar. */
export interface AdapterContext {
  deviceId: string;
  name: string;
  ip?: string | null;
  externalId?: string | null;
  protocolVersion?: string | null;
  localKey?: string | null; // Tuya local_key (já descriptografada)
  tapoEmail?: string | null;
  tapoPass?: string | null; // já descriptografada
  supportsBrightness: boolean;
  supportsColor: boolean;
  supportsColorTemp: boolean;
  supportsEnergy: boolean;
}
