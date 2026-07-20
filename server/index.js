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
  await pool.query("SELECT 1");
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
        AND dataset_id = (SELECT id FROM datasets WHERE active = true)
      ORDER BY category ASC, language ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load snippets" });
  }
});

app.get("/api/comparisons", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.category,
        c.dataset_id,
        jsonb_build_object(
          'id', a.id,
          'category', a.category,
          'language', a.language,
          'label', a.label,
          'code', a.code,
          'intention_pt', a.intention_pt,
          'intention_en', a.intention_en
        ) AS snippet_a,
        jsonb_build_object(
          'id', b.id,
          'category', b.category,
          'language', b.language,
          'label', b.label,
          'code', b.code,
          'intention_pt', b.intention_pt,
          'intention_en', b.intention_en
        ) AS snippet_b
      FROM comparisons c
      JOIN snippets a ON a.id = c.snippet_a_id
      JOIN snippets b ON b.id = c.snippet_b_id
      JOIN datasets d ON d.id = c.dataset_id
      WHERE c.active = true
        AND a.active = true
        AND b.active = true
        AND d.active = true
      ORDER BY c.category ASC, c.id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load comparisons" });
  }
});

app.get("/api/profile-questions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        question_pt,
        question_en,
        type,
        (
          SELECT jsonb_agg(item->>'pt')
          FROM jsonb_array_elements(options) item
        ) AS options,
        active
      FROM profile_questions
      WHERE active = true
        AND dataset_id = (SELECT id FROM datasets WHERE active = true)
      ORDER BY display_order ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load profile questions" });
  }
});

app.get("/api/v2/profile-questions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, question_pt, question_en, type, options, display_order
      FROM profile_questions
      WHERE active = true
        AND dataset_id = (SELECT id FROM datasets WHERE active = true)
      ORDER BY display_order ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load profile questions" });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const requestedLanguage = req.body?.language;
    const language = requestedLanguage || "pt";

    if (
      requestedLanguage !== undefined &&
      language !== "pt" &&
      language !== "en"
    ) {
      return res.status(400).json({ error: "Invalid interface language" });
    }

    const id = createId();
    const createdAt = new Date().toISOString();

    const datasetResult = await pool.query(
      "SELECT id, version FROM datasets WHERE active = true"
    );

    if (datasetResult.rowCount !== 1) {
      return res.status(503).json({ error: "No active dataset is available" });
    }

    const dataset = datasetResult.rows[0];

    await pool.query(
      `
      INSERT INTO game_sessions (id, dataset_id, created_at, interface_language)
      VALUES ($1, $2, $3, $4)
      `,
      [id, dataset.id, createdAt, language]
    );

    res.status(201).json({
      sessionId: id,
      datasetId: dataset.id,
      datasetVersion: dataset.version,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create session" });
  }
});

app.post("/api/profile-answers", async (req, res) => {
  try {
    const { sessionId, questionId, answer } = req.body;

    if (!sessionId || !questionId || !answer) {
      return res.status(400).json({
        error: "sessionId, questionId and answer are required",
      });
    }

    const validOption = await pool.query(
      `
        SELECT
          CASE
            WHEN $3 = 'skipped' THEN 'skipped'
            ELSE (
              SELECT item->>'value'
              FROM jsonb_array_elements(pq.options) item
              WHERE item->>'value' = $3
                 OR item->>'pt' = $3
                 OR item->>'en' = $3
              LIMIT 1
            )
          END AS answer_value
        FROM profile_questions pq
        JOIN game_sessions gs ON gs.dataset_id = pq.dataset_id
        WHERE gs.id = $1
          AND pq.id = $2
          AND pq.active = true
      `,
      [sessionId, questionId, answer]
    );

    const answerValue = validOption.rows[0]?.answer_value;

    if (!answerValue) {
      return res.status(400).json({ error: "Invalid profile answer" });
    }

    await pool.query(
      `
        INSERT INTO profile_answers (
          session_id,
          question_id,
          answer_value,
          created_at
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id, question_id) DO UPDATE SET
          answer_value = EXCLUDED.answer_value,
          created_at = EXCLUDED.created_at
      `,
      [sessionId, questionId, answerValue, new Date().toISOString()]
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
      comparisonId,
      roundNumber,
      category,
      leftSnippetId,
      rightSnippetId,
      selectedSnippetId,
    } = req.body;

    if (
      !sessionId ||
      !Number.isInteger(roundNumber) ||
      !category ||
      !leftSnippetId ||
      !rightSnippetId ||
      !selectedSnippetId
    ) {
      return res.status(400).json({
        error: "Incomplete choice payload",
      });
    }

    const comparisonResult = await pool.query(
      `
        SELECT
          c.id,
          c.category,
          c.snippet_a_id,
          c.snippet_b_id,
          a.language AS language_a,
          b.language AS language_b
        FROM comparisons c
        JOIN snippets a ON a.id = c.snippet_a_id
        JOIN snippets b ON b.id = c.snippet_b_id
        JOIN game_sessions gs ON gs.dataset_id = c.dataset_id
        WHERE gs.id = $2
          AND c.active = true
          AND (
            c.id = $1
            OR (
              $1 IS NULL
              AND c.category = $3
              AND (
                (c.snippet_a_id = $4 AND c.snippet_b_id = $5)
                OR
                (c.snippet_a_id = $5 AND c.snippet_b_id = $4)
              )
            )
          )
      `,
      [comparisonId || null, sessionId, category, leftSnippetId, rightSnippetId]
    );

    if (comparisonResult.rowCount !== 1) {
      return res.status(400).json({ error: "Invalid comparison or session" });
    }

    const comparison = comparisonResult.rows[0];
    const expectedSnippetIds = new Set([
      comparison.snippet_a_id,
      comparison.snippet_b_id,
    ]);

    if (
      comparison.category !== category ||
      !expectedSnippetIds.has(leftSnippetId) ||
      !expectedSnippetIds.has(rightSnippetId) ||
      leftSnippetId === rightSnippetId
    ) {
      return res.status(400).json({ error: "Choice does not match comparison" });
    }

    const skipped = selectedSnippetId === "skipped";
    let storedSnippetId = null;
    let storedLanguage = null;

    if (!skipped) {
      if (!expectedSnippetIds.has(selectedSnippetId)) {
        return res.status(400).json({ error: "Invalid selected snippet" });
      }

      storedSnippetId = selectedSnippetId;
      storedLanguage =
        selectedSnippetId === comparison.snippet_a_id
          ? comparison.language_a
          : comparison.language_b;
    }

    await pool.query(
      `
        INSERT INTO choices (
          session_id,
          comparison_id,
          round_number,
          category,
          left_snippet_id,
          right_snippet_id,
          selected_snippet_id,
          selected_language,
          skipped,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (session_id, round_number) DO UPDATE SET
          comparison_id = EXCLUDED.comparison_id,
          category = EXCLUDED.category,
          left_snippet_id = EXCLUDED.left_snippet_id,
          right_snippet_id = EXCLUDED.right_snippet_id,
          selected_snippet_id = EXCLUDED.selected_snippet_id,
          selected_language = EXCLUDED.selected_language,
          skipped = EXCLUDED.skipped,
          created_at = EXCLUDED.created_at
      `,
      [
        sessionId,
        comparison.id,
        roundNumber || null,
        category,
        leftSnippetId,
        rightSnippetId,
        storedSnippetId,
        storedLanguage,
        skipped,
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
      ON CONFLICT (session_id) DO UPDATE SET
        result_json = EXCLUDED.result_json,
        created_at = EXCLUDED.created_at
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
        d.version AS dataset_version,
        s.created_at AS session_created_at,
        s.interface_language,
        c.round_number,
        c.comparison_id,
        c.category,
        c.left_snippet_id,
        c.right_snippet_id,
        c.selected_snippet_id,
        c.selected_language,
        c.skipped,
        c.created_at AS choice_created_at
      FROM choices c
      LEFT JOIN game_sessions s ON s.id = c.session_id
      LEFT JOIN datasets d ON d.id = s.dataset_id
      ORDER BY c.created_at ASC
    `);

    const csv = rowsToCsv(result.rows, [
      "session_id",
      "dataset_version",
      "session_created_at",
      "interface_language",
      "round_number",
      "comparison_id",
      "category",
      "left_snippet_id",
      "right_snippet_id",
      "selected_snippet_id",
      "selected_language",
      "skipped",
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
        d.version AS dataset_version,
        s.created_at AS session_created_at,
        s.interface_language,
        pa.question_id,
        pq.question_pt,
        pq.question_en,
        pa.answer_value,
        pa.created_at AS answer_created_at
      FROM profile_answers pa
      LEFT JOIN game_sessions s ON s.id = pa.session_id
      LEFT JOIN datasets d ON d.id = s.dataset_id
      LEFT JOIN profile_questions pq ON pq.id = pa.question_id
      ORDER BY pa.created_at ASC
    `);

    const csv = rowsToCsv(result.rows, [
      "session_id",
      "dataset_version",
      "session_created_at",
      "interface_language",
      "question_id",
      "question_pt",
      "question_en",
      "answer_value",
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
        d.version AS dataset_version,
        s.created_at AS session_created_at,
        s.interface_language,
        s.finished_at AS session_finished_at,
        fr.result_json,
        fr.created_at AS result_created_at
      FROM final_results fr
      LEFT JOIN game_sessions s ON s.id = fr.session_id
      LEFT JOIN datasets d ON d.id = s.dataset_id
      ORDER BY fr.created_at ASC
    `);

    const csv = rowsToCsv(result.rows, [
      "session_id",
      "dataset_version",
      "session_created_at",
      "interface_language",
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
