import { defineConfig } from "drizzle-kit";
import env from "./config/env"; // Asegúrate de que la ruta sea correcta

const { user, password, database, host, port } = env.ddbb.connection;
const url = `postgresql://${user}:${password}@${host}:${port}/${database}`;

export default defineConfig({
  schema: "./src/drizzle/schema.ts", // Ruta a tu schema
  out: "./migrations", // Carpeta donde se guardarán las migraciones
  dialect: "postgresql", // 🔹 Agrega esto
  dbCredentials: {
    url, // 🔹 Usa "url" en lugar de "connectionString"
  },
});
