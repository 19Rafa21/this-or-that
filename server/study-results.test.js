import test from "node:test";
import assert from "node:assert/strict";
import { loadStudyResults, parseResultFilters } from "./study-results.js";

test("filtros rejeitam datas impossíveis, intervalos invertidos e tipos inesperados", () => {
  assert.deepEqual(parseResultFilters(), { from: null, to: null, status: "all", datasetId: null });
  assert.deepEqual(parseResultFilters({ from: "2024-02-29", status: "complete", datasetId: "dataset-2026-05" }), { from: "2024-02-29", to: null, status: "complete", datasetId: "dataset-2026-05" });
  for (const query of [{ from: "2026-02-29" }, { to: "2026-13-01" }, { from: ["2026-01-01"] },
    { from: "2026-09-26", to: "2026-09-25" }, { status: "fake" }, { from: "';DROP TABLE choices;--" },
    { datasetId: ["dataset-2026-05"] }, { datasetId: "';DROP TABLE choices;--" }, { datasetId: "a".repeat(101) }]) {
    assert.throws(() => parseResultFilters(query), { status: 400 });
  }
});

test("resultados usam snapshot só de leitura e libertam ligação após falha", async () => {
  let released = false;
  const sql = [];
  await assert.rejects(loadStudyResults({ connect: async () => ({
    async query(statement) {
      sql.push(statement);
      if (statement.startsWith("SELECT")) throw new Error("read failed");
      return { rows: [] };
    }, release() { released = true; },
  }) }, parseResultFilters()), /read failed/);
  assert.match(sql[0], /REPEATABLE READ READ ONLY/);
  assert.equal(sql.at(-1), "ROLLBACK");
  assert.ok(released);
});

test("sem escolha explícita prefere respostas recentes, depois dataset ativo", async () => {
  for (const hasResponses of [true, false]) {
    const datasets = [
      { id: "new", version: "new", active: true, has_responses: false },
      { id: "old", version: "old", active: false, has_responses: hasResponses },
    ];
    const pool = { connect: async () => ({
      async query(sql, params) {
        if (sql.startsWith("SELECT d.id")) return { rows: datasets };
        if (params) assert.equal(params[0], hasResponses ? "old" : "new");
        return { rows: [] };
      }, release() {},
    }) };
    const results = await loadStudyResults(pool, parseResultFilters());
    assert.equal(results.datasetId, hasResponses ? "old" : "new");
    assert.equal(results.filters.datasetId, results.datasetId);
  }
});
