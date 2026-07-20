import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(cors());
app.use(express.json());

function createId() {
  return crypto.randomBytes(16).toString("hex");
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows, fallbackHeaders = []) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : fallbackHeaders;

  if (headers.length === 0) {
    return "";
  }

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(",")
    ),
  ];

  return csvRows.join("\n");
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      language TEXT NOT NULL,
      label TEXT NOT NULL,
      code TEXT NOT NULL,
      intention TEXT,
      active BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS profile_questions (
      id TEXT PRIMARY KEY,
      question_pt TEXT NOT NULL,
      question_en TEXT,
      type TEXT NOT NULL,
      options JSONB,
      active BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS profile_answers (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS choices (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      round_number INTEGER,
      category TEXT,
      left_snippet_id TEXT,
      right_snippet_id TEXT,
      selected_snippet_id TEXT,
      selected_language TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS final_results (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "API is running", database: "connected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Database connection failed" });
  }
});

app.get("/api/snippets", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM snippets
      WHERE active = true
      ORDER BY category ASC, language ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load snippets" });
  }
});

app.get("/api/profile-questions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM profile_questions
      WHERE active = true
      ORDER BY id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load profile questions" });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const id = createId();
    const createdAt = new Date().toISOString();
    const userAgent = req.headers["user-agent"] || "";

    await pool.query(
      `
      INSERT INTO game_sessions (id, created_at, user_agent)
      VALUES ($1, $2, $3)
      `,
      [id, createdAt, userAgent]
    );

    res.status(201).json({ sessionId: id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create session" });
  }
});

app.post("/api/profile-answers", async (req, res) => {
  try {
    const { sessionId, questionId, answer } = req.body;

    if (!sessionId || !questionId) {
      return res.status(400).json({
        error: "sessionId and questionId are required",
      });
    }

    await pool.query(
      `
      INSERT INTO profile_answers (
        session_id,
        question_id,
        answer,
        created_at
      )
      VALUES ($1, $2, $3, $4)
      `,
      [sessionId, questionId, answer || "", new Date().toISOString()]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save profile answer" });
  }
});

app.post("/api/choices", async (req, res) => {
  try {
    const {
      sessionId,
      roundNumber,
      category,
      leftSnippetId,
      rightSnippetId,
      selectedSnippetId,
      selectedLanguage,
    } = req.body;

    if (!sessionId || !selectedSnippetId) {
      return res.status(400).json({
        error: "sessionId and selectedSnippetId are required",
      });
    }

    await pool.query(
      `
      INSERT INTO choices (
        session_id,
        round_number,
        category,
        left_snippet_id,
        right_snippet_id,
        selected_snippet_id,
        selected_language,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        sessionId,
        roundNumber || null,
        category || "",
        leftSnippetId || "",
        rightSnippetId || "",
        selectedSnippetId,
        selectedLanguage || "",
        new Date().toISOString(),
      ]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save choice" });
  }
});

app.post("/api/final-results", async (req, res) => {
  try {
    const { sessionId, result } = req.body;

    if (!sessionId || !result) {
      return res.status(400).json({
        error: "sessionId and result are required",
      });
    }

    const now = new Date().toISOString();

    await pool.query(
      `
      INSERT INTO final_results (session_id, result_json, created_at)
      VALUES ($1, $2, $3)
      `,
      [sessionId, JSON.stringify(result), now]
    );

    await pool.query(
      `
      UPDATE game_sessions
      SET finished_at = $1
      WHERE id = $2
      `,
      [now, sessionId]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save final result" });
  }
});

app.get("/api/export/choices.csv", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.session_id,
        s.created_at AS session_created_at,
        c.round_number,
        c.category,
        c.left_snippet_id,
        c.right_snippet_id,
        c.selected_snippet_id,
        c.selected_language,
        c.created_at AS choice_created_at
      FROM choices c
      LEFT JOIN game_sessions s ON s.id = c.session_id
      ORDER BY c.created_at ASC
    `);

    const csv = rowsToCsv(result.rows, [
      "session_id",
      "session_created_at",
      "round_number",
      "category",
      "left_snippet_id",
      "right_snippet_id",
      "selected_snippet_id",
      "selected_language",
      "choice_created_at",
    ]);

    res.header("Content-Type", "text/csv");
    res.attachment("choices.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not export choices" });
  }
});

app.get("/api/export/profile-answers.csv", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pa.session_id,
        s.created_at AS session_created_at,
        pa.question_id,
        pq.question_pt,
        pq.question_en,
        pa.answer,
        pa.created_at AS answer_created_at
      FROM profile_answers pa
      LEFT JOIN game_sessions s ON s.id = pa.session_id
      LEFT JOIN profile_questions pq ON pq.id = pa.question_id
      ORDER BY pa.created_at ASC
    `);

    const csv = rowsToCsv(result.rows, [
      "session_id",
      "session_created_at",
      "question_id",
      "question_pt",
      "question_en",
      "answer",
      "answer_created_at",
    ]);

    res.header("Content-Type", "text/csv");
    res.attachment("profile-answers.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not export profile answers" });
  }
});

app.get("/api/export/final-results.csv", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        fr.session_id,
        s.created_at AS session_created_at,
        s.finished_at AS session_finished_at,
        fr.result_json,
        fr.created_at AS result_created_at
      FROM final_results fr
      LEFT JOIN game_sessions s ON s.id = fr.session_id
      ORDER BY fr.created_at ASC
    `);

    const csv = rowsToCsv(result.rows, [
      "session_id",
      "session_created_at",
      "session_finished_at",
      "result_json",
      "result_created_at",
    ]);

    res.header("Content-Type", "text/csv");
    res.attachment("final-results.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not export final results" });
  }
});

const PORT = process.env.PORT || 50820;

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });