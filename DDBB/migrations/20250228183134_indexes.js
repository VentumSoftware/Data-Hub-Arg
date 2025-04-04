export const up = function (knex) {
    return knex.schema
        .then(() => {
            return knex.schema.createTable('currencies', table => {
                table.increments('id').primary()
                table.string('name')
                table.string('symbol')
            })
        })
        .then(() => {
            return knex.schema.createTable('indexes', table => {
                table.increments('id').primary()
                table.date('date')
                table.integer('currency').references('id').inTable('currencies').onDelete('CASCADE')
                table.float('value').notNullable()
            })
        })
        .then(() => {
            return knex('currencies').del().then(() => {
                return knex('currencies').insert([
                    { "id": 1, "name": "Peso", "symbol": "$" },
                    { "id": 2, "name": "CAC", "symbol": "CAC" },
                    { "id": 3, "name": "UVA", "symbol": "UVA" },
                    { "id": 4, "name": "Dolar Venta", "symbol": "U$" },
                    { "id": 5, "name": "Dolar Compra", "symbol": "U$" },
                    { "id": 6, "name": "Dolar MEP Venta", "symbol": "MEP" },
                    { "id": 7, "name": "Dolar MEP Compra", "symbol": "MEP" },
                    { "id": 8, "name": 'Dolar Oficial Venta', "symbol": 'OFICIAL' },
                    { "id": 9, "name": 'Dolar Oficial Compra', "symbol": 'OFICIAL' }
                ]);
            });
        })
        .then(() => {return  knex.raw(`ALTER SEQUENCE "currencies_id_seq" RESTART WITH ${10};`)})
};

export const down = function (knex) {
    knex.destroy();
    return knex.schema
        .then(() => knex.schema.dropTableIfExists('indexes'))
        .then(() => knex.schema.dropTableIfExists('currencies'))
};

export const config = { transaction: true };
