import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') })

//------------------------------- Enviroment Variables ----------------------------------
export default {
    admin: {
        email: process.env.APP_ADMIN_EMAIL || 'admin@admin',
        password: process.env.APP_ADMIN_PASS || 'admin',
        name: process.env.APP_ADMIN_NAME || 'admin',
        lastName: process.env.APP_ADMIN_LAST_NAME || 'admin'
    },
    ddbb: {
        connection: {
            host: process.env.TABLES_DDBB_CONNECTION_HOST || 'localhost',
            port: process.env.TABLES_DDBB_CONNECTION_PORT || '5432',
            database: process.env.TABLES_DDBB_CONNECTION_DATABASE || 'databank',
            user: process.env.TABLES_DDBB_CONNECTION_USER || 'postgres',
            password: process.env.TABLES_DDBB_CONNECTION_PASSWORD || 'postgres',
            ssl: process.env.TABLES_DDBB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        },
        pool: {
            min: Number(process.env.TABLES_DDBB_POOL_MIN) || 2,
            max: Number(process.env.TABLES_DDBB_POOL_MAX) || 10,
            acquireTimeoutMillis: 60000,
        },
        migrations: {
            tableName: process.env.TABLES_DDBB_MIGRATION_TABLENAME || 'knex_migrations'
        },
        seeds: {
            directory: process.env.TABLES_DDBB_SEEDS_DIRECTORY || './seeds'
        }
    },
    app: {
        env: process.env.APP_NODE_ENV || 'development',
        ssl_port: parseInt(process.env.APP_SSL_PORT) || 443,
        port: parseInt(process.env.APP_PORT) || 8080,
        logLevel: parseInt(process.env.APP_LOG_LEVEL) || 0
    },
    tables: {
        pg: {
            host: process.env.PG_HOST || 'localhost',
            port: process.env.PG_PORT || 5432,
            database: process.env.PG_DDBB || 'databank',
            user: process.env.PG_USER || 'postgres',
            password: process.env.PG_PASSWORD || 'postgres',
        },
        cdc: {
            prefix: process.env.TABLES_CDC_PREFIX || 'cdc_',
            id: process.env.TABLES_CDC_ID || 'cdc_id',
            action: process.env.TABLES_CDC_ACTION || 'cdc_action',
            editedAt: process.env.TABLES_CDC_EDITED_AT || 'cdc_edited_at',
            editedBy: process.env.TABLES_CDC_EDITED_BY || 'cdc_edited_by',
            ignore: [] // U: tables to ignore in CDC
        }
    },
    jwt: {
        duration: parseInt(process.env.JWT_DURATION || '7200000'),
        secret: process.env.JWT_SECRET || 'secret',
        saltWorkFactor: parseInt(process.env.JWT_SWF || '10')
    },
    middleware: {
        log: {
            req: {
                req: process.env.MIDDLEWARE_LOG_REQ_REQ || true,
                ip: process.env.MIDDLEWARE_LOG_REQ_IP || true,
                url: process.env.MIDDLEWARE_LOG_REQ_URL || true,
                method: process.env.MIDDLEWARE_LOG_REQ_METHOD || true,
                query: process.env.MIDDLEWARE_LOG_REQ_QUERY || true,
                headers: process.env.MIDDLEWARE_LOG_REQ_HEADERS || false,
                body: process.env.MIDDLEWARE_LOG_REQ_BODY || 'oneline',
                auth: process.env.MIDDLEWARE_LOG_REQ_AUTH || 'oneline',
            },
            res: {
                res: process.env.MIDDLEWARE_LOG_RES_RES || true,
                headers: process.env.MIDDLEWARE_LOG_RES_HEADERS || false,
                body: process.env.MIDDLEWARE_LOG_RES_BODY || 'oneline',
                auth: process.env.MIDDLEWARE_LOG_RES_AUTH || false,
            }
        },
        auth: {
            ips: process.env.MIDDLEWARE_AUTH_IPS || ['::1','127.0.0.1'],
            token: process.env.MIDDLEWARE_AUTH_TOKEN || '',
        }
    },
    mailNotification: {
        transport: {
            host: process.env.MAIL_NOTIFICATIONS_TRANSPORT_HOST,
            port: process.env.MAIL_NOTIFICATIONS_TRANSPORT_PORT || 8082,
            secure: process.env.MAIL_NOTIFICATIONS_TRANSPORT_SECURE || "432",
            auth: {
                user: process.env.MAIL_NOTIFICATIONS_TRANSPORT_AUTH_USER || "234",
                pass: process.env.MAIL_NOTIFICATIONS_TRANSPORT_AUTH_PASS || "234"
            }
        },
        cc: process.env.MAIL_NOTIFICATIONS_CC || [],
        from: process.env.MAIL_NOTIFICATIONS_FROM || process.env.MAIL_NOTIFICATIONS_TRANSPORT_AUTH_USER,
        to: process.env.MAIL_NOTIFICATIONS_TO || process.env.MAIL_NOTIFICATIONS_TRANSPORT_AUTH_USER,
    },
    dolarito: {
        auth: process.env.DOLARITO_AUTH || ""
    }
}