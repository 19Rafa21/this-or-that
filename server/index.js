import "dotenv/config";
import pg from "pg";
import { createApp } from "./app.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 15000,
});

const port = process.env.PORT || 50820;
pool.query("SELECT 1").then(() => {
  createApp(pool).listen(port, () => console.log(`API running on http://localhost:${port}`));
}).catch((error) => {
  console.error("Failed to initialize database:", error.code || error.name);
  process.exitCode = 1;
  pool.end();
});
