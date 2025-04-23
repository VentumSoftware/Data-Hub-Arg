import { db } from "../../src/drizzle/index"; // Ajusta la ruta según tu estructura
import { currencies, indexes, relationsCurrencies } from "../../src/drizzle/schema"; // Importa la tabla

const seedData = [
  { id: 1, divisorId: 2, dividendoId: 1 },//Dolar 2000
  { id: 2, divisorId: 2, dividendoId: 3 },//Peso/Dolar Libre
  { id: 3, divisorId: 3, dividendoId: 2 },//Dolar Libre/Peso
  { id: 4,divisorId: 3, dividendoId: 4 },//Dolar 2000
  { id: 5,divisorId: 3, dividendoId: 5 },//Dolar 2000
  { id: 6,divisorId: 3, dividendoId: 6 },//Dolar 2000
  { id: 7,divisorId: 3, dividendoId: 7 },//Dolar 2000
  { id: 8,divisorId: 3, dividendoId: 8 },//Dolar 2000
  { id: 9,divisorId: 3, dividendoId: 9 },//Dolar 2000
  { id: 10,divisorId: 3, dividendoId: 10 },//Dolar 2000
  { id: 11,divisorId: 3, dividendoId: 11 },//Dolar 2000
  { id: 12,divisorId: 3, dividendoId: 12 },//Dolar 2000
  { id: 13,divisorId: 3, dividendoId: 13 },//Dolar 2000

];

async function seedRelationsCurrencies() {
  try {
    console.log("🔹 Insertando datos en relationsCurrencies...");
    await db.insert(relationsCurrencies).values(seedData).onConflictDoNothing();
    console.log("✅ Datos insertados correctamente.");

    // 🔹 Ajustar la secuencia para que continúe desde el último ID insertado
    const nextId = seedData.length + 1;
    console.log(`🔄 Reiniciando secuencia "relationsCurrencies_id_seq" en ${nextId}...`);
    await db.execute(
      `ALTER SEQUENCE "relationsCurrencies_id_seq" RESTART WITH ${nextId};`
    );
    console.log("✅ Secuencia actualizada correctamente.");
  } catch (err) {
    console.error("❌ Error insertando datos:", err);
  } finally {
    process.exit(0);
  }
}

seedRelationsCurrencies();
