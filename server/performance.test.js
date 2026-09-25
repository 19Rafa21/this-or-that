import test from "node:test";
import assert from "node:assert/strict";
import { createDatasetLoader } from "./dataset-cache.js";
import { createApp } from "./app.js";
import { DATASET } from "./seed-data.js";
import { apiComparisons, simulateGame } from "./test-fixtures.js";

test("cache partilha pedidos concorrentes, expira e separa datasets", async () => {
  let time = 0;
  let queries = 0;
  const database = { async query(_sql, params) { queries++; return { rows: [params[0]] }; } };
  const load = createDatasetLoader({ ttlMs: 30, now: () => time });
  const [first, concurrent] = await Promise.all([load(database, "a"), load(database, "a")]);
  assert.strictEqual(first, concurrent);
  assert.equal(queries, 2);
  await load(database, "a");
  assert.equal(queries, 2);
  assert.deepEqual((await load(database, "b")).comparisons, ["b"]);
  assert.equal(queries, 4);
  time = 31;
  await load(database, "a");
  assert.equal(queries, 6);
});

test("falha de leitura não fica guardada na cache", async () => {
  let fail = true;
  const database = { async query() {
    if (fail) throw new Error("database unavailable");
    return { rows: [] };
  } };
  const load = createDatasetLoader();
  await assert.rejects(load(database, "a"), /unavailable/);
  fail = false;
  assert.deepEqual(await load(database, "a"), { comparisons: [], profileQuestions: [] });
});

test("escolhas usam 5 operações com cache quente, validam e permitem repetir sem duplicar", async () => {
  const saved = [];
  let reads = 0;
  let released = 0;
  let commands = [];
  const pool = {
    async query(sql) {
      reads++;
      return { rows: sql.includes("FROM comparisons") ? apiComparisons : [] };
    },
    async connect() {
      return {
        async query(sql, params) {
          commands.push(sql);
          if (sql.includes("FROM game_sessions")) return { rows: [{ id: "session", dataset_id: DATASET.id }] };
          if (sql.includes("SELECT * FROM choices")) return { rows: [...saved] };
          if (sql.includes("INSERT INTO choices")) saved.push({ comparison_id: params[1], round_number: params[2],
            category: params[3], left_snippet_id: params[4], right_snippet_id: params[5],
            selected_snippet_id: params[6], skipped: params[9] });
          return { rows: [] };
        },
        release() { released++; },
      };
    },
  };
  const app = createApp(pool);
  const route = app._router.stack.find((layer) => layer.route?.path === "/api/choices").route.stack[0].handle;
  const call = async (choice) => {
    const response = { headers: {}, set(key, value) { this.headers[key] = value; },
      status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    let error;
    await route({ body: { sessionId: "session", comparisonId: choice.comparison_id,
      roundNumber: choice.round_number, category: choice.category, leftSnippetId: choice.left_snippet_id,
      rightSnippetId: choice.right_snippet_id, selectedSnippetId: choice.selected_snippet_id } }, response, (err) => { error = err; });
    return { response, error };
  };
  const { choices } = simulateGame(() => "right");
  assert.equal((await call(choices[0])).response.code, 201);
  commands = [];
  const second = await call(choices[1]);
  assert.equal(second.error, undefined);
  assert.equal(second.response.code, 201);
  assert.equal(commands.length, 5);
  assert.equal(reads, 2);
  assert.match(second.response.headers["Server-Timing"], /desc="5 queries"/);
  assert.match(second.response.headers["Server-Timing"], /db_connect;dur=/);
  assert.equal((await call(choices[1])).response.code, 201);
  assert.equal(saved.length, 2);
  assert.equal((await call({ ...choices[2], selected_snippet_id: "invented" })).error.status, 400);
  assert.equal(commands.at(-1), "ROLLBACK");
  assert.equal(saved.length, 2);
  assert.equal(released, 4);
});
