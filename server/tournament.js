export const CATEGORY_ORDER = ["variables", "loops", "conditionals"];

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function check(condition, message) {
  if (!condition) throw new InputError(message);
}

function sameContext(snippet, styles) {
  const context = snippet.inherited_styles || {};
  return Object.keys(context).length === Object.keys(styles).length &&
    Object.entries(styles).every(([key, value]) => context[key] === value);
}

// Skipping carries the left snippet for composition, not as a preference.
export function replayTournament(comparisons, choices) {
  const byId = new Map(comparisons.map((item) => [item.id, item]));
  const carriedStyles = {};
  const selectedStyles = {};
  const categoryResults = [];
  let offset = 0;
  let finalSnippet = null;
  for (const category of CATEGORY_ORDER) {
    const available = new Map();
    for (const comparison of comparisons.filter((item) => item.category === category)) {
      for (const snippet of [comparison.snippet_a, comparison.snippet_b]) {
        if (sameContext(snippet, carriedStyles)) available.set(snippet.id, snippet);
      }
    }
    check(available.size >= 2, `Missing dataset category: ${category}`);
    const rounds = available.size - 1;
    const seen = new Set();
    let contender = null;
    let skippedCount = 0;
    for (let round = 0; round < rounds; round += 1) {
      const choice = choices[offset];
      if (!choice) return { complete: false, carriedStyles, selectedStyles, categoryResults, finalSnippet };
      check(choice.round_number === offset + 1, "Rounds must be consecutive");
      const comparison = byId.get(choice.comparison_id);
      check(comparison?.category === category && choice.category === category, "Unexpected category or comparison");
      const pair = new Set([comparison.snippet_a.id, comparison.snippet_b.id]);
      const left = choice.left_snippet_id;
      const right = choice.right_snippet_id;
      check(left !== right && pair.has(left) && pair.has(right), "Choice does not match comparison");
      check(available.has(left) && available.has(right), "Inherited styles do not match previous category");
      if (round > 0) {
        check(left === contender, "Previous winner must continue on the left");
        check(!seen.has(right), "A challenger cannot appear twice");
      }
      check(typeof choice.skipped === "boolean", "Invalid skip flag");
      check(choice.skipped ? choice.selected_snippet_id == null : pair.has(choice.selected_snippet_id), "Invalid selection");
      seen.add(left);
      seen.add(right);
      contender = choice.skipped ? left : choice.selected_snippet_id;
      skippedCount += Number(choice.skipped);
      offset += 1;
    }
    finalSnippet = available.get(contender);
    carriedStyles[category] = finalSnippet.style;
    selectedStyles[category] = skippedCount === 0 ? finalSnippet.style : null;
    categoryResults.push({ category, carriedSnippetId: contender, carriedStyle: finalSnippet.style,
      selectedStyle: selectedStyles[category], status: skippedCount === 0 ? "confirmed" : "incomplete", skippedCount, rounds });
  }
  check(offset === choices.length, "Too many rounds");
  return { complete: true, carriedStyles, selectedStyles, categoryResults, finalSnippet };
}

export function buildFinalResult(comparisons, choices, profileAnswers, questions, dataset) {
  const replay = replayTournament(comparisons, choices);
  check(replay.complete, "The tournament is not complete");
  check(questions.every((question) => profileAnswers.some((answer) => answer.question_id === question.id)), "Profile questions must be answered or explicitly skipped");
  const hasSkippedComparisons = choices.some((choice) => choice.skipped);
  return {
    protocolVersion: 4, datasetId: dataset.id, datasetVersion: dataset.version,
    selectedStyles: replay.selectedStyles, carriedStyles: replay.carriedStyles,
    categoryResults: replay.categoryResults, hasSkippedComparisons,
    winner: { language: "text", code: replay.finalSnippet.code, selectedStyles: replay.selectedStyles,
      carriedStyles: replay.carriedStyles, hasSkippedComparisons },
    answers: choices, profileAnswers,
  };
}
