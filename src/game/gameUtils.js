export const SKIPPED_VALUE = "skipped";
export const GAME_STATE_VERSION = 4;

const EXCLUDED_LANGUAGES = new Set([SKIPPED_VALUE, "unknown", ""]);

export function shuffleItems(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [
      shuffled[otherIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function hasInheritedStyles(snippet, selectedStyles) {
  const inheritedStyles = snippet.inherited_styles || {};

  return Object.entries(inheritedStyles).every(
    ([category, style]) => selectedStyles[category] === style
  );
}

export function buildCategoryTournament(
  comparisons,
  category,
  random,
  selectedStyles = {}
) {
  const categoryComparisons = comparisons.filter(
    (comparison) =>
      comparison.category === category &&
      hasInheritedStyles(comparison.snippet_a, selectedStyles) &&
      hasInheritedStyles(comparison.snippet_b, selectedStyles)
  );
  const snippetsById = new Map();
  const comparisonsByPair = new Map();

  categoryComparisons.forEach((comparison) => {
    snippetsById.set(comparison.snippet_a.id, comparison.snippet_a);
    snippetsById.set(comparison.snippet_b.id, comparison.snippet_b);
    comparisonsByPair.set(
      [comparison.snippet_a.id, comparison.snippet_b.id].sort().join(":"),
      comparison
    );
  });

  const snippets = shuffleItems([...snippetsById.values()], random);

  if (snippets.length < 2) {
    throw new Error(`missing-comparison-${category}`);
  }

  return snippets.slice(1).map((challenger, roundIndex) => {
    const possibleContenders = snippets.slice(0, roundIndex + 1);
    const comparisonOptions = {};

    possibleContenders.forEach((contender) => {
      const pairKey = [contender.id, challenger.id].sort().join(":");
      const comparison = comparisonsByPair.get(pairKey);

      if (!comparison) {
        throw new Error(`missing-comparison-${category}-${pairKey}`);
      }

      comparisonOptions[contender.id] = {
        id: comparison.id,
        datasetId: comparison.dataset_id,
      };
    });

    return {
      type: "code",
      category,
      categoryRound: roundIndex + 1,
      categoryRoundCount: snippets.length - 1,
      leftSnippet: roundIndex === 0 ? snippets[0] : null,
      rightSnippet: challenger,
      comparisonOptions,
    };
  });
}

export function prepareTournamentSteps(rounds, firstRoundNumber = 1) {
  return rounds.map((step, index) => ({
    ...step,
    comparisonNumber: firstRoundNumber + index,
    ...(step.leftSnippet
      ? {
          id: step.comparisonOptions[step.leftSnippet.id].id,
          datasetId: step.comparisonOptions[step.leftSnippet.id].datasetId,
        }
      : {}),
  }));
}

export function buildInitialFlow(comparisons, questions, categoryOrder, random) {
  return [
    ...prepareTournamentSteps(buildCategoryTournament(comparisons, categoryOrder[0], random)),
    ...questions.map((question, index) => ({
      ...question,
      type: "profile",
      afterCategory: categoryOrder[Math.min(categoryOrder.length - 1, Math.floor(index / 2))],
    })),
  ];
}

export function countPlannedCodeQuestions(comparisons, categoryOrder) {
  return categoryOrder.reduce((total, category) => {
    const styles = new Set();

    comparisons
      .filter((comparison) => comparison.category === category)
      .forEach((comparison) => {
        styles.add(comparison.snippet_a.style);
        styles.add(comparison.snippet_b.style);
      });

    return total + Math.max(styles.size - 1, 0);
  }, 0);
}

export function continueTournament(flow, currentIndex, selectedSnippet) {
  const currentStep = flow[currentIndex];
  const nextStep = flow[currentIndex + 1];

  if (
    !nextStep ||
    nextStep.type !== "code" ||
    nextStep.category !== currentStep.category
  ) {
    return flow;
  }

  const comparison = nextStep.comparisonOptions[selectedSnippet.id];

  if (!comparison) {
    throw new Error(`missing-next-comparison-${selectedSnippet.id}`);
  }

  const nextFlow = [...flow];
  const keepRight = currentStep.rightSnippet.id === selectedSnippet.id;
  nextFlow[currentIndex + 1] = {
    ...nextStep,
    id: comparison.id,
    datasetId: comparison.datasetId,
    leftSnippet: keepRight ? nextStep.rightSnippet : selectedSnippet,
    rightSnippet: keepRight ? selectedSnippet : nextStep.rightSnippet,
  };

  return nextFlow;
}

export function isCategoryFinal(step, nextStep) {
  return (
    !nextStep ||
    nextStep.type !== "code" ||
    nextStep.category !== step.category
  );
}

export function resolveCumulativeChoice({
  flow,
  currentIndex,
  selectedSnippet,
  comparisons,
  categoryOrder,
  selectedStyles,
  nextRoundNumber,
  random,
}) {
  const currentStep = flow[currentIndex];
  let nextFlow = continueTournament(flow, currentIndex, selectedSnippet);

  if (!isCategoryFinal(currentStep, flow[currentIndex + 1])) {
    return { flow: nextFlow, selectedStyles, categoryFinished: false };
  }

  const updatedStyles = {
    ...selectedStyles,
    [currentStep.category]: selectedSnippet.style,
  };
  const categoryIndex = categoryOrder.indexOf(currentStep.category);
  const nextCategory = categoryOrder[categoryIndex + 1];

  if (nextCategory) {
    const nextRounds = prepareTournamentSteps(
      buildCategoryTournament(
        comparisons,
        nextCategory,
        random,
        updatedStyles
      ),
      nextRoundNumber
    );
    nextFlow = [...nextFlow];
    let insertionIndex = currentIndex + 1;
    while (nextFlow[insertionIndex]?.type === "profile" &&
      nextFlow[insertionIndex].afterCategory === currentStep.category) {
      insertionIndex += 1;
    }
    nextFlow.splice(insertionIndex, 0, ...nextRounds);
  }

  return {
    flow: nextFlow,
    selectedStyles: updatedStyles,
    categoryFinished: true,
  };
}

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
      value.stateVersion === GAME_STATE_VERSION &&
      Array.isArray(value.flow) &&
      value.flow.length > 0 &&
      Number.isInteger(value.currentIndex) &&
      value.currentIndex >= 0 &&
      value.currentIndex < value.flow.length &&
      Array.isArray(value.answers) &&
      Array.isArray(value.profileAnswers) &&
      Array.isArray(value.dreamCode) &&
      Array.isArray(value.comparisons) &&
      Array.isArray(value.categoryWinners) &&
      value.selectedStyles &&
      typeof value.selectedStyles === "object"
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
