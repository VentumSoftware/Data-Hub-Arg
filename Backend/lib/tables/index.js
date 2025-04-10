import env from '../../config/env.js';
import pg from 'pg';
import createSubscriber from 'pg-listen';
import QueryStream from 'pg-query-stream';
import { timeout, indexBy, indexArraysBy, updateIndex, getIndex } from '../utils/index.js';
import crypto from 'crypto';
import fs from 'fs';
import pkg from 'lodash';
const { isEmpty } = pkg;
import { info, warn, error } from '../log/index.js';
export const { prefix: cdcPrefix, id: cdcId, action: cdcAction, editedAt: cdcEditedAt, editedBy: cdcEditedBy, lastChangesLimit: cdcLastChangesLimit } = env.tables.cdc;
import path from 'path'
const notificationListeners = [];
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
const createHash = (str) => crypto.createHash('sha256').update(str).digest('hex');

const init = async () => {

    const start = Date.now();
    const { user, password, database, host, port } = env.ddbb.connection;
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    console.log({ connectionString })
    const channel = 'notifications_channel';
    //console.log({...env.tables.pg, ssl: { rejectUnauthorized: false,  ca: fs.readFileSync("./ca-certificate.crt") }})
    const pool = (() => {
        const isProduction = env.app.env === 'production';
        const poolConfig = {
            ...env.ddbb.connection,
            ssl: isProduction ? { rejectUnauthorized: false } : false
        };
        const pool = new pg.Pool(poolConfig);

        console.log({ env: env.app.env }, 'Mail Notification : ', { to: env.mailNotification.to, from: env.mailNotification.from })
        pool.on('end', () => error('PostgreSQL Pool Disconected!'));
        pool.on('error', (err) => error('PostgreSQL Pool Error: ' + JSON.stringify(err)));
        // pool.on('connect', () => info('PostgreSQL Pool Connected'));
        // pool.on('acquire', () => info('PostgreSQL Pool Acquired'));
        // pool.on('remove', () => info('PostgreSQL Pool Removed'));
        return pool;
    })();
    const schema = await (async () => {

        const removeDuplicatedCols = (table) => {
            return table.reduce((p, c) => {
                let col = p.find(x => x.name === c.name);
                if (col) {
                    col.pk = col.pk || c.pk;
                    col.fk = col.fk || c.fk;
                } else {
                    p.push(c);
                }
                return p;
            }, []);
        }

        const tableInfoQuery = `SELECT 
        c.column_name AS name,
        c.data_type AS dataType,
        c.is_nullable AS isNullable,
        c.column_default AS defaultValue,
        c.ordinal_position AS position,
        CASE
            WHEN pk.constraint_name IS NOT NULL THEN 'YES'
            ELSE 'NO'
        END AS pk,
        CASE
            WHEN fk.constraint_name IS NOT NULL THEN 'YES'
            ELSE 'NO'
        END AS fk
        FROM information_schema.columns AS c
        LEFT JOIN information_schema.key_column_usage AS kcu
        ON c.column_name = kcu.column_name
        AND c.table_name = kcu.table_name
        LEFT JOIN information_schema.table_constraints AS pk
        ON kcu.constraint_name = pk.constraint_name
        AND pk.constraint_type = 'PRIMARY KEY'
        LEFT JOIN information_schema.referential_constraints AS rc
        ON kcu.constraint_name = rc.constraint_name
        LEFT JOIN information_schema.table_constraints AS fk
        ON rc.constraint_name = fk.constraint_name
        AND fk.constraint_type = 'FOREIGN KEY'
        WHERE c.table_name = $1
        ORDER BY c.ordinal_position;`;

        let schemaTables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema ='public';", []).catch(error);
        let schema = {};
        //console.log({schemaTables})
        for (let i = 0; i < schemaTables?.rows?.length; i++) {
            const tableName = schemaTables.rows[i].table_name;
            schema[tableName] = (await pool.query(tableInfoQuery, [tableName]).catch(error))?.rows;
            schema[tableName] = schema[tableName].map(c => ({
                ...c,
                isnullable: c.isnullable === 'YES',
                pk: c.pk === 'YES',
                fk: c.fk === 'YES'
            }));
            schema[tableName] = removeDuplicatedCols(schema[tableName]);
        };
        return schema;
    })();
    const schemaHash = createHash(JSON.stringify(schema));
    //PRUEBA

    // const subscriber = createSubscriber({
    //     connectionString,
    //     ssl: { rejectUnauthorized: false }
    // });

    // async function testPGListen() {
    //     subscriber.events.on("error", (err) => {
    //         console.error("PG-LISTEN connection error:", err);
    //     });

    //     subscriber.events.on("test_channel", (msg) => {
    //         console.log("Received notification:", msg);
    //     });

    //     await subscriber.connect();
    //     await subscriber.listenTo("test_channel");

    //     console.log("Listening to test_channel...");
    // }

    // testPGListen().catch(console.error);
    //FIN PRUEBA
    const runQuery = async (query, params) => {
        let retries = 3;
        for (let i = 0; i < retries; i++) {
            try {
                return await pool.query(query, params);
            } catch (err) {
                const paramsMapped = params?.reduce((p, x, i) => ({ ...p, [`$${i + 1}`]: x }), {});
                error(`Error running query: ${query}\nVALUES: ${JSON.stringify(paramsMapped, null, 4)}\nERROR: ${JSON.stringify(err, null, 4)}`);
                await new Promise(res => setTimeout(res, 2000));
            }
        }

        throw new Error(`Failed after ${retries} retries!`);
    };
    const getCache = await (async () => {
        let cache = {};
        let pgListenerConnected = false;
        let pgInitialized = false;

        const isReady = () => new Promise(async (resolve, reject) => {
            for (let i = 0; (!pgListenerConnected || !pgInitialized) && i < 20; i++) {
                warn({ pgListenerConnected, pgInitialized, i })
                await timeout(500);
            }
            pgListenerConnected && pgInitialized ? resolve() : reject();
        });
        const listenNotifications = async () => {

            const onError = (err) => {
                error('PG-LISTEN connection error:', err);
                console.log({ err })
                pgListenerConnected = false;
            };

            const onConnect = () => {
                info('PG-LISTEN connected');
                pgListenerConnected = true;
            };

            const onReconnect = async (attempt) => {

                const updateTableWithCDC = async (tableName, table) => {
                    let newRows = await runQuery(`SELECT * FROM ${tableName} WHERE ${cdcId} > ${table.cdc.count};`);
                    newRows.forEach(data => {
                        const action = 'INSERT';
                        const { rows, indexed, cdc, pks, schema } = table;
                        const { [cdcId]: cdc_id, [cdcAction]: rowAction, [cdcEditedAt]: created_at, ...r } = data;
                        const key = pks.reduce((p, k) => p + '-' + r[k], '').slice(1);
                        table.cdc.keys[key] ??= [];
                        console.log(1, { table, action })
                        switch (action) {
                            case 'INSERT':
                                switch (rowAction) {
                                    case 'INSERT':
                                        table.rows.push(r);
                                        table.indexed = updateIndex({ indexed, pks }, rows, action);
                                        break;
                                    case 'UPDATE':
                                        let updateI = table.rows.findIndex(r => pks.every(pk => r[pk] === r[pk]));
                                        if (updateI === -1) throw new Error(`UPDATE-CACHE-WITH-ROW Row not found: ${JSON.stringify(r)}`);
                                        table.rows[updateI] = { ...table.rows[updateI], ...r };
                                        table.indexed = updateIndex({ indexed, pks }, rows, action);
                                        break;
                                    case 'DELETE':
                                        let deleteI = table.rows.findIndex(r => pks.every(pk => r[pk] === r[pk]));
                                        if (deleteI === -1) throw new Error(`DELETE-CACHE-WITH-ROW Row not found: ${JSON.stringify(r)}`);
                                        table.rows.splice(deleteI, 1);
                                        table.indexed = updateIndex({ indexed, pks }, rows, action);
                                        break;
                                    default:
                                        throw new Error(`Invalid action: ${action}`);
                                }
                                break;
                            default:
                                throw new Error(`UPDATE-CACHE-WITH-CDC Invalid Action: ${action}`);
                        }
                        table.cdc.keys[key].push({ cdc_id, [cdcAction]: rowAction, [cdcEditedAt]: created_at, data: r });
                        table.cdc.count++;
                        table.lastChanges.push({ cdc_id, [cdcAction]: rowAction, [cdcEditedAt]: created_at, data: r, hash: createHash(JSON.stringify(data)) });
                        table.lastChanges = table.lastChanges.slice(-cdcLastChangesLimit);
                    });
                };

                const updateTableWithoutCDC = async (tableName, table) => {
                    table.rows = await streamData(tableName);
                    table.indexed = indexBy(table.rows, table.pks);
                };

                info(`PG-LISTEN reconnected after ${attempt} attempts`);
                const tableNames = Object.keys(schema).filter(t => !t.includes('knex') && !t.startsWith(cdcPrefix));
                for (let i = 0; i < tableNames.length; i++) {
                    const tableName = tableNames[i];
                    const isCDC = tableName.toLowerCase().startsWith(cdcPrefix);
                    const table = cache[isCDC ? tableName.slice(cdcPrefix.length) : tableName];
                    const hasCDC = table?.cdc != null;
                    if (isCDC) {
                        updateTableWithCDC(tableName, table);
                    } else if (!hasCDC) {
                        updateTableWithoutCDC(tableName, table);
                    }
                };
                pgListenerConnected = true;
            };

            const onDisconnect = () => {
                error('PG-LISTEN disconnected');
                pgListenerConnected = false;
            };

            const onNotification = (payload) => isReady().then(_ => {
                //console.log(payload)
                const updateCacheWithCDC = ({ table, action, data }) => {
                    const { rows, indexed, cdc, pks, schema } = table;
                    const { [cdcId]: cdc_id, [cdcAction]: rowAction, ...r } = data;
                    const key = pks.reduce((p, k) => p + '-' + r[k], '').slice(1);

                    const row = JSON.parse(JSON.stringify(r))
                    delete row.cdc_edited_at

                    table.cdc.keys[key] ??= [];
                    switch (action) {
                        case 'INSERT':
                            switch (rowAction) {
                                case 'INSERT':
                                    let insertI = table.rows.findIndex(x => pks.every(pk => x[pk] === row[pk]));
                                    //if( payload.table !== 'cdc_indexes' )console.log('INSERT',{row, tableName: payload.table,insertI})
                                    if (insertI > 0) {
                                        table.rows[insertI] = { ...table.rows[insertI], ...row };
                                    } else { table.rows.push(row); }
                                    table.indexed = updateIndex({ indexed, pks }, row, action);
                                    break;
                                case 'UPDATE':
                                    let updateI = table.rows.findIndex(x => pks.every(pk => x[pk] === row[pk]));
                                    if (updateI === -1) throw new Error(`UPDATE-CACHE-WITH-ROW Row not found: ${JSON.stringify(row)}`);
                                    console.log('UPDATE')
                                    console.log('UPDATE', { row, pks, tableName: payload.table, updateI, oldRow: { ...table.rows[updateI] } })
                                    table.rows[updateI] = { ...table.rows[updateI], ...row };
                                    table.indexed = updateIndex({ indexed, pks }, row, action);
                                    break;
                                case 'DELETE':
                                    let deleteI = table.rows.findIndex(r => pks.every(pk => r[pk] === r[pk]));
                                    if (deleteI === -1) throw new Error(`DELETE-CACHE-WITH-ROW Row not found: ${JSON.stringify(row)}`);
                                    table.rows.splice(deleteI, 1);
                                    table.indexed = updateIndex({ indexed, pks }, row, action);
                                    break;
                                default:
                                    throw new Error(`Invalid action: ${action}`);
                            }
                            break;
                        default:
                            break;
                        //console.error(`UPDATE-CACHE-WITH-CDC Invalid Action: ${action}`);    
                        //throw new Error(`UPDATE-CACHE-WITH-CDC Invalid Action: ${action}`);
                    }
                    table.cdc.keys[key].push({ cdc_id, [cdcAction]: rowAction, ...r });
                    table.cdc.count++;
                    table.lastChanges.push({ cdc_id, [cdcAction]: rowAction, ...r, hash: createHash(JSON.stringify(data)) });
                    table.lastChanges = table.lastChanges.slice(-cdcLastChangesLimit);
                };

                const updateCacheWithRow = ({ table, action, data }) => {
                    const { rows, indexed, cdc, pks, schema } = table;
                    switch (action) {
                        case 'INSERT':
                            table.rows.push(data);
                            table.indexed = updateIndex({ indexed, pks }, rows, action);
                            break;
                        case 'UPDATE':
                            let updateI = table.rows.findIndex(r => pks.every(pk => r[pk] === data[pk]));
                            if (updateI === -1) throw new Error(`UPDATE-CACHE-WITH-ROW Row not found: ${JSON.stringify(data)}`);
                            table.rows[updateI] = { ...table.rows[updateI], ...data }
                            table.indexed = updateIndex({ indexed, pks }, rows, action);
                            break;
                        case 'DELETE':
                            let deleteI = table.rows.findIndex(r => pks.every(pk => r[pk] === data[pk]));
                            if (deleteI === -1) throw new Error(`DELETE-CACHE-WITH-ROW Row not found: ${JSON.stringify(data)}`);
                            table.rows.splice(deleteI, 1);
                            table.indexed = updateIndex({ indexed, pks }, rows, action);
                            break;
                        default:
                            throw new Error(`Invalid action: ${action}`);
                    }
                };

                const { table: tableName, action, data } = payload;

                const isCDC = tableName.toLowerCase().startsWith(cdcPrefix);
                const table = cache[isCDC ? tableName.slice(cdcPrefix.length) : tableName];
                const hasCDC = table.cdc != null;
                if (isCDC) {
                    updateCacheWithCDC({ table, action, data });
                } else if (!hasCDC) {
                    updateCacheWithRow({ table, action, data });
                }

                notificationListeners.forEach(cb => { try { cb(payload) } catch (e) { error(e); } });
            });
            //console.log({certif: fs.readFileSync(path.join(__dirname, './ca-certificate.crt')).toString()})
            //const subscriber = env.app.env === 'development' ? createSubscriber({ connectionString }) : createSubscriber({ connectionString, ssl: { rejectUnauthorized: false, ca: fs.readFileSync("./ca-certificate.crt") } });
            const subscriber = createSubscriber({
                connectionString, ssl: {
                    rejectUnauthorized: false,
                }
            }) // poner en false solo si estás probando } });
            subscriber.events.on('error', onError);
            subscriber.events.on('connect', onConnect);
            subscriber.events.on('reconnect', onReconnect);
            subscriber.events.on('disconnect', onDisconnect);

            try {
                await subscriber.connect();
                await subscriber.listenTo(channel);
                pgListenerConnected = true; //Connect event is not launching
            } catch (error) {
                console.error("PG LISTEN ERROR:", error);
                console.log(error)
            }
            subscriber.notifications.on(channel, onNotification);
            process.on('exit', subscriber.close);
        };
        const streamData = (tableName) => new Promise(async (resolve, reject) => {
            try {
                const rows = [];
                const query = new QueryStream(`SELECT * FROM "${tableName}"`);
                const client = await pool.connect();
                const stream = client.query(query);
                const tableSchema = schema[tableName];
                const bigintsKeys = tableSchema.filter(c => c.datatype === 'bigint').map(c => c.name);
                stream.on('data', row => {
                    bigintsKeys.forEach(k => row[k] = parseInt(row[k]));
                    rows.push(row);
                });
                stream.on('end', () => {
                    client.release();
                    resolve(rows);
                });
                stream.on('error', (err) => {
                    client.release();
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
        const getTablesRows = async () => {
            const tablesName = Object.keys(schema);
            const res = {};
            for (let i = 0; i < tablesName.length; i++) {
                const tableName = tablesName[i];
                const rows = await streamData(tableName);
                res[tableName] = rows;
            };
            return res;
        };
        const buildCache = async (tablesRows) => {
            cache = {};
            const tablesName = Object.keys(schema);

            for (let i = 0; i < tablesName.length; i++) {
                let tableName = tablesName[i];
                const isCDC = tableName.startsWith(cdcPrefix);
                tableName = isCDC ? tableName.slice(cdcPrefix.length) : tableName;
                const pks = schema[tableName].filter(c => c.pk).map(c => c.name);
                cache[tableName] ??= {};
                if (isCDC) {
                    const cdcRows = tablesRows[cdcPrefix + tableName].sort((a, b) => b[cdcId] - a[cdcId]);
                    cache[tableName].cdc ??= {};
                    cache[tableName].cdc.count = cdcRows.length;
                    cache[tableName].cdc.keys = pks?.length !== 0 ? indexArraysBy(cdcRows, pks) : warn(` * Table CDC ${tableName} (${cache[cdcPrefix + tableName].rows?.length}) has NO PRIMARY KEYS!`);
                    cache[tableName].cdc.rows = cdcRows;
                    cache[tableName].lastChanges = cdcRows.slice(-cdcLastChangesLimit).sort((a, b) => a[cdcId] - b[cdcId]).map(r => {
                        const { [cdcId]: cdc_id, [cdcAction]: action, [cdcEditedAt]: created_at, ...data } = r;
                        return { [cdcId]: r[cdcId], [cdcAction]: r[cdcAction], [cdcEditedAt]: r[cdcEditedAt], data, hash: createHash(JSON.stringify(r)) };
                    });
                    cache[tableName].cdc.schema = [
                        ...schema[tableName].map(x => ({ ...x, pk: false })),
                        { name: cdcId, datatype: 'integer', isnullable: false, defaultvalue: null, pk: true, fk: false },
                        { name: cdcAction, datatype: 'character varying', isnullable: false, defaultvalue: null, pk: false, fk: false },
                    ];
                } else {
                    cache[tableName].rows = tablesRows[tableName];
                    cache[tableName].pks = pks;
                    cache[tableName].indexed = pks?.length !== 0 ? indexBy(cache[tableName].rows, pks) : warn(` * Table ${tableName} (${cache[tableName].rows.length}) has NO PRIMARY KEYS!`);
                    cache[tableName].schema = schema[tableName];
                }
            };
        };
        const checkCacheIntegrity = async () => {

            const checkKey = (tableName, actualRow, cdcRows) => {
                const cdcRow = cdcRows.sort((a, b) => a[cdcId] - b[cdcId]).reduce((p, x, i) => {
                    const { [cdcId]: cdc_id, [cdcAction]: action, ...data } = x;

                    switch (action.toUpperCase()) {
                        case 'INITIAL':
                            return data;
                        case 'INSERT':
                            return data;
                        case 'UPDATE':
                            return { ...p, ...data };
                        case 'DELETE':
                            return null;
                        default:
                            throw new Error(`Invalid action: ${action}`);
                    }
                }, {});
                let ok = false;
                if (actualRow == null) {
                    ok = cdcRow == null ? true : false;
                } else {
                    ok = Object.keys(actualRow).reduce((p, k) => p && actualRow[k]?.valueOf() === cdcRow[k]?.valueOf(), true);
                }

                if (!ok) {
                    const str = `Table ${tableName} not matching row with cdc: 
ACTUAL ROW:
${JSON.stringify(actualRow, null, 4)}
CDC ROW:
${JSON.stringify(cdcRow, null, 4)}`
                    throw new Error(str);
                }
            };

            const checkAllCDCIndexes = (tableName, cdcRows) => {
                cdcRows.sort((a, b) => a[cdcId] - b[cdcId]).every((cdcRow, i) => {
                    if (cdcRow[cdcId] !== i + 1) {
                        const str = `Table ${tableName} is missing cdc index ${i + 1}!`;
                        throw new Error(str);
                    }
                });
            };

            const tables = Object.keys(cache);
            for (let i = 0; i < tables.length; i++) {
                const table = cache[tables[i]];
                const { cdc, indexed } = table;
                if (indexed == null)
                    warn(`Table ${tables[i]} has NO INDEXED!`);
                if (cdc?.keys == null)
                    warn(`Table ${tables[i]} has NO CDC!`);
                if (cdc != null && indexed != null) {
                    // checkAllCDCIndexes(tables[i], cdc.rows);
                    Object.keys(cdc.keys).forEach(key => checkKey(tables[i], indexed[key], cdc.keys[key]));
                }

            };

        };

        await listenNotifications();
        const rows = await getTablesRows();
        await buildCache(rows);
        checkCacheIntegrity();
        pgInitialized = true;

        return async () => {
            await isReady();
            return cache;
        }
    })();
    const getRows = async (tableName, where) => {
        const tableKey = Object.keys(schema).find(t => t.toLowerCase() === tableName.toLowerCase());
        if (tableKey == null) throw new Error(`GET-ROWS Invalid table name: "${tableName}"`);
        const cache = await getCache();
        const table = tableName.toLowerCase().startsWith(cdcPrefix.toLowerCase()) ? cache[tableName.split(cdcPrefix)[1]].cdc : cache[tableName];
        if (where === undefined) {
            return table.rows;
        }
        else if (typeof where === 'function') {
            return table.rows.filter(where);
        } else if (typeof where === 'object') {
            return table.indexed && table.pks.every(pk => Object.keys(where).includes(pk)) ?
                getIndex(table.indexed, where) ://Acá se mandaba toda la info del table, está mal 
                table.rows.filter(row => Object.entries(where).every(([k, v]) => row[k] === v));
        } else {
            throw new Error(`GET-ROW Invalid where type: ${typeof where}`);
        }

    };
    const getRow = async (tableName, where) => {
        const tableKey = Object.keys(schema).find(t => t.toLowerCase() === tableName.toLowerCase());
        if (!tableKey) throw new Error(`GET-ROW Invalid table name: "${tableName}"`);
        const cache = await getCache();
        const table = cache[tableKey];

        if (typeof where === 'function') {
            return table.rows.find(where);
        } else if (typeof where === 'object') {
            return table.indexed && table.pks.every(pk => Object.keys(where).includes(pk)) ?
                getIndex(table, where) :
                table.rows.find(row => Object.entries(where).every(([k, v]) => row[k] === v));
        } else {
            throw new Error(`GET-ROW Invalid where type: ${typeof where}`);
        }

    };
    const getPaginatedRows = async (tableName, query) => {

        const cache = await getCache();

        const parseQuery = (query) => {
            query = typeof query === 'string' ? JSON.parse(query) : query;
            const entries = Object.entries(query);
            query = {
                pageNo: parseInt(entries.find(([k, v]) => k.toLowerCase() === 'pageno')?.[1] ?? 0),
                pageSize: parseInt(entries.find(([k, v]) => k.toLowerCase() === 'pagesize')?.[1] ?? 10000),
                order: entries.find(([k, v]) => k.toLowerCase() === 'order')?.[1] ?? [],
                filter: entries.find(([k, v]) => k.toLowerCase() === 'filter')?.[1] ?? null,
            };
            return query;
        };
        const buildFilter = (filter) => {

            const getPredicate = (filter) => {
                let predicate = null;
                let { column, condition, value, caseSensitive, conditional } = filter;
                const table = tableName.toLowerCase().startsWith(cdcPrefix.toLowerCase()) ? cache[tableName.split(cdcPrefix)[1]].cdc : cache[tableName];
                column = table.schema.find(c => c.name.toLowerCase() === column.toLowerCase())?.name;
                if (!column) throw new Error(`Invalid column: ${filter.column}`);
                if (!caseSensitive && typeof value === 'strings') value = value.toLowerCase();

                //TODO: FIX CASE SENSITIVE
                switch (condition.toLowerCase()) {
                    case 'contains':
                        if (typeof value === 'object') {
                            throw new Error(`Invalid filter value: ${value}`);
                        } else if (typeof value === 'number') {
                            value = value.toString();
                            predicate = row => row[column]?.toString()?.includes(value);
                        } else {
                            predicate = caseSensitive ?
                                row => row[column]?.includes(value) :
                                row => row[column]?.toLowerCase()?.includes(value);
                        }
                        break;
                    case 'equals':
                        if (typeof value === 'object') {
                            throw new Error(`Invalid filter value: ${value}`);
                        } else if (typeof value === 'number') {
                            predicate = row => row[column] === value;
                        } else {
                            predicate = caseSensitive ?
                                row => row[column] === value :
                                row => row[column]?.toLowerCase() === value;
                        }
                        break;
                    case 'startswith':
                        if (typeof value === 'object') {
                            throw new Error(`Invalid filter value: ${value}`);
                        } else if (typeof value === 'number') {
                            value = value.toString();
                            predicate = row => row[column]?.toString()?.startsWith(value);
                        } else {
                            predicate = caseSensitive ?
                                row => row[column]?.startsWith(value) :
                                row => row[column]?.toLowerCase()?.startsWith(value);
                        }
                        break;
                    case 'endswith':
                        if (typeof value === 'object') {
                            throw new Error(`Invalid filter value: ${value}`);
                        } else if (typeof value === 'number') {
                            value = value.toString();
                            predicate = row => row[column]?.toString()?.endsWith(value);
                        } else {
                            predicate = caseSensitive ?
                                row => row[column]?.endsWith(value) :
                                row => row[column]?.toLowerCase()?.endsWith(value);
                        }
                        break;
                    case 'isempty':
                        predicate = (row) => isEmpty(row[column]);
                        break;
                    case 'isnotempty':
                        predicate = (row) => !isEmpty(row[column]);
                        break;
                    case 'isanyof':
                        if (!Array.isArray(value)) {
                            throw new Error(`Invalid isanyof filter value: ${value}`);
                        } else {
                            predicate = (row) => caseSensitive ?
                                value.includes(row[column]) :
                                value.map(x => typeof (x) === 'string' ? x.toLowerCase() : x).includes(row[column]);
                        }
                        break;
                    case 'greaterthan':
                        if (typeof value === 'object') {
                            throw new Error(`Invalid filter value: ${value}`);
                        } else {
                            predicate = (row) => row[column] > value;
                        }
                        break;
                    case 'smallerthan':
                        if (typeof value === 'object') {
                            throw new Error(`Invalid filter value: ${value}`);
                        } else {
                            predicate = (row) => row[column] < value;
                        }
                        break;
                    default:
                        const str = `Invalid filter condition: ${condition}`;
                        throw new Error(str);
                };

                return predicate;
            };

            if (filter == null) return () => true;
            filter = typeof filter === 'string' ? JSON.parse(filter) : filter;
            const entries = Object.entries(filter);
            filter = {
                column: entries.find(([k, v]) => k.toLowerCase() === 'column')[1],
                condition: entries.find(([k, v]) => k.toLowerCase() === 'condition')[1],
                value: entries.find(([k, v]) => k.toLowerCase() === 'value')[1],
                caseSensitive: entries.find(([k, v]) => k.toLowerCase() === 'casesensitive')?.[1] ?? false,
                conditional: entries.find(([k, v]) => k.toLowerCase() === 'conditional')?.[1] ?? null,
            };

            let predicate = getPredicate(filter);

            if (filter.conditional) {
                let newPredicate = null;
                const conditionalPredicate = buildFilter(filter.conditional.filter);
                switch (filter.conditional.logicOperator) {
                    case 'and':
                        newPredicate = (row) => predicate(row) && conditionalPredicate(row);
                        break;
                    case 'or':
                        newPredicate = (row) => predicate(row) || conditionalPredicate(row);
                        break;
                    case 'xor':
                        newPredicate = (row) => predicate(row) !== conditionalPredicate(row);
                        break;
                    case 'nor':
                        newPredicate = (row) => !(predicate(row) || conditionalPredicate(row));
                        break;
                    default:
                        throw new Error(`Invalid logicOperator: ${filter.conditional.logicOperator}`);
                };
                return newPredicate;
            } else {
                return predicate;
            }
        };
        const buildSorter = (orders) => {

            const createSortCriteria = (order) => {
                let { column, type } = order;
                column = cache[tableName].schema.find(c => c.name?.toLowerCase() === column?.toLowerCase())?.name;

                if (type === 'asc') return (a, b) => a[column] < b[column];
                if (type === 'desc') return (a, b) => a[column] > b[column];

                throw new Error(`Invalid order type: ${type}`);
            };

            let criterias = orders.map(createSortCriteria);

            return (a, b) => {
                for (let i = 0; i < criterias.length; i++) {
                    let score = criterias[i](a, b);
                    if (score !== 0) return score;
                };
                return 0;
            };

        };

        const { pageNo, pageSize, order, filter } = parseQuery(query);
        let table = await getRows(tableName);

        let _filter = buildFilter(filter);
        let _sorter = buildSorter(order);

        let res = table.filter(_filter).sort(_sorter);

        return { rows: res.slice((pageNo) * pageSize, (pageNo + 1) * pageSize), totalCount: res.length };
    };

    const postRow = async (tableName, row) => {
        const tableSchema = schema[tableName];
        if (tableSchema == null) throw new Error(`Invalid table name: ${tableName}`); // Prevents SQL Injection

        const keys = Object.keys(row).filter(key => tableSchema.find(c => c.name === key));
        const values = keys.map(key => row[key]);
        const query = `INSERT INTO "${tableName}" ("${keys.join('", "')}") VALUES (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`;
        const result = await runQuery(query, values);
        //console.log({result})
        return result.rows[0];
    };
    const editRow = async (tableName, row) => {
        const tableSchema = schema[tableName];
        if (tableSchema == null) throw new Error(`Invalid table name: ${tableName}`);
        row[cdcEditedAt] = new Date().toISOString();
        const pks = tableSchema.filter(c => c.pk).map(c => c.name);
        const keys = Object.keys(row).filter(key => !pks.includes(key) && tableSchema.find(c => c.name === key));
        const values = keys.map(key => row[key]);
        const setStatement = keys.map((key, idx) => `"${key}" = $${idx + 1}`).join(', ');
        values.push(...pks.map(key => row[key]));

        const whereStatement = pks.map((key, idx) => `"${key}" = $${values.length - pks.length + idx + 1}`).join(' AND ');

        const query = `UPDATE "${tableName}" SET ${setStatement} WHERE ${whereStatement} RETURNING *;`;
        const result = await runQuery(query, values);
        return result.rows;
    };
    const delRow = async (tableName, row, hard = false) => {
        let result = null;
        const tableSchema = schema[tableName];
        if (tableSchema == null) throw new Error(`Invalid table name: ${tableName}`);
        const keys = Object.keys(row).filter(key => tableSchema.find(c => c.name === key));
        const values = keys.map(key => row[key]);
        if (hard) {
            const whereStatement = keys.map((key, idx) => `"${key}" = $${idx + 1}`).join(' AND ');
            const query = `DELETE FROM "${tableName}" WHERE ${whereStatement} RETURNING *;`;
            result = await runQuery(query, values);
        }
        else {
            //TODO: Implement soft delete, delete fk's and cdc's
            const whereStatement = keys.map((key, idx) => `"${key}" = $${idx + 1}`).join(' AND ');
            const query = `UPDATE "${tableName}" SET "deleted" = true WHERE ${whereStatement} RETURNING *;`;
            result = await runQuery(query, values);
        }
        return result.rows;
    };
    const logInit = async () => {
        info(`Tables Schema,Cache & OnNotification Ready in ${((Date.now() - start) / 1000).toFixed(2)}s!`);
        info(` * ${Object.keys(schema).length} Tables Loaded`);
        info(` * ${Object.values(await getCache()).reduce((p, x) => p + x.rows.length, 0)} Total Rows`);
    };

    logInit();
    //fs.writeFileSync('./cache.json', JSON.stringify(await getCache(), null, 2));
    return { schema, schemaHash, getCache, runQuery, getRows, getRow, getPaginatedRows, postRow, editRow, delRow };
};

export const { schema, schemasHash, getCache, runQuery, getRows, getRow, getPaginatedRows, postRow, editRow, delRow } = await init();


export default { getCache, runQuery, getRows, getRow, getPaginatedRows, postRow, editRow, delRow, };
