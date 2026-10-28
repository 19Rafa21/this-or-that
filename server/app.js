import { isCumulativeStudy, contextComparisons } from "../src/game/comparisonIndex.js";
import { getCategoryOrder } from "../src/game/categoryOrder.js";
import { countPlannedCodeQuestions } from "../src/game/gameUtils.js";
import express from "express";
import { createDatasetLoader } from "./dataset-cache.js";
import { timedDatabase, timingHeader } from "./request-timing.js";
import cors from "cors";
import { randomBytes } from "node:crypto";
import { registerDatasetManagement } from "./dataset-management.js";
import { InputError, replayTournament, buildFinalResult } from "./tournament.js";
import { authorizeExport, exportQueries, rowsToCsv } from "./exports.js";
import { exportXlsx } from "./export-xlsx.js";
import { createAdminAuth } from "./admin-auth.js";
import { loadStudyResults, loadPublicResults, parseResultFilters } from "./study-results.js";

export function createApp(pool, { adminAuth = createAdminAuth() } = {}) {
  const app = express();
  const loadDataset = createDatasetLoader();
  const origins = process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim());
  app.use(cors(origins ? { origin: origins } : {}));
  app.use("/api/admin/datasets", adminAuth.authorize, express.json({ limit: "10mb" }));
  app.use(express.json({ limit: "100kb" }));
  app.disable("x-powered-by");

  const route = (handler) => async (req, res, next) => {
    const started = performance.now();
    const metrics = { connectionMs: 0, queryMs: 0, queries: 0 };
    const database = timedDatabase(pool, metrics);
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.set("Server-Timing", timingHeader(metrics, performance.now() - started));
      return originalJson(body);
    };
    try { await handler(req, res, database); } catch (error) { next(error); }
  };
  const sessionRoute = (handler) => route(async (req, res, database) => {
    if (typeof req.body?.sessionId !== "string") throw new InputError("sessionId is required");
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const session = (await client.query(`SELECT s.*, d.version FROM game_sessions s
        JOIN datasets d ON d.id = s.dataset_id WHERE s.id = $1 FOR UPDATE OF s`, [req.body.sessionId])).rows[0];
      if (!session) throw new InputError("Unknown session", 404);
      const content = await loadDataset(database, session.dataset_id);
      const result = await handler(req.body, client, session, content);
      await client.query("COMMIT");
      res.status(201).json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  });

  registerDatasetManagement(app, pool, adminAuth.authorize, route);

  app.post("/api/admin/login", route(adminAuth.login));
  app.post("/api/admin/logout", adminAuth.logout);
  app.get("/api/admin/results", adminAuth.authorize, route(async (req, res) => {
    res.json(await loadStudyResults(pool, parseResultFilters(req.query)));
  }));

  app.get("/api/public/results", route(async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (Object.keys(req.query).length) throw new InputError("Public results do not support filters");
    res.json(await loadPublicResults(pool));
  }));

  app.get("/api/health", route(async (_req, res, database) => {
    const active = (await database.query("SELECT version FROM datasets WHERE active")).rows[0];
    res.json({ ok: true, database: "connected", protocolVersion: 4, datasetVersion: active?.version || null, resultsVersion: 4, datasetManagementVersion: 3, studyVersion: 3 });
  }));

  app.post("/api/sessions", route(async (req, res, database) => {
    const language = req.body?.language || "pt";
    if (!["pt", "en"].includes(language)) throw new InputError("Invalid interface language");
    const dataset = (await database.query("SELECT id, version FROM datasets WHERE active")).rows[0];
    if (!dataset) throw new InputError("The current dataset must be seeded before starting the game", 503);
    const content = await loadDataset(database, dataset.id);
    if (content.comparisons.some((c) => c.category === "blocks") && !((isCumulativeStudy(content.comparisons) ? [3, 4] : [2, 3, 4]).includes(req.body?.clientStudyVersion))) throw new InputError("Please reload the page to use the updated questionnaire", 426);
    if (content.comparisons.some(c => Number.isInteger(c.display_order)) && req.body?.clientStudyVersion !== 4) throw new InputError("Please reload the page to use the updated questionnaire", 426);
    replayTournament(content.comparisons, []);
    const id = randomBytes(16).toString("hex");
    await database.query("INSERT INTO game_sessions (id, dataset_id, interface_language) VALUES ($1, $2, $3)", [id, dataset.id, language]);
    res.status(201).json({ sessionId: id, datasetId: dataset.id, datasetVersion: dataset.version, ...content, ...(isCumulativeStudy(content.comparisons) ? { progressive: true, categoryOrder: getCategoryOrder(content.comparisons), plannedCodeQuestions: countPlannedCodeQuestions(content.comparisons, getCategoryOrder(content.comparisons)), comparisons: contextComparisons(content.comparisons, getCategoryOrder(content.comparisons)[0]) } : {}) });
  }));

  for (const path of ["/api/comparisons", "/api/v2/profile-questions", "/api/profile-questions", "/api/snippets"]) {
    app.get(path, route(async (_req, res, database) => {
      const dataset = (await database.query("SELECT id FROM datasets WHERE active")).rows[0];
      if (!dataset) throw new InputError("No active dataset", 503);
      const content = await loadDataset(database, dataset.id);
      if (path === "/api/comparisons") return res.json(content.comparisons);
      if (path === "/api/snippets") return res.json((await database.query("SELECT * FROM snippets WHERE dataset_id = $1 AND active", [dataset.id])).rows);
      res.json(content.profileQuestions);
    }));
  }

  app.post("/api/choices", sessionRoute(async (body, client, session, { comparisons }) => {
    const choices = (await client.query("SELECT * FROM choices WHERE session_id = $1 ORDER BY round_number", [session.id])).rows;
    const choice = {
      comparison_id: body.comparisonId, round_number: body.roundNumber, category: body.category,
      left_snippet_id: body.leftSnippetId, right_snippet_id: body.rightSnippetId,
      selected_snippet_id: body.selectedSnippetId === "skipped" ? null : body.selectedSnippetId,
      skipped: body.selectedSnippetId === "skipped",
    };
    const existing = choices.find((item) => item.round_number === choice.round_number);
    if (existing) {
      if (Object.entries(choice).every(([key, value]) => existing[key] === value)) return choiceResponse(comparisons, choices);
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
    return choiceResponse(comparisons, [...choices, choice]);
  }));

  app.post("/api/profile-answers", sessionRoute(async (body, client, session, { profileQuestions }) => {
    const question = profileQuestions.find((item) => item.id === body.questionId);
    if (!question || (body.answer !== "skipped" && !question.options.some((item) => item.value === body.answer))) throw new InputError("Invalid profile answer");
    const existing = (await client.query("SELECT answer_value FROM profile_answers WHERE session_id = $1 AND question_id = $2", [session.id, question.id])).rows[0];
    if (existing?.answer_value === body.answer) return { ok: true };
    if (existing || session.finished_at) throw new InputError("Answer already saved or session finished", 409);
    await client.query("INSERT INTO profile_answers (session_id, question_id, answer_value) VALUES ($1,$2,$3)", [session.id, question.id, body.answer]);
    return { ok: true };
  }));

  app.post("/api/final-results", sessionRoute(async (_body, client, session, { comparisons, profileQuestions }) => {
    const existing = (await client.query("SELECT result_json FROM final_results WHERE session_id = $1", [session.id])).rows[0];
    if (existing) return { ok: true, result: existing.result_json };
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
    // O Express identifica as funções de tratamento de erros pelos seus quatro argumentos.
    void _next;
    const status = error instanceof InputError ? error.status : error.status === 400 ? 400 : 500;
    if (status === 500) console.error("API request failed:", error.code || error.name);
    res.status(status).json({ error: status === 500 ? "Could not complete request" : error.message });
  });
  return app;
}

function choiceResponse(comparisons, choices) {
  if (!isCumulativeStudy(comparisons)) return { ok: true };
  const replay = replayTournament(comparisons, choices);
  const category = getCategoryOrder(comparisons)[replay.categoryResults.length];
  return { ok: true, comparisons: category ? contextComparisons(comparisons, category, replay.carriedStyles) : [] };
}
