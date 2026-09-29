import test from "node:test";
import assert from "node:assert/strict";
import { preferenceRows, profileRows } from "./resultsUtils.js";

test("preferências usam confrontos decididos e não confundem ausência com zero", () => {
  const rows = preferenceRows([
    { style: "A", wins: 2, shown: 6, decided: 4, skipped: 2 },
    { style: "B", wins: 0, shown: 2, decided: 0, skipped: 2 },
    { style: "C", wins: 0, shown: 4, decided: 4, skipped: 0 },
  ]);
  assert.equal(rows[0].value, 50);
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].value, 0);
});

test("perfil distingue respostas, saltos, desconhecidos e perguntas não respondidas", () => {
  const rows = profileRows({ options: [{ value: "a", pt: "Opção A", en: "Option A" }],
    counts: { a: 2, skipped: 1, legacy: 1 } }, 6,
  { skipped: "Saltou", missing: "Sem resposta", unknown: "Outras" }, "pt");
  assert.deepEqual(rows, [{ label: "Opção A", value: 2 }, { label: "Saltou", value: 1 },
    { label: "Sem resposta", value: 2 }, { label: "Outras", value: 1 }]);
  assert.equal(rows.reduce((total, row) => total + row.value, 0), 6);
});
