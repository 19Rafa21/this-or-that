import "dotenv/config";
import pg from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rowsToCsv, exportQueries } from "./exports.js";
import { exportXlsx } from "./export-xlsx.js";

const backup = process.argv.includes("--backup");
const directory = resolve(backup ? "backups" : "exports", new Date().toISOString().replaceAll(":", "-"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const tables = ["datasets", "snippets", "comparisons", "profile_questions", "game_sessions", "profile_answers", "choices", "final_results"];
try {
  if (process.argv.includes("--xlsx") && !backup) {
    const buffer = await exportXlsx(pool);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, "this-or-that.xlsx"), buffer, { mode: 0o600, flag: "wx" });
    console.log(directory);
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if (backup) {
        const snapshot = { format: "this-or-that-data-v1", createdAt: new Date().toISOString(), tables: {} };
        for (const table of tables) snapshot.tables[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
        await writeFile(resolve(directory, "snapshot.json"), JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: "wx" });
        console.log("Data snapshot saved. Keep schema.js with this file; this is not a pg_dump backup.");
      } else {
        for (const [name, query] of Object.entries(exportQueries)) {
          const result = await client.query(query);
          await writeFile(resolve(directory, `${name}.csv`), rowsToCsv(result.rows, result.fields.map((field) => field.name)), { mode: 0o600, flag: "wx" });
          console.log(`${name}: ${result.rowCount} rows`);
        }
      }
      await client.query("COMMIT");
      console.log(directory);
    } finally { client.release(); }
  }
} catch (error) {
  console.error("Export failed:", error.code || error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
