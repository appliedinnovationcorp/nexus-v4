import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = '*';

  @IsString()
  @IsOptional()
  DATABASE_URL: string = '';

  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'super-secret-jwt-key-for-development-only';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'super-secret-refresh-key-for-development-only';

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  JWT_ISSUER: string = 'nexus-api';

  @IsString()
  @IsOptional()
  JWT_AUDIENCE: string = 'nexus-app';

  // Sentry Configuration
  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  SENTRY_RELEASE?: string;

  @IsString()
  @IsOptional()
  SENTRY_ORG?: string;

  @IsString()
  @IsOptional()
  SENTRY_PROJECT?: string;

  @IsString()
  @IsOptional()
  SENTRY_AUTH_TOKEN?: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  SENTRY_DEBUG?: boolean = false;

  // Logging Configuration
  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  ENABLE_ERROR_TRACKING: boolean = true;
}

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);
  return validatedConfig;
};
