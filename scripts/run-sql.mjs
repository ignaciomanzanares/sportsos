// Corre un archivo .sql directo contra Postgres usando SUPABASE_DB_URL
// (definido en .env.local, nunca en git). Uso: node scripts/run-sql.mjs archivo.sql
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/run-sql.mjs <archivo.sql>");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Falta SUPABASE_DB_URL en .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];
  for (const r of results) {
    if (r.rows && r.rows.length > 0) {
      console.log(`(${r.rows.length} filas)`);
      console.table(r.rows);
    }
  }
  console.log(`✅ ${file} ejecutado correctamente.`);
} catch (err) {
  console.error("❌ Error ejecutando SQL:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
