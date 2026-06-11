export type DeviceType = 'LIGHT' | 'PLUG' | 'SWITCH' | 'SENSOR' | 'OTHER';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type Protocol = 'TUYA' | 'TAPO' | 'MOCK';

export interface DeviceState {
  on: boolean;
  brightness?: number;
  color?: string;
  colorTemp?: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  protocol: string;
  status: DeviceStatus;
  roomId: string | null;
  ip: string | null;
  protocolVersion: string | null;
  lastSeen: string | null;
  supportsBrightness: boolean;
  supportsColor: boolean;
  supportsColorTemp: boolean;
  supportsEnergy: boolean;
  lastState: DeviceState | null;
}

/** Corpo do POST /devices — segredos vão em texto puro e a API os criptografa. */
export interface CreateDevicePayload {
  name: string;
  type: DeviceType;
  protocol: Protocol;
  ip?: string;
  externalId?: string;
  protocolVersion?: string;
  localKey?: string;
  tapoEmail?: string;
  tapoPass?: string;
  supportsBrightness?: boolean;
  supportsColor?: boolean;
  supportsColorTemp?: boolean;
  supportsEnergy?: boolean;
}

export interface EnergySummary {
  totalWatts: number;
  kwhToday: number;
  kwhMonth: number;
  costToday: number;
  costMonth: number;
  projectedMonthlyCost: number;
  rate: number;
}

export interface EnergyBucket {
  bucket: string;
  avgWatts: number;
  samples: number;
}

export interface VoiceResult {
  transcript: string;
  intent: string;
  executed: boolean;
  needsConfirmation: boolean;
  suggestions?: string[];
  latencyMs: number;
}
