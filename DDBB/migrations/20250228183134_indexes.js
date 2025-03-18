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
                    { "id": 2, "name": "Dolar", "symbol": "U$" },
                    { "id": 3, "name": "CAC", "symbol": "CAC" },
                    { "id": 4, "name": "Dolar MEP", "symbol": "MEP" },
                    { "id": 5, "name": "UVA", "symbol": "UVA" },
                ]);
            });
        })
        .then(() => {return  knex.raw(`ALTER SEQUENCE "currencies_id_seq" RESTART WITH ${6};`)})
};

export const down = function (knex) {
    knex.destroy();
    return knex.schema
        .then(() => knex.schema.dropTableIfExists('indexes'))
        .then(() => knex.schema.dropTableIfExists('currencies'))
};

export const config = { transaction: true };
