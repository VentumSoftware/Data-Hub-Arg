import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const client = new Client({
    host: process.env.TABLES_DDBB_CONNECTION_HOST || 'localhost',
    port: process.env.TABLES_DDBB_CONNECTION_PORT || '5432',
    database: process.env.TABLES_DDBB_CONNECTION_DATABASE || 'databank',
    user: process.env.TABLES_DDBB_CONNECTION_USER || 'postgres',
    password: process.env.TABLES_DDBB_CONNECTION_PASSWORD || 'postgres',
    ssl: process.env.TABLES_DDBB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

client.connect();

export const db = drizzle(client, { schema });
