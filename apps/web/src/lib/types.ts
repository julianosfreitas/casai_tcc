export type DeviceType = 'LIGHT' | 'PLUG' | 'SWITCH' | 'SENSOR' | 'OTHER';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type Protocol = 'TUYA' | 'TUYA_CLOUD' | 'TAPO' | 'HOME_ASSISTANT' | 'MOCK';

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

/** Candidato retornado pela descoberta automática de rede (POST /devices/discover). */
export interface DiscoveredDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  protocolGuess: 'TUYA' | 'TAPO' | null;
  openPorts: number[];
  externalId?: string;
  protocolVersion?: string;
  via: string[];
  alreadyAdded: boolean;
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

export interface AutomationAction {
  deviceId: string;
  command: string;
  brightness?: number;
  color?: string;
  colorTemp?: number;
  delaySeconds?: number;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: 'SCHEDULE' | 'MANUAL';
  triggerConfig: { time?: string; cron?: string; weekdays?: number[] };
  actions: AutomationAction[];
  conditions: unknown[];
}

export interface Scene {
  id: string;
  name: string;
  icon: string | null;
  actions: AutomationAction[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface GamificationSummary {
  points: number;
  level: { index: number; name: string; minPoints: number; nextAt: number | null };
  progress: number;
  achievements: Achievement[];
  stats: {
    devices: number;
    realDevices: number;
    automations: number;
    scenes: number;
    voiceOk: number;
    energyReadings: number;
  };
}

export interface VoiceResult {
  transcript: string;
  intent: string;
  executed: boolean;
  needsConfirmation: boolean;
  suggestions?: string[];
  latencyMs: number;
}
