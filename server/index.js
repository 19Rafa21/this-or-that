import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { Parser } from "json2csv";

const app = express();
const db = new Database("database.sqlite");

app.use(cors());
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    language TEXT NOT NULL,
    label TEXT NOT NULL,
    code TEXT NOT NULL,
    intention TEXT,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS profile_questions (
    id TEXT PRIMARY KEY,
    question_pt TEXT NOT NULL,
    question_en TEXT,
    type TEXT NOT NULL,
    options TEXT,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    user_agent TEXT
  );

  CREATE TABLE IF NOT EXISTS profile_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS choices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    round_number INTEGER,
    category TEXT,
    left_snippet_id TEXT,
    right_snippet_id TEXT,
    selected_snippet_id TEXT,
    selected_language TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS final_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API is running" });
});

app.get("/api/snippets", (req, res) => {
  const snippets = db
    .prepare("SELECT * FROM snippets WHERE active = 1")
    .all();

  res.json(snippets);
});

app.get("/api/profile-questions", (req, res) => {
  const questions = db
    .prepare("SELECT * FROM profile_questions WHERE active = 1")
    .all()
    .map((question) => ({
      ...question,
      options: question.options ? JSON.parse(question.options) : [],
    }));

  res.json(questions);
});

app.post("/api/sessions", (req, res) => {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const userAgent = req.headers["user-agent"] || "";

  db.prepare(`
    INSERT INTO game_sessions (id, created_at, user_agent)
    VALUES (?, ?, ?)
  `).run(id, createdAt, userAgent);

  res.status(201).json({ sessionId: id });
});

app.post("/api/profile-answers", (req, res) => {
  const { sessionId, questionId, answer } = req.body;

  if (!sessionId || !questionId) {
    return res.status(400).json({
      error: "sessionId and questionId are required",
    });
  }

  db.prepare(`
    INSERT INTO profile_answers (session_id, question_id, answer, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    sessionId,
    questionId,
    answer || "",
    new Date().toISOString()
  );

  res.status(201).json({ ok: true });
});

app.post("/api/choices", (req, res) => {
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

  db.prepare(`
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    roundNumber || null,
    category || "",
    leftSnippetId || "",
    rightSnippetId || "",
    selectedSnippetId,
    selectedLanguage || "",
    new Date().toISOString()
  );

  res.status(201).json({ ok: true });
});

app.post("/api/final-results", (req, res) => {
  const { sessionId, result } = req.body;

  if (!sessionId || !result) {
    return res.status(400).json({
      error: "sessionId and result are required",
    });
  }

  db.prepare(`
    INSERT INTO final_results (session_id, result_json, created_at)
    VALUES (?, ?, ?)
  `).run(
    sessionId,
    JSON.stringify(result),
    new Date().toISOString()
  );

  db.prepare(`
    UPDATE game_sessions
    SET finished_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), sessionId);

  res.status(201).json({ ok: true });
});

app.get("/api/export/choices.csv", (req, res) => {
  const rows = db.prepare(`
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
  `).all();

  const parser = new Parser();
  const csv = parser.parse(rows);

  res.header("Content-Type", "text/csv");
  res.attachment("choices.csv");
  res.send(csv);
});

const PORT = process.env.PORT || 50820;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});