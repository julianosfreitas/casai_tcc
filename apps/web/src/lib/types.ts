export type DeviceType = 'LIGHT' | 'PLUG' | 'SWITCH' | 'SENSOR' | 'OTHER';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

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
  supportsBrightness: boolean;
  supportsColor: boolean;
  supportsColorTemp: boolean;
  supportsEnergy: boolean;
  lastState: DeviceState | null;
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
