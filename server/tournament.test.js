import test from "node:test";
import assert from "node:assert/strict";
import { apiComparisons, simulateGame } from "./test-fixtures.js";
import { replayTournament, buildFinalResult } from "./tournament.js";
import { DATASET, profileQuestions, snippets, comparisons } from "./seed-data.js";

test("as 512 sequências de escolhas completam 9 pares e mantêm o contexto", () => {
  const results = new Set();
  for (let mask = 0; mask < 512; mask += 1) {
    const game = simulateGame((index) => (mask >> index) & 1 ? "right" : "left");
    const replay = replayTournament(apiComparisons, game.choices);
    assert.equal(replay.complete, true);
    assert.equal(game.choices.length, 9);
    assert.deepEqual(replay.selectedStyles, game.selectedStyles);
    results.add(JSON.stringify(replay.selectedStyles));
  }
  assert.equal(results.size, 64);
});

test("intercala o perfil entre categorias e mantém 16 passos", () => {
  const { flow } = simulateGame();
  assert.deepEqual(flow.map((item) => item.type === "profile" ? "profile" : item.category), [
    "variables", "variables", "variables", "profile", "profile",
    "loops", "loops", "loops", "profile", "profile",
    "conditionals", "conditionals", "conditionals", "profile", "profile", "profile",
  ]);
});

test("saltar não cria preferências confirmadas", () => {
  const replay = replayTournament(apiComparisons, simulateGame(() => "skip").choices);
  assert.deepEqual(replay.selectedStyles, { variables: null, loops: null, conditionals: null });
  assert.equal(Object.keys(replay.carriedStyles).length, 3);
  for (let skipped = 0; skipped < 9; skipped += 1) {
    const result = replayTournament(apiComparisons, simulateGame((index) => index === skipped ? "skip" : "right").choices);
    assert.equal(result.categoryResults.filter((item) => item.status === "incomplete").length, 1);
  }
});

test("rejeita rondas inventadas, contexto errado e vencedor substituído", () => {
  const { choices } = simulateGame();
  assert.throws(() => replayTournament(apiComparisons, [{ ...choices[0], round_number: 2 }]));
  assert.throws(() => replayTournament(apiComparisons, [{ ...choices[0], selected_snippet_id: "invented" }]));
  assert.throws(() => replayTournament(apiComparisons, [choices[0], { ...choices[1], left_snippet_id: choices[0].right_snippet_id }]));
  const differentContext = simulateGame(() => "right").choices[3];
  assert.throws(() => replayTournament(apiComparisons, [...choices.slice(0, 3), differentContext]));
  assert.throws(() => replayTournament(apiComparisons, [...choices, { ...choices[0], round_number: 10 }]));
});

test("resultado final exige todas as respostas e é reconstruído a partir dos pares", () => {
  const { choices } = simulateGame();
  assert.throws(() => buildFinalResult(apiComparisons, choices.slice(0, -1), [], profileQuestions, DATASET));
  assert.throws(() => buildFinalResult(apiComparisons, choices, [], profileQuestions, DATASET));
  const profile = profileQuestions.map((q) => ({ question_id: q.id, answer_value: "skipped" }));
  const result = buildFinalResult(apiComparisons, choices, profile, profileQuestions, DATASET);
  assert.equal(result.winner.code, replayTournament(apiComparisons, choices).finalSnippet.code);
  assert.equal(result.protocolVersion, 4);
});

test("todos os IDs pertencem à versão do dataset", () => {
  for (const item of [...snippets, ...comparisons, ...profileQuestions]) assert.ok(item.id.startsWith(`${DATASET.id}:`));
});
