import {
  IsBoolean,
  IsEnum,
  IsIP,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DeviceType, Protocol } from '@prisma/client';

export class CreateDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsEnum(DeviceType)
  type!: DeviceType;

  @IsEnum(Protocol)
  protocol!: Protocol;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsIP(undefined, { message: 'IP inválido' })
  ip?: string;

  @IsOptional()
  @IsString()
  externalId?: string; // Tuya device id

  @IsOptional()
  @IsString()
  protocolVersion?: string; // Tuya 3.3 / 3.4 / 3.5

  // Segredos em texto puro na ENTRADA; o serviço os criptografa antes de salvar.
  @IsOptional()
  @IsString()
  localKey?: string; // Tuya local_key

  @IsOptional()
  @IsString()
  tapoEmail?: string;

  @IsOptional()
  @IsString()
  tapoPass?: string;

  @IsOptional()
  @IsBoolean()
  supportsBrightness?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsColor?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsColorTemp?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsEnergy?: boolean;
}
