// One-time, guarded wording correction. Canonical answer values are unchanged.
import "dotenv/config";
import pg from "pg";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DATASET, CATEGORY_ORDER, snippets, comparisons, profileQuestions } from "./datasets/2026-06.js";

const question = profileQuestions.find((item) => item.id.endsWith(":programming-experience"));
const oldLabels = {
  "1_to_less_than_4": ["1 a menos de 4 anos", "1 to less than 4 years"],
  "4_to_less_than_7": ["4 a menos de 7 anos", "4 to less than 7 years"],
  "7_to_less_than_11": ["7 a menos de 11 anos", "7 to less than 11 years"],
};
const previous = { ...question, questionPt: "Há quantos anos programas?",
  questionEn: "How many years have you been programming?",
  options: question.options.map((option) => oldLabels[option.value]
    ? { ...option, pt: oldLabels[option.value][0], en: oldLabels[option.value][1] } : option) };
const hash = (questions) => createHash("sha256").update(JSON.stringify({ DATASET, CATEGORY_ORDER,
  snippets, comparisons, profileQuestions: questions })).digest("hex");
const beforeHash = hash(profileQuestions.map((item) => item.id === question.id ? previous : item));
const afterHash = hash(profileQuestions);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const dataset = (await client.query("SELECT seed_hash FROM datasets WHERE id = $1 FOR UPDATE", [DATASET.id])).rows[0];
  assert.ok(dataset && [beforeHash, afterHash].includes(dataset.seed_hash), "Unexpected dataset contents; correction refused");
  const current = (await client.query("SELECT question_pt, question_en, options FROM profile_questions WHERE id = $1 FOR UPDATE", [question.id])).rows[0];
  const expected = dataset.seed_hash === afterHash ? question : previous;
  assert.deepEqual(current, { question_pt: expected.questionPt, question_en: expected.questionEn, options: expected.options });
  await client.query("UPDATE profile_questions SET question_pt = $2, question_en = $3, options = $4::jsonb WHERE id = $1",
    [question.id, question.questionPt, question.questionEn, JSON.stringify(question.options)]);
  await client.query("UPDATE datasets SET seed_hash = $2 WHERE id = $1", [DATASET.id, afterHash]);
  await client.query("COMMIT");
  console.log("Experience wording updated. Answer values and participant responses were preserved.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
