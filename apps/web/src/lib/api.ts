import type {
  Automation,
  AutomationAction,
  CreateDevicePayload,
  Device,
  DeviceState,
  DiscoveredDevice,
  EnergyBucket,
  EnergySummary,
  GamificationSummary,
  Scene,
  VoiceResult,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'casai.accessToken';
const REFRESH_KEY = 'casai.refreshToken';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  signIn: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/sign_in', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signUp: (email: string, name: string, password: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/sign_up', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    }),

  googleSignIn: (idToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  devices: () => request<Device[]>('/devices'),

  createDevice: (payload: CreateDevicePayload) =>
    request<Device>('/devices', { method: 'POST', body: JSON.stringify(payload) }),

  deleteDevice: (id: string) => request<{ ok: true }>(`/devices/${id}`, { method: 'DELETE' }),

  discoverDevices: () =>
    request<{ found: DiscoveredDevice[]; hint: string }>('/devices/discover', { method: 'POST' }),

  command: (id: string, command: string, extra: Record<string, unknown> = {}) =>
    request<DeviceState>(`/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, ...extra }),
    }),

  // Leitura de estado SEM ligar/desligar — usada pelo "Testar conexão".
  testConnection: (id: string) => request<DeviceState>(`/devices/${id}/state`),

  automations: () => request<Automation[]>('/automations'),

  createAutomation: (payload: {
    name: string;
    triggerType: 'SCHEDULE' | 'MANUAL';
    triggerConfig: { time?: string; weekdays?: number[] };
    actions: AutomationAction[];
  }) => request<Automation>('/automations', { method: 'POST', body: JSON.stringify(payload) }),

  updateAutomation: (id: string, payload: Partial<{ enabled: boolean; name: string }>) =>
    request<Automation>(`/automations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteAutomation: (id: string) =>
    request<{ ok: true }>(`/automations/${id}`, { method: 'DELETE' }),

  runAutomation: (id: string) =>
    request<unknown>(`/automations/${id}/run`, { method: 'POST' }),

  scenes: () => request<Scene[]>('/scenes'),

  createScene: (payload: { name: string; icon?: string; actions: AutomationAction[] }) =>
    request<Scene>('/scenes', { method: 'POST', body: JSON.stringify(payload) }),

  deleteScene: (id: string) => request<{ ok: true }>(`/scenes/${id}`, { method: 'DELETE' }),

  activateScene: (id: string) =>
    request<unknown>(`/scenes/${id}/activate`, { method: 'POST' }),

  gamification: () => request<GamificationSummary>('/gamification/summary'),

  energySummary: () => request<EnergySummary>('/energy/summary'),

  energyHistory: (deviceId: string, period = '24h', granularity = 'hour') =>
    request<{ buckets: EnergyBucket[] }>(
      `/devices/${deviceId}/energy/history?period=${period}&granularity=${granularity}`,
    ),

  voiceCommandText: (text: string) =>
    request<VoiceResult>('/voice/command', { method: 'POST', body: JSON.stringify({ text }) }),

  voiceCommandAudio: (audio: Blob) => {
    const form = new FormData();
    form.append('audio', audio, 'comando.webm');
    return request<VoiceResult>('/voice/command', { method: 'POST', body: form });
  },
};
