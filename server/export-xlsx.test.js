import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildExportWorkbook, loadExportSnapshot } from "./export-xlsx.js";
import { createApp } from "./app.js";

function fixture() {
  return {
    sessions: [{ session_id: "001", dataset_version: "2026.5", created_at: new Date("2026-09-18T01:53:06Z"),
      finished_at: null, status: "in_progress", code_answers: "1", skipped_comparisons: "1" }],
    questions: [{ id: "frequency", question_pt: "Com que frequência programas?" }],
    "profile-answers": [{ session_id: "001", question_id: "frequency", answer_value: "=1+1" }],
    choices: [{ session_id: "001", round_number: 1, skipped: true, selected_language: null,
      left_code: 'print("Olá")\nprint("mundo")', legacy_reference_mismatch: false }],
    "final-results": [{ session_id: "001", dataset_version: "2026.5", result_json: {
      protocolVersion: 4, selectedStyles: { loops: null }, carriedStyles: { loops: "python" },
      winner: { code: 'print("Olá")\nprint("mundo")' } } }],
  };
}

test("XLSX preserva tipos, texto literal, saltos e composição ao reabrir", async () => {
  const data = fixture();
  const buffer = await buildExportWorkbook(data).xlsx.writeBuffer();
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  assert.deepEqual(book.worksheets.map((sheet) => sheet.name), ["Participações", "Perfil", "Escolhas", "Resultados"]);
  const sessions = book.getWorksheet("Participações");
  assert.equal(sessions.getCell("A2").value, "001");
  assert.equal(sessions.getCell("C2").value.toISOString(), "2026-09-18T01:53:06.000Z");
  assert.equal(sessions.getCell("D2").value, null);
  assert.equal(sessions.getCell("G2").value, 1);
  assert.equal(book.getWorksheet("Perfil").getCell("C2").value, "=1+1");
  assert.equal(book.getWorksheet("Perfil").getCell("C2").type, ExcelJS.ValueType.String);
  const results = book.getWorksheet("Resultados");
  assert.equal(results.getCell("E2").value, null);
  assert.deepEqual(JSON.parse(results.getCell("G2").value), { loops: "python" });
  assert.equal(results.getCell("I2").value, data["final-results"][0].result_json.winner.code);
  for (const sheet of book.worksheets) {
    assert.equal(sheet.views[0].ySplit, 1);
    assert.ok(sheet.autoFilter);
    sheet.eachRow((row) => row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)));
  }
});

test("XLSX vazio conserva folhas e cabeçalhos; texto excessivo não é truncado", () => {
  const empty = { sessions: [], questions: [], choices: [], "profile-answers": [], "final-results": [] };
  assert.equal(buildExportWorkbook(empty).worksheets.length, 4);
  const data = fixture();
  data.choices[0].left_code = "x".repeat(32768);
  assert.throws(() => buildExportWorkbook(data), /text limit/);
});

test("snapshot usa transação só de leitura e liberta a ligação mesmo em erro", async () => {
  for (const fail of [false, true]) {
    const commands = [];
    let released = false;
    const client = { async query(sql) {
      commands.push(sql);
      if (fail && sql.startsWith("SELECT")) throw new Error("query failed");
      return { rows: [] };
    }, release() { released = true; } };
    const run = loadExportSnapshot({ connect: async () => client });
    if (fail) await assert.rejects(run, /query failed/);
    else assert.deepEqual((await run).choices, []);
    assert.match(commands[0], /REPEATABLE READ READ ONLY/);
    assert.equal(commands.at(-1), fail ? "ROLLBACK" : "COMMIT");
    assert.ok(released);
  }
});

test("rota Excel exige token e entrega um XLSX sem cache", async () => {
  const previous = process.env.EXPORT_TOKEN;
  let connections = 0;
  const pool = { async connect() {
    connections += 1;
    return { query: async () => ({ rows: [] }), release() {} };
  } };
  const app = createApp(pool);
  // Exercise the registered middleware and route without opening a network port.
  const auth = app._router.stack.find((layer) => layer.name === "authorizeExport").handle;
  const route = app._router.stack.find((layer) => layer.route?.path === "/api/export/results.xlsx").route.stack[0].handle;
  const res = { headers: {}, status(code) { this.code = code; return this; }, json() {},
    set(key, value) { this.headers[key] = value; return this; },
    type(value) { this.mime = value; return this; }, attachment(value) { this.filename = value; return this; },
    send(value) { this.body = value; return this; } };
  try {
    delete process.env.EXPORT_TOKEN;
    auth({ get: () => "" }, res, () => assert.fail());
    assert.equal(res.code, 503);
    process.env.EXPORT_TOKEN = "x".repeat(32);
    auth({ get: () => "Bearer wrong" }, res, () => assert.fail());
    assert.equal(res.code, 401);
    assert.equal(connections, 0);
    let allowed = false;
    auth({ get: () => `Bearer ${process.env.EXPORT_TOKEN}` }, res, () => { allowed = true; });
    assert.ok(allowed);
    await route({}, res, (error) => { throw error; });
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.filename, "this-or-that.xlsx");
    assert.match(res.mime, /spreadsheetml/);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(res.body);
    assert.equal(book.worksheets.length, 4);
  } finally {
    if (previous === undefined) delete process.env.EXPORT_TOKEN;
    else process.env.EXPORT_TOKEN = previous;
  }
});
