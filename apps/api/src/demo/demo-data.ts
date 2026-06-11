/**
 * Dados de demonstração do CASAI — usados pelo seed (`prisma db seed`) e pelo
 * DEMO_MODE (deploy público). Sem dependências do Nest: dados puros.
 */

export const DEMO_USER = {
  email: 'dev@casai.local',
  name: 'Casa Demo',
  password: 'Senha@123',
};

export const DEMO_ROOMS = [
  { name: 'Sala', order: 0 },
  { name: 'Quarto', order: 1 },
  { name: 'Cozinha', order: 2 },
] as const;

export interface DemoDevice {
  name: string;
  type: 'LIGHT' | 'PLUG';
  room: string;
  supportsBrightness?: boolean;
  supportsColor?: boolean;
  supportsColorTemp?: boolean;
  supportsEnergy?: boolean;
  lastState: { on: boolean; brightness?: number };
}

export const DEMO_DEVICES: DemoDevice[] = [
  {
    name: 'Luz da Sala (MOCK)',
    type: 'LIGHT',
    room: 'Sala',
    supportsBrightness: true,
    supportsColor: true,
    supportsColorTemp: true,
    lastState: { on: false, brightness: 80 },
  },
  {
    name: 'Tomada da Cozinha (MOCK)',
    type: 'PLUG',
    room: 'Cozinha',
    supportsEnergy: true,
    lastState: { on: true },
  },
  {
    name: 'Cafeteira (MOCK)',
    type: 'PLUG',
    room: 'Cozinha',
    supportsEnergy: true,
    lastState: { on: false },
  },
];

interface DemoAction {
  deviceName: string;
  command: 'turnOn' | 'turnOff' | 'setBrightness' | 'setColorTemp';
  brightness?: number;
  colorTemp?: number;
  delaySeconds?: number;
}

export interface DemoAutomation {
  name: string;
  triggerConfig: { time: string; weekdays?: number[] };
  actions: DemoAction[];
}

/** Rotinas de exemplo — contam a história da demo (acordar, café, dormir, economizar). */
export const DEMO_AUTOMATIONS: DemoAutomation[] = [
  {
    name: '☀️ Bom dia',
    triggerConfig: { time: '07:00', weekdays: [1, 2, 3, 4, 5] },
    actions: [
      { deviceName: 'Luz da Sala (MOCK)', command: 'turnOn' },
      { deviceName: 'Luz da Sala (MOCK)', command: 'setBrightness', brightness: 80 },
    ],
  },
  {
    name: '☕ Café da manhã',
    triggerConfig: { time: '06:50', weekdays: [1, 2, 3, 4, 5] },
    actions: [
      { deviceName: 'Cafeteira (MOCK)', command: 'turnOn' },
      // Desliga sozinha meia hora depois — café pronto, sem desperdício.
      { deviceName: 'Cafeteira (MOCK)', command: 'turnOff', delaySeconds: 1800 },
    ],
  },
  {
    name: '🌙 Boa noite',
    triggerConfig: { time: '23:00' },
    actions: [
      { deviceName: 'Luz da Sala (MOCK)', command: 'turnOff' },
      { deviceName: 'Cafeteira (MOCK)', command: 'turnOff' },
    ],
  },
  {
    name: '💸 Economia na madrugada',
    triggerConfig: { time: '00:30' },
    actions: [{ deviceName: 'Tomada da Cozinha (MOCK)', command: 'turnOff' }],
  },
];

export interface DemoScene {
  name: string;
  icon: string;
  actions: DemoAction[];
}

export const DEMO_SCENES: DemoScene[] = [
  {
    name: '🎬 Modo cinema',
    icon: 'clapperboard',
    actions: [
      { deviceName: 'Luz da Sala (MOCK)', command: 'turnOn' },
      { deviceName: 'Luz da Sala (MOCK)', command: 'setBrightness', brightness: 20 },
    ],
  },
  {
    name: '🏠 Cheguei em casa',
    icon: 'house',
    actions: [
      { deviceName: 'Luz da Sala (MOCK)', command: 'turnOn' },
      { deviceName: 'Luz da Sala (MOCK)', command: 'setBrightness', brightness: 100 },
      { deviceName: 'Tomada da Cozinha (MOCK)', command: 'turnOn' },
    ],
  },
  {
    name: '🌅 Acordar suave',
    icon: 'sunrise',
    actions: [
      { deviceName: 'Luz da Sala (MOCK)', command: 'turnOn' },
      { deviceName: 'Luz da Sala (MOCK)', command: 'setBrightness', brightness: 30 },
      { deviceName: 'Luz da Sala (MOCK)', command: 'setColorTemp', colorTemp: 3000 },
    ],
  },
];

/** Converte ações de demo (por nome) em ações persistíveis (por id). */
export function resolveActions(
  actions: DemoAction[],
  deviceIdByName: Record<string, string>,
): Array<Record<string, unknown>> {
  return actions.map(({ deviceName, ...rest }) => ({
    deviceId: deviceIdByName[deviceName],
    ...rest,
  }));
}
