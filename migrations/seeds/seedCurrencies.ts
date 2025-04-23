import { db } from "../../src/drizzle/index"; // Ajusta la ruta según tu estructura
import { currencies, indexes } from "../../src/drizzle/schema"; // Importa la tabla

const seedData = [
  { id: 1, name: "Dolar 2000", symbol: "US2000" },
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
  { id: 13,name: "UVA", symbol: "UVA" },

];

async function seedCurrencies() {
  try {
    console.log("🔹 Insertando datos en currencies...");
    await db.insert(currencies).values(seedData).onConflictDoNothing();
    console.log("✅ Datos insertados correctamente.");

    // 🔹 Ajustar la secuencia para que continúe desde el último ID insertado
    const nextId = seedData.length + 1;
    console.log(`🔄 Reiniciando secuencia currencies_id_seq en ${nextId}...`);
    await db.execute(
      `ALTER SEQUENCE currencies_id_seq RESTART WITH ${nextId};`
    );
    console.log("✅ Secuencia actualizada correctamente.");
  } catch (err) {
    console.error("❌ Error insertando datos:", err);
  } finally {
    process.exit(0);
  }
}

seedCurrencies();
