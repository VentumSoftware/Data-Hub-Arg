import env from './config/env.js';
import knex from 'knex';
const db = knex({
  ...env.ddbb,
  client: 'postgresql',
});

console.log(env.ddbb)
async function checkPool() {
  console.log('Conexiones en uso:', db.client.pool.numUsed());
  console.log('Conexiones disponibles:', db.client.pool.numFree());
  console.log('Conexiones en espera:', db.client.pool.numPendingAcquires());
  console.log('Conexiones destruidas:', db.client.pool.numPendingCreates());
}

//setInterval(checkPool, 5000); // Imprime el estado del pool cada 5 segundos
// Export the Knex instance

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
  development: {
    ...env.ddbb,
    client: 'postgresql',
  },
};
