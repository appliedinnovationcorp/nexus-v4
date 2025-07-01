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
  JWT_SECRET: string = 'dda1b89507fd4faba1ba488380129ff48820e4cbe02cd484e023a1800d0f5a36';

  @IsNumber()
  @IsOptional()
  JWT_EXPIRES_IN: number = 3600;
}

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);
  return validatedConfig;
};
