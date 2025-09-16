import { ConfigService } from '@nestjs/config';
import { env } from 'process';
import { z } from 'zod';

export const envSchema = z.object({
    env: z.enum(['development', 'production', 'test']).default('development'),
    port: z.string().default('3000'),
    dbUrl: z.string().url(),
    cookieSecret: z.string(),
});

export const getAppConfig = (config: ConfigService) => ({
    env: config.get<string>('NODE_ENV') || env.NODE_ENV || 'development',
    port: parseInt(config.get('PORT') || '3000'),
    dbUrl: config.get<string>('DATABASE_URL')!,
    cookieSecret: config.get<string>('COOKIE_SECRET') || 'supersecret',
    ddbb: {
        connection: {
            host: config.get<string>('DDBB_CONNECTION_HOST') || 'localhost',
            database: config.get<string>('DDBB_CONNECTION_DATABASE') || 'postgres',
            user: config.get<string>('DDBB_CONNECTION_USER') || 'postgres',
            port: parseInt(config.get<string>('DDBB_CONNECTION_PORT') || '5432'),
            password: config.get<string>('DDBB_CONNECTION_PASSWORD') || 'postgres',
            ssl: config.get<string>('DDBB_CONNECTION_SSL') === 'true' || false,
        },
    },
    googleAuth:{
        clientId: config.get<string>('GOOGLE_AUTH_CLIENT_ID'),
        clientSecret: config.get<string>('GOOGLE_AUTH_CLIENT_SECRET'),
        callbackUrl: config.get<string>('GOOGLE_AUTH_CALLBACK_URL') || 'https://localhost/api/auth/google/callback',
        returnUrl: config.get<string>('GOOGLE_AUTH_RETURN_URL') || 'https://localhost/',
    }
});