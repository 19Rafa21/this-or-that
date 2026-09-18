import "dotenv/config";
import pg from "pg";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createApp } from "./app.js";
import { createSchema } from "./schema.js";
import { DATASET, comparisons, profileQuestions } from "./seed-data.js";
import { apiSnippets, simulateGame } from "./test-fixtures.js";

// Use a separate, randomly named schema. Never seed or delete public tables.
const schema = `this_or_that_test_${randomBytes(8).toString("hex")}`;
const config = { connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };
const admin = new pg.Pool(config);
const pool = new pg.Pool({ ...config, options: `-c search_path=${schema}` });
let server;
let created = false;
const previousToken = process.env.EXPORT_TOKEN;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await createSchema(pool);
  await pool.query("INSERT INTO datasets(id, version, description, active) VALUES($1,$2,$3,true)", [DATASET.id, DATASET.version, DATASET.description]);
  await pool.query(`INSERT INTO snippets (id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en)
    SELECT id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,dataset_id text,category text,language text,style text,source_language text,inherited_styles jsonb,label text,code text,intention_pt text,intention_en text)`, [JSON.stringify(apiSnippets)]);
  await pool.query(`INSERT INTO comparisons(id,dataset_id,category,snippet_a_id,snippet_b_id,validation_notes)
    SELECT id,"datasetId",category,"snippetAId","snippetBId","validationNotes"
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,"datasetId" text,category text,"snippetAId" text,"snippetBId" text,"validationNotes" text)`, [JSON.stringify(comparisons)]);
  await pool.query(`INSERT INTO profile_questions(id,dataset_id,question_pt,question_en,options,display_order)
    SELECT id,"datasetId","questionPt","questionEn",options,"displayOrder"
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,"datasetId" text,"questionPt" text,"questionEn" text,options jsonb,"displayOrder" int)`, [JSON.stringify(profileQuestions)]);

  process.env.EXPORT_TOKEN = randomBytes(32).toString("hex");
  server = createApp(pool).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, status = 201) => {
    const response = await fetch(`${base}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
    return result;
  };
  for (const skip of [false, true]) {
    const session = await post("sessions", { language: skip ? "en" : "pt" });
    assert.equal(session.comparisons.length, 126);
    assert.equal(session.profileQuestions.length, 7);
    await post("final-results", { sessionId: session.sessionId, result: { fake: true } }, 400);
    const { choices } = simulateGame(() => skip ? "skip" : "right");
    const payload = (choice) => ({ sessionId: session.sessionId, comparisonId: choice.comparison_id,
      roundNumber: choice.round_number, category: choice.category, leftSnippetId: choice.left_snippet_id,
      rightSnippetId: choice.right_snippet_id, selectedSnippetId: choice.skipped ? "skipped" : choice.selected_snippet_id });
    await Promise.all([post("choices", payload(choices[0])), post("choices", payload(choices[0]))]);
    await post("choices", { ...payload(choices[0]), selectedSnippetId: "invented" }, 409);
    await post("choices", { ...payload(choices[1]), roundNumber: 8 }, 400);
    for (const choice of choices.slice(1)) await post("choices", payload(choice));
    await post("final-results", { sessionId: session.sessionId }, 400);
    await post("profile-answers", { sessionId: session.sessionId, questionId: profileQuestions[0].id, answer: "invented" }, 400);
    for (const question of profileQuestions) {
      const body = { sessionId: session.sessionId, questionId: question.id, answer: skip ? "skipped" : question.options[0].value };
      await post("profile-answers", body);
      await post("profile-answers", body);
    }
    const final = await post("final-results", { sessionId: session.sessionId, result: { winner: { code: "forged" } } });
    assert.notEqual(final.result.winner.code, "forged");
    assert.equal(final.result.hasSkippedComparisons, skip);
    if (skip) assert.ok(Object.values(final.result.selectedStyles).every((value) => value === null));
    const retry = await post("final-results", { sessionId: session.sessionId });
    assert.deepEqual(retry, final);
    console.log(`HTTP game (${skip ? "all skipped" : "all selected"}): 9 choices, 7 profile answers, validated result, safe retries`);
  }
  const denied = await fetch(`${base}/api/export/sessions.csv`);
  assert.equal(denied.status, 401);
  for (const name of ["sessions", "choices", "profile-answers", "final-results"]) {
    const response = await fetch(`${base}/api/export/${name}.csv`, { headers: { Authorization: `Bearer ${process.env.EXPORT_TOKEN}` } });
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.ok(!csv.includes("[object Object]"));
    assert.ok(csv.includes(DATASET.version));
  }
  const counts = (await pool.query("SELECT (SELECT count(*) FROM choices) AS choices, (SELECT count(*) FROM final_results) AS results")).rows[0];
  assert.equal(Number(counts.choices), 18);
  assert.equal(Number(counts.results), 2);
  console.log("All HTTP/PostgreSQL integration checks passed; public data was not touched.");
} catch (error) {
  console.error("Integration check failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  if (previousToken === undefined) delete process.env.EXPORT_TOKEN;
  else process.env.EXPORT_TOKEN = previousToken;
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  if (created) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    console.log(`Removed temporary test schema ${schema}.`);
  }
  await admin.end();
}
