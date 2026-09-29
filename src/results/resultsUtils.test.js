import test from "node:test";
import assert from "node:assert/strict";
import { preferenceRows, profileRows, profileFilterLabels } from "./resultsUtils.js";

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

test("legendas exportadas identificam cada pergunta, opção, salto e ausência de resposta", () => {
  const questions = [
    {id: "age", question_pt: "Idade", question_en: "Age", options: [{value: "55", pt: "55 anos ou mais", en: "55 or older"}]},
    {id: "first", question_pt: "Primeira linguagem", question_en: "First language", options: [{value: "pascal", pt: "Pascal", en: "Pascal"}]},
  ];
  const text = {skipped: "Saltou", missing: "Sem resposta"};
  assert.deepEqual(profileFilterLabels(questions, {age: "55", first: "pascal"}, text, "pt"),
    ["Idade: 55 anos ou mais", "Primeira linguagem: Pascal"]);
  assert.deepEqual(profileFilterLabels(questions, {age: "skipped", first: "__missing__"}, text, "pt"),
    ["Idade: Saltou", "Primeira linguagem: Sem resposta"]);
  assert.deepEqual(profileFilterLabels(questions, {}, text, "en"), []);
});
