/** Conquista calculada a partir dos dados existentes — nada é persistido. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Nome de ícone lucide (a web resolve). */
  icon: string;
  unlocked: boolean;
}

export interface GamificationLevel {
  index: number;
  name: string;
  minPoints: number;
  /** Pontos do próximo nível; null quando já é o último. */
  nextAt: number | null;
}

export interface GamificationSummary {
  points: number;
  level: GamificationLevel;
  /** Progresso 0–100 até o próximo nível (100 no nível máximo). */
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

/** Níveis em pontos acumulados. Nomes divertidos > genéricos (gamificação). */
export const LEVELS: ReadonlyArray<{ name: string; minPoints: number }> = [
  { name: 'Visitante', minPoints: 0 },
  { name: 'Aprendiz da Casa', minPoints: 50 },
  { name: 'Automator', minPoints: 150 },
  { name: 'Engenheiro do Lar', minPoints: 300 },
  { name: 'Mestre da Casa', minPoints: 500 },
  { name: 'Lenda da Automação', minPoints: 800 },
];
