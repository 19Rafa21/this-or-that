export const SKIPPED_VALUE = "skipped";

const EXCLUDED_LANGUAGES = new Set([SKIPPED_VALUE, "unknown", ""]);

export function getWinningLanguage(answers = []) {
  const counts = {};
  const firstSeenAt = {};

  answers.forEach((answer, index) => {
    const selectedLanguage = String(answer?.selectedLanguage || "").trim();

    if (EXCLUDED_LANGUAGES.has(selectedLanguage)) return;

    counts[selectedLanguage] = (counts[selectedLanguage] || 0) + 1;

    if (firstSeenAt[selectedLanguage] === undefined) {
      firstSeenAt[selectedLanguage] = index;
    }
  });

  const winner = Object.entries(counts).sort(
    ([languageA, countA], [languageB, countB]) =>
      countB - countA || firstSeenAt[languageA] - firstSeenAt[languageB]
  )[0]?.[0];

  return { winner: winner || null, counts };
}

export function isValidStoredGameState(value) {
  return Boolean(
    value &&
      Array.isArray(value.flow) &&
      value.flow.length > 0 &&
      Number.isInteger(value.currentIndex) &&
      value.currentIndex >= 0 &&
      value.currentIndex < value.flow.length &&
      Array.isArray(value.answers) &&
      Array.isArray(value.profileAnswers) &&
      Array.isArray(value.dreamCode)
  );
}

export function readStoredGame(storage) {
  const sessionId = storage.getItem("sessionId");
  const serializedState = storage.getItem("gameState");

  if (!sessionId || !serializedState) return null;

  try {
    const gameState = JSON.parse(serializedState);
    return isValidStoredGameState(gameState) ? { sessionId, gameState } : null;
  } catch {
    return null;
  }
}

export function readStoredWinner(storage) {
  const serializedWinner = storage.getItem("finalWinner");

  if (!serializedWinner) return null;

  try {
    const winner = JSON.parse(serializedWinner);
    return winner && typeof winner === "object" && typeof winner.code === "string"
      ? winner
      : null;
  } catch {
    return null;
  }
}
