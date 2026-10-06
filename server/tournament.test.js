import test from "node:test";
import assert from "node:assert/strict";
import { apiComparisons, simulateGame } from "./test-fixtures.js";
import { replayTournament, buildFinalResult } from "./tournament.js";
import { DATASET, profileQuestions, snippets, comparisons } from "./seed-data.js";

test("as 16384 sequências de escolhas completam 14 pares e mantêm o contexto", () => {
  const results = new Set();
  for (let mask = 0; mask < 16384; mask += 1) {
    const game = simulateGame((index) => (mask >> index) & 1 ? "right" : "left");
    const replay = replayTournament(apiComparisons, game.choices);
    assert.equal(replay.complete, true);
    assert.equal(game.choices.length, 14);
    assert.deepEqual(replay.selectedStyles, game.selectedStyles);
    results.add(JSON.stringify(replay.selectedStyles));
  }
  assert.equal(results.size, 1944);
});

test("intercala o perfil entre categorias e mantém 19 passos", () => {
  const { flow } = simulateGame();
  assert.equal(flow.length, 19);
  assert.deepEqual(flow.filter((s) => s.type === 'profile').map((s) => s.afterCategory), ['variables', 'blocks', 'conditionals', 'assignments', 'functions']);
  assert.equal(flow.at(-1).type, 'profile');
});

test("saltar não cria preferências confirmadas", () => {
  const replay = replayTournament(apiComparisons, simulateGame(() => "skip").choices);
  assert.ok(Object.values(replay.selectedStyles).every((value) => value === null));
  assert.equal(Object.keys(replay.carriedStyles).length, 7);
  for (let skipped = 0; skipped < 14; skipped += 1) {
    const result = replayTournament(apiComparisons, simulateGame((index) => index === skipped ? "skip" : "right").choices);
    assert.equal(result.categoryResults.filter((item) => item.status === "incomplete").length, 1);
  }
});

test("rejeita rondas inventadas, contexto errado e vencedor substituído", () => {
  const { choices } = simulateGame();
  assert.throws(() => replayTournament(apiComparisons, [{ ...choices[0], round_number: 2 }]));
  assert.throws(() => replayTournament(apiComparisons, [{ ...choices[0], selected_snippet_id: "invented" }]));
  assert.throws(() => replayTournament(apiComparisons, [choices[0], { ...choices[1], left_snippet_id: choices[0].right_snippet_id }]));
  const differentContext = simulateGame(() => "right").choices[5];
  assert.throws(() => replayTournament(apiComparisons, [...choices.slice(0, 5), differentContext]));
  assert.throws(() => replayTournament(apiComparisons, [...choices, { ...choices[0], round_number: 10 }]));
});

test("resultado final exige todas as respostas e é reconstruído a partir dos pares", () => {
  const { choices } = simulateGame();
  assert.throws(() => buildFinalResult(apiComparisons, choices.slice(0, -1), [], profileQuestions, DATASET));
  assert.throws(() => buildFinalResult(apiComparisons, choices, [], profileQuestions, DATASET));
  const profile = profileQuestions.map((q) => ({ question_id: q.id, answer_value: "skipped" }));
  const result = buildFinalResult(apiComparisons, choices, profile, profileQuestions, DATASET);
  assert.equal(result.winner.examples.length, 7);
  assert.equal(result.winner.examples.at(-1).code, replayTournament(apiComparisons, choices).finalSnippet.code);
  assert.equal(result.protocolVersion, 4);
});

test("todos os IDs pertencem à versão do dataset", () => {
  for (const item of [...snippets, ...comparisons, ...profileQuestions]) assert.ok(item.id.startsWith(`${DATASET.id}:`));
});

test('ordens aleatórias e saltos mantêm sempre a composição válida', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let state = seed;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const game = simulateGame(() => ['left', 'right', 'skip'][Math.floor(random() * 3)], random);
    const result = replayTournament(apiComparisons, game.choices);
    assert.equal(result.complete, true);
    assert.equal(game.choices.length, 14);
    assert.deepEqual(result.finalSnippet.inherited_styles, { blocks: result.carriedStyles.blocks });
  }
});

test('a versão anterior continua a completar oito escolhas e a devolver a composição original', async () => {
  const legacy = await import('./datasets/2026-07.js');
  const mapped = legacy.snippets.map(s => ({ ...s, inherited_styles: s.inheritedStyles }));
  const pairs = legacy.comparisons.map(c => ({ ...c, snippet_a: mapped.find(s=>s.id===c.snippetAId), snippet_b: mapped.find(s=>s.id===c.snippetBId) }));
  const { choices, flow } = simulateGame(()=>'right',()=>0.999,{ comparisons: pairs, questions: legacy.profileQuestions });
  assert.equal(choices.length,8);assert.equal(flow.length,13);
  const result=buildFinalResult(pairs,choices,legacy.profileQuestions.map(q=>({question_id:q.id,answer_value:'skipped'})),legacy.profileQuestions,legacy.DATASET);
  assert.equal(result.winner.examples,undefined);
  assert.equal(result.winner.code,replayTournament(pairs,choices).finalSnippet.code);
  assert.equal(Object.keys(result.selectedStyles).length,3);
});
