import test from "node:test";
import assert from "node:assert/strict";
import { loadStudyResults, parseResultFilters } from "./study-results.js";

test("filtros rejeitam datas impossíveis, intervalos invertidos e tipos inesperados", () => {
  assert.deepEqual(parseResultFilters(), { from: null, to: null, status: "all" });
  assert.deepEqual(parseResultFilters({ from: "2024-02-29", status: "complete" }), { from: "2024-02-29", to: null, status: "complete" });
  for (const query of [{ from: "2026-02-29" }, { to: "2026-13-01" }, { from: ["2026-01-01"] },
    { from: "2026-09-26", to: "2026-09-25" }, { status: "fake" }, { from: "';DROP TABLE choices;--" }]) {
    assert.throws(() => parseResultFilters(query), { status: 400 });
  }
});

test("resultados usam snapshot só de leitura e libertam ligação após falha", async () => {
  let released = false;
  const sql = [];
  await assert.rejects(loadStudyResults({ connect: async () => ({
    async query(statement) {
      sql.push(statement);
      if (statement.startsWith("WITH")) throw new Error("read failed");
      return { rows: [] };
    }, release() { released = true; },
  }) }, parseResultFilters()), /read failed/);
  assert.match(sql[0], /REPEATABLE READ READ ONLY/);
  assert.equal(sql.at(-1), "ROLLBACK");
  assert.ok(released);
});
