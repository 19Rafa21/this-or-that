import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCategoryTournament,
  continueTournament,
  countPlannedCodeQuestions,
  GAME_STATE_VERSION,
  getWinningLanguage,
  isValidStoredGameState,
  readStoredGame,
  readStoredWinner,
  resolveCumulativeChoice,
} from "./gameUtils.js";

const snippet = (id) => ({ id, language: id, style: id, code: id });

function tournamentComparisons() {
  const snippets = ["a", "b", "c", "d"].map(snippet);
  const comparisons = [];

  for (let left = 0; left < snippets.length; left += 1) {
    for (let right = left + 1; right < snippets.length; right += 1) {
      comparisons.push({
        id: `${snippets[left].id}-vs-${snippets[right].id}`,
        dataset_id: "test-dataset",
        category: "variables",
        snippet_a: snippets[left],
        snippet_b: snippets[right],
      });
    }
  }

  return comparisons;
}

function createStorage(values = {}) {
  return {
    getItem(key) {
      return Object.hasOwn(values, key) ? values[key] : null;
    },
  };
}

test("exclui skips e valores desconhecidos da contagem", () => {
  const result = getWinningLanguage([
    { selectedLanguage: "skipped" },
    { selectedLanguage: "unknown" },
    { selectedLanguage: "python" },
    { selectedLanguage: "python" },
    { selectedLanguage: "javascript" },
  ]);

  assert.equal(result.winner, "python");
  assert.deepEqual(result.counts, { python: 2, javascript: 1 });
});

test("resolve empates pela linguagem válida escolhida primeiro", () => {
  const result = getWinningLanguage([
    { selectedLanguage: "javascript" },
    { selectedLanguage: "python" },
  ]);

  assert.equal(result.winner, "javascript");
});

test("devolve vencedor nulo quando todas as perguntas foram ignoradas", () => {
  assert.deepEqual(getWinningLanguage([{ selectedLanguage: "skipped" }]), {
    winner: null,
    counts: {},
  });
});

test("calcula o número de rondas a partir dos estilos disponíveis", () => {
  const comparisons = tournamentComparisons();

  assert.equal(countPlannedCodeQuestions(comparisons, ["variables"]), 3);
});

test("cria uma ronda por desafiante numa categoria", () => {
  const rounds = buildCategoryTournament(
    tournamentComparisons(),
    "variables",
    () => 0.999
  );

  assert.equal(rounds.length, 3);
  assert.equal(rounds[0].leftSnippet.id, "a");
  assert.equal(rounds[0].rightSnippet.id, "b");
  assert.equal(rounds[1].leftSnippet, null);
  assert.equal(rounds[1].rightSnippet.id, "c");
});

test("mantém o vencedor como participante da ronda seguinte", () => {
  const rounds = buildCategoryTournament(
    tournamentComparisons(),
    "variables",
    () => 0.999
  );
  const firstComparison = rounds[0].comparisonOptions.a;
  const flow = [
    { ...rounds[0], id: firstComparison.id },
    rounds[1],
    rounds[2],
  ];

  const afterFirstChoice = continueTournament(flow, 0, flow[0].rightSnippet);
  assert.equal(afterFirstChoice[1].leftSnippet.id, "c");
  assert.equal(afterFirstChoice[1].rightSnippet.id, "b");
  assert.equal(afterFirstChoice[1].id, "b-vs-c");

  const afterSecondChoice = continueTournament(
    afterFirstChoice,
    1,
    afterFirstChoice[1].leftSnippet
  );
  assert.equal(afterSecondChoice[2].leftSnippet.id, "c");
  assert.equal(afterSecondChoice[2].rightSnippet.id, "d");
  assert.equal(afterSecondChoice[2].id, "c-vs-d");
});

test("mantém escolhas consecutivas à direita e preserva o fluxo original", () => {
  const flow = buildCategoryTournament(tournamentComparisons(), "variables", () => 0.999);
  const first = continueTournament(flow, 0, flow[0].rightSnippet);
  const second = continueTournament(first, 1, first[1].rightSnippet);
  assert.equal(second[2].rightSnippet.id, "b");
  assert.equal(second[2].leftSnippet.id, "d");
  assert.equal(second[2].id, "b-vs-d");
  assert.equal(flow[1].leftSnippet, null);
  assert.equal(flow[1].rightSnippet.id, "c");
});

test("mantém escolhas à esquerda, incluindo o contexto usado ao saltar", () => {
  const flow = buildCategoryTournament(tournamentComparisons(), "variables", () => 0.999);
  const next = continueTournament(flow, 0, flow[0].leftSnippet);
  assert.equal(next[1].leftSnippet.id, "a");
  assert.equal(next[1].rightSnippet.id, "c");
  assert.equal(next[1].id, "a-vs-c");
});

test("usa o estilo vencedor para preparar a categoria seguinte", () => {
  const declarationA = {
    id: "declaration-a",
    language: "declaration-a",
    style: "a",
    code: "declaration a",
    inherited_styles: {},
  };
  const declarationB = {
    id: "declaration-b",
    language: "declaration-b",
    style: "b",
    code: "declaration b",
    inherited_styles: {},
  };
  const loopA = {
    id: "loop-a-with-b",
    language: "loop-a-with-b",
    style: "a",
    code: "declaration b and loop a",
    inherited_styles: { variables: "b" },
  };
  const loopB = {
    id: "loop-b-with-b",
    language: "loop-b-with-b",
    style: "b",
    code: "declaration b and loop b",
    inherited_styles: { variables: "b" },
  };
  const comparisons = [
    {
      id: "declarations",
      dataset_id: "test-dataset",
      category: "variables",
      snippet_a: declarationA,
      snippet_b: declarationB,
    },
    {
      id: "loops-with-b",
      dataset_id: "test-dataset",
      category: "loops",
      snippet_a: loopA,
      snippet_b: loopB,
    },
  ];
  const variableRounds = buildCategoryTournament(comparisons, "variables");
  const flow = [
    {
      ...variableRounds[0],
      id: "declarations",
      comparisonNumber: 1,
    },
    { id: "profile-question", type: "profile" },
  ];

  const result = resolveCumulativeChoice({
    flow,
    currentIndex: 0,
    selectedSnippet: declarationB,
    comparisons,
    categoryOrder: ["variables", "loops"],
    selectedStyles: {},
    nextRoundNumber: 2,
    random: () => 0.999,
  });

  assert.deepEqual(result.selectedStyles, { variables: "b" });
  assert.equal(result.flow[1].category, "loops");
  assert.equal(result.flow[1].leftSnippet.inherited_styles.variables, "b");
  assert.equal(result.flow[1].rightSnippet.inherited_styles.variables, "b");
  assert.equal(result.flow[2].type, "profile");
});

test("valida e recupera uma sessão guardada", () => {
  const gameState = {
    stateVersion: GAME_STATE_VERSION,
    flow: [{ type: "code" }],
    currentIndex: 0,
    answers: [],
    profileAnswers: [],
    dreamCode: [],
    comparisons: [],
    selectedStyles: {},
    categoryWinners: [],
  };
  const storage = createStorage({
    sessionId: "session-1",
    gameState: JSON.stringify(gameState),
  });

  assert.equal(isValidStoredGameState(gameState), true);
  assert.deepEqual(readStoredGame(storage), {
    sessionId: "session-1",
    gameState,
  });
});

test("ignora estado e resultado JSON inválidos", () => {
  assert.equal(
    readStoredGame(createStorage({ sessionId: "session-1", gameState: "{" })),
    null
  );
  assert.equal(
    readStoredWinner(createStorage({ finalWinner: "not-json" })),
    null
  );
});
