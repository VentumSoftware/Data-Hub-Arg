import knex from 'knex';
import env from '../config/env.js';

const connection = knex({...env.ddbb})
let tables = {};

export const getSchema = await (async () => {
    let res = await connection.raw('SELECT * FROM information_schema.columns');
    res = res.rows.reduce((p, x) => {
        p[x.table_catalog] = p[x.table_catalog] || {};
        p[x.table_catalog][x.table_schema] = p[x.table_catalog][x.table_schema] || {};
        p[x.table_catalog][x.table_schema][x.table_name] = p[x.table_catalog][x.table_schema][x.table_name] || [];
        p[x.table_catalog][x.table_schema][x.table_name] = [...p[x.table_catalog][x.table_schema][x.table_name], {
            columnName: x["column_name"],
            ordinalPosition: x["ordinal_position"],
            columnDefault: x["column_default"],
            isNullable: x["is_nullable"],
            dataType: x["data_type"],
            characterMaximumLength: x["character_maximum_length"],
            characterOctetLength: x["character_octet_length"],
            numericPrecision: x["numeric_precision"],
            numericPrecisionRadix: x["numeric_precision_radix"],
            numericScale: x["numeric_scale"],
            datetimePrecision: x["datetime_precision"],
            intervalType: x["interval_type"],
            intervalPrecision: x["interval_precision"],
        }]
        return p;
    }, {});
    return () => res;
})();
export const get = async (tableName, where) => {
    if(tableName.toLowerCase().startsWith('cdc')) return (await connection.select('*').from(tableName));

    tables[tableName] = tables[tableName] != null ? tables[tableName] : (await connection.select('*').from(tableName));
 
    return where ? tables[tableName].filter(where) : tables[tableName];
};
/**
* @param {string} tableName -> name of SQL table
* @param {function} where -> find function
* @param {function} dflt -> return this if no result is found
* @returns {Promise<Object>} a Promise with the selected values
*/
export const find = async (tableName, where, dflt = null) => {
    tables[tableName] = tables[tableName] != null ? tables[tableName] : (await connection.select('*').from(tableName));
    return tables[tableName].find(where) || dflt;
};
/**
* @param {string} tableName -> name of SQL table
* @param {object} value -> row/s to insert
* @param {Array} returning -> names of the columns of the inserted rows I want to get back
* @returns {Promise} a Promise with the selected values //TODO: ADD PROMISE RETURN TYPE
*/
export const add = async (tableName, values, returning = ['*']) => {
    values = Array.isArray(values) ? values : [values];
    values.map(r => Object.entries(r).forEach(([k, v]) => v == undefined ? delete r[k] : null))

    values = values;

    returning ? returning = returning : null;
    let res = await connection.insert(values).returning(returning).into(tableName).catch(console.log('Error'));

    res = returning && Array.isArray(res) ? res : res;

    tables[tableName] = (await connection.select('*').from(tableName));
    return res;
};
/**
* @param {string} tableName -> name of SQL table
* @param {function} where -> filter
* @returns {Promise} a Promise with the selected values
*/
//TODO: add returning logic
export const del = async (tableName, where, returning = ['*']) => {
    const res = [];
    !tables[tableName] ? tables[tableName] = (await connection.select('*').from(tableName)) : null;
    let toDel = tables[tableName].filter(where);
    toDel.forEach(obj => Object.keys(obj).forEach(k => obj[k] === null ? delete obj[k] : null));
    toDel = toDel;
    for (let i = 0; i < toDel.length; i++) {
        res.push(await connection(tableName).whereIn(Object.keys(toDel[i]), [Object.values(toDel[i])]).del());
    }
    tables[tableName] = (await connection.select('*').from(tableName));
    return res;
};
/**
* @param {string} tableName -> name of SQL table
* @param {function} where -> filter
* @param {object} value -> values to edit
* @returns {Promise<Array>} a Promise with the selected values
*/
export const edit = async (tableName, where, value, returning = ['*']) => {
    const res = [];
    !tables[tableName] ? tables[tableName] = (await connection.select('*').from(tableName)) : null;
    let toUpdt = tables[tableName].filter(where);
    toUpdt.forEach(obj => Object.keys(obj).forEach(k => obj[k] === null ? delete obj[k] : null));

    //filter propertys that are not in columns NOT WORKING
    // const columnNames = Object.keys((await getSchema()).pfc.public);
    // value = Object.entries(value).reduce((p, x) => {
    //     columnNames.includes(x[0]) ? p[x[0]] = x[1] : null;
    //     return p;
    // }, {});
    Object.entries(value).forEach(([k, v]) => v === undefined ? delete value[k] : null);
    value = keysToPC(value);
    for (let i = 0; i < toUpdt.length; i++) {
        res.push(await connection(tableName).whereIn(Object.keys(toUpdt[i]), [Object.values(toUpdt[i])]).update(value).returning(returning));
    }
    tables[tableName] = (await connection.select('*').from(tableName));
    return res.flat();
};


export const raw = connection.raw;
/**
* @param {string} tableName -> name of SQL table
* @param {function} cb callback
*/

export default { get, add, del, edit, raw, getSchema}