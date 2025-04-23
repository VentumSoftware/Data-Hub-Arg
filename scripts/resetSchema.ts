// scripts/resetSchema.ts
import { Client } from 'pg';
const client = new Client({
    host: process.env.TABLES_DDBB_CONNECTION_HOST || 'localhost',
    port: process.env.TABLES_DDBB_CONNECTION_PORT || '5432',
    database: process.env.TABLES_DDBB_CONNECTION_DATABASE || 'databank',
    user: process.env.TABLES_DDBB_CONNECTION_USER || 'postgres',
    password: process.env.TABLES_DDBB_CONNECTION_PASSWORD || 'postgres',
    ssl: process.env.TABLES_DDBB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function resetSchema() {
  try {
    await client.connect();
    console.log(1, '🔹 Connected to the database...');
    await client.query('DROP SCHEMA public CASCADE;');
    console.log(2, '🔹 Dropped existing schema...');
    await client.query('CREATE SCHEMA public;');
    console.log('✅ Schema reset complete.');
  } catch (err) {
    console.error('❌ Failed to reset schema:', err);
  } finally {
    await client.end();
  }
}

resetSchema();

//npx ts-node scripts/resetSchema.ts

