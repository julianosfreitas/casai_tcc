import { IsHexColor, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEVICE_COMMANDS = [
  'turnOn',
  'turnOff',
  'toggle',
  'setBrightness',
  'setColor',
  'setColorTemp',
] as const;

export type DeviceCommandName = (typeof DEVICE_COMMANDS)[number];

export class DeviceCommandDto {
  @IsIn(DEVICE_COMMANDS, { message: 'Comando inválido' })
  command!: DeviceCommandName;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  brightness?: number; // para setBrightness

  @IsOptional()
  @IsHexColor({ message: 'Cor deve ser hex (ex: #4F8EF7)' })
  color?: string; // para setColor

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(7000)
  colorTemp?: number; // kelvin, para setColorTemp
}
