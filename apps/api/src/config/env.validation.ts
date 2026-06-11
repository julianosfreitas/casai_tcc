import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

/**
 * Validação de variáveis de ambiente na inicialização — falha cedo e claro
 * se faltar segredo crítico (em vez de quebrar fundo no runtime).
 */
class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET deve ter ao menos 32 caracteres' })
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES?: string;

  @IsString()
  @MinLength(64, { message: 'CASAI_ENCRYPTION_KEY deve ter 64 hex (32 bytes)' })
  CASAI_ENCRYPTION_KEY!: string;

  @IsOptional()
  @IsInt()
  PORT?: number;

  // Opcional: sem ele, POST /auth/google responde 503 (login com Google desativado).
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Variáveis de ambiente inválidas:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return validated;
}
