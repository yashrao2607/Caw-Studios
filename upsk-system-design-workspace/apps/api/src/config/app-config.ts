export enum AppEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export interface AppConfig {
  APP_ENV: AppEnvironment;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
}

export function validateConfig(env: Record<string, string | undefined>): AppConfig {
  const errors: string[] = [];

  const rawEnv = env.APP_ENV || env.NODE_ENV;
  if (!rawEnv) {
    errors.push('Missing required environment variable: APP_ENV (allowed: development, staging, production)');
  } else if (!Object.values(AppEnvironment).includes(rawEnv as AppEnvironment)) {
    errors.push(`Invalid APP_ENV "${rawEnv}". Allowed values: ${Object.values(AppEnvironment).join(', ')}`);
  }

  const port = parseInt(env.PORT || '3000', 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`Invalid PORT "${env.PORT}". Must be a valid positive integer between 1 and 65535.`);
  }

  if (!env.DATABASE_URL) {
    errors.push('Missing required environment variable: DATABASE_URL');
  }

  if (!env.JWT_SECRET) {
    errors.push('Missing required environment variable: JWT_SECRET');
  } else if (env.JWT_SECRET.length < 16) {
    errors.push('JWT_SECRET must be at least 16 characters long for cryptographic safety.');
  }

  const corsOrigin = env.CORS_ORIGIN || (rawEnv === AppEnvironment.DEVELOPMENT ? '*' : '');
  if (!corsOrigin && rawEnv === AppEnvironment.PRODUCTION) {
    errors.push('Missing required environment variable: CORS_ORIGIN in production environment.');
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  const logLevel = env.LOG_LEVEL || (rawEnv === AppEnvironment.DEVELOPMENT ? 'debug' : 'info');
  if (!validLogLevels.includes(logLevel)) {
    errors.push(`Invalid LOG_LEVEL "${env.LOG_LEVEL}". Allowed values: ${validLogLevels.join(', ')}`);
  }

  if (errors.length > 0) {
    console.error('FATAL CONFIGURATION ERROR: Service startup aborted due to configuration errors:');
    errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return {
    APP_ENV: rawEnv as AppEnvironment,
    PORT: port,
    DATABASE_URL: env.DATABASE_URL!,
    JWT_SECRET: env.JWT_SECRET!,
    CORS_ORIGIN: corsOrigin,
    LOG_LEVEL: logLevel,
  };
}

export const appConfig = validateConfig(process.env);
