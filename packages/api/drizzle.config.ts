import { defineConfig } from "drizzle-kit";
import dotenv from 'dotenv';
dotenv.config();

// Use DATABASE_URL if available, otherwise build from individual components
let dbURL = process.env.DATABASE_URL;

if (!dbURL) {
  const { user, password, host, port, database, useSSL } = {
    user: process.env.POSTGRES_USER || 'app_user',
    password: process.env.POSTGRES_PASSWORD || 'app_password',
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'app_local',
    useSSL: process.env.POSTGRES_SSL === 'true',
  }
  
  const sslParam = useSSL ? '?sslmode=require' : '?sslmode=disable';
  dbURL = `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
}

console.log('Database URL:', dbURL.replace(/:[^:@]*@/, ':****@')); // Hide password in logs

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: dbURL,
  },
  verbose: true,
});