import { integer, pgTable, serial, text, varchar, real } from "drizzle-orm/pg-core";

export const currencies = pgTable("currencies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  symbol: varchar("symbol"),
});
export const relationsCurrencies = pgTable("relationsCurrencies", {
  id: serial("id").primaryKey(),
  divisorId: integer("divisorId").notNull().references(() => currencies.id, { onDelete: "cascade" }),//Moneda en la que estoy guardando el valor
  dividendoId: integer("dividendoId").notNull().references(() => currencies.id, { onDelete: "cascade" }),//Moneda que estoy guardando
});
export const indexes = pgTable("indexes", {
  //id: serial("id").primaryKey(),
  date: varchar("date", { length: 255 }).notNull(),
  value: real("value").notNull(),
  relationsCurrencies: integer("relationsCurrencies").notNull().references(() => relationsCurrencies.id, { onDelete: "cascade" }),
  // divisorId: integer("divisorId").notNull().references(() => currencies.id, { onDelete: "cascade" }),//Moneda en la que estoy guardando el valor
  // dividendoId: integer("dividendoId").notNull().references(() => currencies.id, { onDelete: "cascade" }),//Moneda que estoy guardando
});

// Type definitions
export type Currency = {
  id: number;
  name: string;
  symbol?: string;
  //ref?: number;
};

export type RelationsCurrencies = {
  id: number;
  divisorId: number;
  dividendoId: number;
};
export type Index = {
  // id: number;
   date: string;
   //currency: number;
   value: number;
   relationsCurrencies: number;
   // divisorId: number;
   // dividendoId: number;
 };

// import { db } from "../../src/drizzle/index"; // Ajusta la ruta según tu estructura
// import { currencies, indexes } from "../../src/drizzle/schema"; // Importa la tabla

// const seedData = [
//   { id: 1, name: "Dolar 2000", symbol: "US2000", ref: null },
//   { id: 2, name: "Dolar Billete", symbol: "U$", ref: 1 },//Dolar Libre
//   { id: 3, name: "Peso", symbol: "$", ref: 2 },
//   { id: 4,name: "Dolar Venta", symbol: "U$", ref: 3 },
//   { id: 5,name: "Dolar Compra", symbol: "U$", ref: 3 },
//   { id: 6,name: "Dolar MEP Venta", symbol: "MEP", ref: 3 },
//   { id: 7,name: "Dolar MEP Compra", symbol: "MEP", ref: 3 },
//   { id: 8,name: "Dolar MEP", symbol: "MEP", ref: 3 },
//   { id: 9,name: "Dolar Oficial Venta", symbol: "OFICIAL", ref: 3 },
//   { id: 10,name: "Dolar Oficial Compra", symbol: "OFICIAL", ref: 3 },
//   { id: 11,name: "Dolar Oficial", symbol: "OFICIAL", ref: 3 },
//   { id: 12,name: "CAC", symbol: "CAC", ref: 3 },
//   { id: 13,name: "UVA", symbol: "UVA", ref: 3 },

// ];

// async function seedCurrencies() {
//   try {
//     console.log("🔹 Insertando datos en currencies...");
//     await db.insert(currencies).values(seedData).onConflictDoNothing();
//     console.log("✅ Datos insertados correctamente.");

//     // 🔹 Ajustar la secuencia para que continúe desde el último ID insertado
//     const nextId = seedData.length + 1;
//     console.log(`🔄 Reiniciando secuencia currencies_id_seq en ${nextId}...`);
//     await db.execute(
//       `ALTER SEQUENCE currencies_id_seq RESTART WITH ${nextId};`
//     );
//     console.log("✅ Secuencia actualizada correctamente.");
//   } catch (err) {
//     console.error("❌ Error insertando datos:", err);
//   } finally {
//     process.exit(0);
//   }
// }

// seedCurrencies();



const monedas = [ { id: 1, name: "Dolar 2000", symbol: "US2000" },
  { id: 2, name: "Dolar Libre", symbol: "U$" },//Dolar Libre
  { id: 3, name: "Peso", symbol: "$" },
  { id: 4,name: "Dolar Venta", symbol: "U$" },
  { id: 5,name: "Dolar Compra", symbol: "U$" },
  { id: 6,name: "Dolar MEP Venta", symbol: "MEP" },
  { id: 7,name: "Dolar MEP Compra", symbol: "MEP" },
  { id: 8,name: "Dolar MEP", symbol: "MEP" },
  { id: 9,name: "Dolar Oficial Venta", symbol: "OFICIAL" },
  { id: 10,name: "Dolar Oficial Compra", symbol: "OFICIAL" },
  { id: 11,name: "Dolar Oficial", symbol: "OFICIAL" },
  { id: 12,name: "CAC", symbol: "CAC" },
  { id: 13,name: "UVA", symbol: "UVA" },];
  const relacionesMonedas = [
    {
      "id": 1,
      "value": 1.8696978,
      "divisorId": 1,
      "dividendoId": 1,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 2,
      "value": 0.0009049774,
      "divisorId": 2,
      "dividendoId": 3,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 3,
      "value": 1105,
      "divisorId": 3,
      "dividendoId": 2,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 4,
      "value": 1012,
      "divisorId": 3,
      "dividendoId": 11,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 5,
      "value": 1090,
      "divisorId": 3,
      "dividendoId": 5,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 6,
      "value": 1120,
      "divisorId": 3,
      "dividendoId": 4,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 7,
      "value": 992,
      "divisorId": 3,
      "dividendoId": 10,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 8,
      "value": 1032,
      "divisorId": 3,
      "dividendoId": 9,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 9,
      "value": 15356.4,
      "divisorId": 3,
      "dividendoId": 12,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 10,
      "value": 1267.86,
      "divisorId": 3,
      "dividendoId": 13,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 11,
      "value": 1068.89,
      "divisorId": 3,
      "dividendoId": 8,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 12,
      "value": 1068.89,
      "divisorId": 3,
      "dividendoId": 7,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    },
    {
      "id": 13,
      "value": 1068.89,
      "divisorId": 3,
      "dividendoId": 6,
      "parsedDate": "2080-08-01T03:00:00.000Z"
    }]
const indices = [{

  dividendoId: 1,
  divisorId: 2,
},
{

  dividendoId: 1, 
  divisorId: 3,
},
{
  
  dividendoId: 1,
divisorId: 4,
},
{

  dividendoId: 4,
divisorId: 3,
},
{

  dividendoId: 5,
divisorId: 2,
},]

const getAllPosiblePaths = (chain) => {
  let lastNode = chain[chain.length - 1]
  let posibleNodes = indices.filter(x=> !chain.find(y=> y.dividendoId === x.dividendoId && y.divisorId === x.divisorId))
  posibleNodes = posibleNodes.filter(x=> [lastNode.divisorId, lastNode.dividendoId].includes(x.dividendoId) || [lastNode.divisorId, lastNode.dividendoId].includes(x.divisorId));
  if(posibleNodes.length === 0) {return [chain]} else {
    let paths = []
    for(let i = 0; i < posibleNodes.length; i++){
      let newChain = [...chain, posibleNodes[i]]
      paths.push(...getAllPosiblePaths(newChain))
    }
    return paths
  }
}

getAllPosiblePaths([{
  valor: 1,
  dividendoId: 1,
  divisorId: 2,
}])

