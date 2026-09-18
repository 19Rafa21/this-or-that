import express from "express";
import cors from "cors";
import { randomBytes } from "node:crypto";
import { DATASET } from "./seed-data.js";
import { InputError, replayTournament, buildFinalResult } from "./tournament.js";
import { authorizeExport, exportQueries, rowsToCsv } from "./exports.js";
import { exportXlsx } from "./export-xlsx.js";

async function loadDataset(client, datasetId) {
  const comparisons = await client.query(`SELECT c.id, c.category, c.dataset_id,
    to_jsonb(a) AS snippet_a, to_jsonb(b) AS snippet_b FROM comparisons c
    JOIN snippets a ON a.id = c.snippet_a_id JOIN snippets b ON b.id = c.snippet_b_id
    WHERE c.dataset_id = $1 AND c.active AND a.active AND b.active
    AND a.dataset_id = c.dataset_id AND b.dataset_id = c.dataset_id ORDER BY c.id`, [datasetId]);
  const questions = await client.query(`SELECT id, question_pt, question_en, type, options, display_order
    FROM profile_questions WHERE dataset_id = $1 AND active ORDER BY display_order`, [datasetId]);
  return { comparisons: comparisons.rows, profileQuestions: questions.rows };
}

export function createApp(pool) {
  const app = express();
  const origins = process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim());
  app.use(cors(origins ? { origin: origins } : {}));
  app.use(express.json({ limit: "100kb" }));
  app.disable("x-powered-by");

  const route = (handler) => async (req, res, next) => {
    try { await handler(req, res); } catch (error) { next(error); }
  };
  const sessionRoute = (handler) => route(async (req, res) => {
    if (typeof req.body?.sessionId !== "string") throw new InputError("sessionId is required");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const session = (await client.query(`SELECT s.*, d.version FROM game_sessions s
        JOIN datasets d ON d.id = s.dataset_id WHERE s.id = $1 FOR UPDATE OF s`, [req.body.sessionId])).rows[0];
      if (!session) throw new InputError("Unknown session", 404);
      if (session.dataset_id !== DATASET.id) throw new InputError("Please start a new session with the current prototype", 409);
      const result = await handler(req.body, client, session);
      await client.query("COMMIT");
      res.status(201).json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  });

  app.get("/api/health", route(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected", protocolVersion: 4, datasetVersion: DATASET.version });
  }));

  app.post("/api/sessions", route(async (req, res) => {
    const language = req.body?.language || "pt";
    if (!["pt", "en"].includes(language)) throw new InputError("Invalid interface language");
    const dataset = (await pool.query("SELECT id, version FROM datasets WHERE active")).rows[0];
    if (dataset?.id !== DATASET.id) throw new InputError("The current dataset must be seeded before starting the game", 503);
    const content = await loadDataset(pool, dataset.id);
    replayTournament(content.comparisons, []);
    const id = randomBytes(16).toString("hex");
    await pool.query("INSERT INTO game_sessions (id, dataset_id, interface_language) VALUES ($1, $2, $3)", [id, dataset.id, language]);
    res.status(201).json({ sessionId: id, datasetId: dataset.id, datasetVersion: dataset.version, ...content });
  }));

  for (const path of ["/api/comparisons", "/api/v2/profile-questions", "/api/profile-questions", "/api/snippets"]) {
    app.get(path, route(async (_req, res) => {
      const dataset = (await pool.query("SELECT id FROM datasets WHERE active")).rows[0];
      if (!dataset) throw new InputError("No active dataset", 503);
      const content = await loadDataset(pool, dataset.id);
      if (path === "/api/comparisons") return res.json(content.comparisons);
      if (path === "/api/snippets") return res.json((await pool.query("SELECT * FROM snippets WHERE dataset_id = $1 AND active", [dataset.id])).rows);
      res.json(content.profileQuestions);
    }));
  }

  app.post("/api/choices", sessionRoute(async (body, client, session) => {
    const { comparisons } = await loadDataset(client, session.dataset_id);
    const choices = (await client.query("SELECT * FROM choices WHERE session_id = $1 ORDER BY round_number", [session.id])).rows;
    const choice = {
      comparison_id: body.comparisonId, round_number: body.roundNumber, category: body.category,
      left_snippet_id: body.leftSnippetId, right_snippet_id: body.rightSnippetId,
      selected_snippet_id: body.selectedSnippetId === "skipped" ? null : body.selectedSnippetId,
      skipped: body.selectedSnippetId === "skipped",
    };
    const existing = choices.find((item) => item.round_number === choice.round_number);
    if (existing) {
      if (Object.entries(choice).every(([key, value]) => existing[key] === value)) return { ok: true };
      throw new InputError("This round was already saved with another choice", 409);
    }
    if (session.finished_at) throw new InputError("Session already finished", 409);
    replayTournament(comparisons, [...choices, choice]);
    const comparison = comparisons.find((item) => item.id === choice.comparison_id);
    const selected = [comparison.snippet_a, comparison.snippet_b].find((item) => item.id === choice.selected_snippet_id);
    await client.query(`INSERT INTO choices (session_id, comparison_id, round_number, category,
      left_snippet_id, right_snippet_id, selected_snippet_id, selected_language, selected_style, skipped)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [session.id, choice.comparison_id, choice.round_number,
      choice.category, choice.left_snippet_id, choice.right_snippet_id, choice.selected_snippet_id,
      selected?.language || null, selected?.style || null, choice.skipped]);
    return { ok: true };
  }));

  app.post("/api/profile-answers", sessionRoute(async (body, client, session) => {
    const { profileQuestions } = await loadDataset(client, session.dataset_id);
    const question = profileQuestions.find((item) => item.id === body.questionId);
    if (!question || (body.answer !== "skipped" && !question.options.some((item) => item.value === body.answer))) throw new InputError("Invalid profile answer");
    const existing = (await client.query("SELECT answer_value FROM profile_answers WHERE session_id = $1 AND question_id = $2", [session.id, question.id])).rows[0];
    if (existing?.answer_value === body.answer) return { ok: true };
    if (existing || session.finished_at) throw new InputError("Answer already saved or session finished", 409);
    await client.query("INSERT INTO profile_answers (session_id, question_id, answer_value) VALUES ($1,$2,$3)", [session.id, question.id, body.answer]);
    return { ok: true };
  }));

  app.post("/api/final-results", sessionRoute(async (_body, client, session) => {
    const existing = (await client.query("SELECT result_json FROM final_results WHERE session_id = $1", [session.id])).rows[0];
    if (existing) return { ok: true, result: existing.result_json };
    const { comparisons, profileQuestions } = await loadDataset(client, session.dataset_id);
    const choices = (await client.query("SELECT * FROM choices WHERE session_id = $1 ORDER BY round_number", [session.id])).rows;
    const answers = (await client.query("SELECT * FROM profile_answers WHERE session_id = $1 ORDER BY id", [session.id])).rows;
    const result = buildFinalResult(comparisons, choices, answers, profileQuestions, { id: session.dataset_id, version: session.version });
    await client.query("INSERT INTO final_results (session_id, result_json) VALUES ($1,$2)", [session.id, JSON.stringify(result)]);
    await client.query("UPDATE game_sessions SET finished_at = NOW() WHERE id = $1", [session.id]);
    return { ok: true, result };
  }));

  app.use("/api/export", authorizeExport);
  app.get("/api/export/results.xlsx", route(async (_req, res) => {
    const buffer = await exportXlsx(pool);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("this-or-that.xlsx").send(Buffer.from(buffer));
  }));
  for (const [name, query] of Object.entries(exportQueries)) {
    app.get(`/api/export/${name}.csv`, route(async (_req, res) => {
      const result = await pool.query(query);
      res.type("text/csv").attachment(`${name}.csv`).send(rowsToCsv(result.rows, result.fields.map((field) => field.name)));
    }));
  }

  app.use((error, _req, res, _next) => {
    // Express identifies error middleware by its four arguments.
    void _next;
    const status = error instanceof InputError ? error.status : error.status === 400 ? 400 : 500;
    if (status === 500) console.error("API request failed:", error.code || error.name);
    res.status(status).json({ error: status === 500 ? "Could not complete request" : error.message });
  });
  return app;
}
