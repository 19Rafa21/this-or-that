import { comparisonIndex, contextComparisons, isCumulativeStudy } from "../src/game/comparisonIndex.js";
import { getCategoryOrder, EXTENDED_CATEGORY_ORDER } from "../src/game/categoryOrder.js";
export const CATEGORY_ORDER = EXTENDED_CATEGORY_ORDER;

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
  return Object.entries(context).every(([key, value]) => styles[key] === value);
}

// Skipping carries the left snippet for composition, not as a preference.
export function replayTournament(comparisons, choices) {
  const byId = comparisonIndex(comparisons).byId;
  const carriedStyles = {};
  const selectedStyles = {};
  const categoryResults = [];
  let offset = 0;
  let finalSnippet = null;
  for (const category of getCategoryOrder(comparisons)) {
    const available = new Map();
    for (const comparison of contextComparisons(comparisons, category, carriedStyles)) {
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
        check(left === contender || right === contender, "Previous winner must continue in the next pair");
        const challenger = left === contender ? right : left;
        check(!seen.has(challenger), "A challenger cannot appear twice");
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
  const examples = !isCumulativeStudy(comparisons) && comparisons.some((c) => c.category === 'blocks') ? replay.categoryResults.map((category) => {
    const snippet = comparisons.flatMap((c) => [c.snippet_a, c.snippet_b]).find((s) => s.id === category.carriedSnippetId);
    return { category: category.category, code: snippet.code, status: category.status };
  }) : null;
  const hasSkippedComparisons = choices.some((choice) => choice.skipped);
  return {
    protocolVersion: 4, datasetId: dataset.id, datasetVersion: dataset.version,
    selectedStyles: replay.selectedStyles, carriedStyles: replay.carriedStyles,
    categoryResults: replay.categoryResults, hasSkippedComparisons,
    winner: { language: "text", code: examples ? examples.map((e) => `${e.category}\n${e.code}`).join("\n\n") : replay.finalSnippet.code, ...(examples ? { examples } : {}), selectedStyles: replay.selectedStyles,
      carriedStyles: replay.carriedStyles, hasSkippedComparisons },
    answers: choices, profileAnswers,
  };
}
