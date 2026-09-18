import test from "node:test";
import assert from "node:assert/strict";
import { rowsToCsv, authorizeExport } from "./exports.js";

test("CSV preserva JSON, datas, linhas e aspas", () => {
  const csv = rowsToCsv([{ result: { code: 'a\n"b"' }, when: new Date("2026-09-15T00:00:00Z"), empty: null }]);
  assert.ok(csv.includes('"{""code"":""a\\n\\""b\\""""}"'));
  assert.ok(csv.includes("2026-09-15T00:00:00.000Z"));
  assert.ok(!csv.includes("[object Object]"));
  assert.equal(rowsToCsv([], ["session_id"]), '"session_id"');
  assert.ok(rowsToCsv([{ answer: "=1+1" }]).includes("'=1+1"));
});

test("exportações fechadas sem segredo e protegidas por Bearer token", () => {
  const previous = process.env.EXPORT_TOKEN;
  const response = { status(code) { this.code = code; return this; }, json() {}, set() {} };
  try {
    delete process.env.EXPORT_TOKEN;
    authorizeExport({ get: () => "" }, response, () => assert.fail());
    assert.equal(response.code, 503);
    process.env.EXPORT_TOKEN = "x".repeat(32);
    authorizeExport({ get: () => "wrong" }, response, () => assert.fail());
    assert.equal(response.code, 401);
    let allowed = false;
    authorizeExport({ get: () => `Bearer ${process.env.EXPORT_TOKEN}` }, response, () => { allowed = true; });
    assert.equal(allowed, true);
  } finally {
    if (previous === undefined) delete process.env.EXPORT_TOKEN;
    else process.env.EXPORT_TOKEN = previous;
  }
});
