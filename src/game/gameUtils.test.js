import test from "node:test";
import assert from "node:assert/strict";
import {
  getWinningLanguage,
  isValidStoredGameState,
  readStoredGame,
  readStoredWinner,
} from "./gameUtils.js";

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

test("valida e recupera uma sessão guardada", () => {
  const gameState = {
    flow: [{ type: "code" }],
    currentIndex: 0,
    answers: [],
    profileAnswers: [],
    dreamCode: [],
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
