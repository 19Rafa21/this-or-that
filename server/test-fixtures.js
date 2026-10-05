import { snippets, comparisons, profileQuestions } from "./seed-data.js";
import { buildInitialFlow, resolveCumulativeChoice } from "../src/game/gameUtils.js";
import { CATEGORY_ORDER } from "./tournament.js";

export const apiSnippets = snippets.map((item) => ({ id: item.id, category: item.category,
  dataset_id: item.datasetId, language: item.language, style: item.style, source_language: item.sourceLanguage,
  inherited_styles: item.inheritedStyles, label: item.label, code: item.code,
  intention_pt: item.intentionPt, intention_en: item.intentionEn }));
export const apiComparisons = comparisons.map((item) => ({ id: item.id, category: item.category,
  dataset_id: item.datasetId, snippet_a: apiSnippets.find((s) => s.id === item.snippetAId),
  snippet_b: apiSnippets.find((s) => s.id === item.snippetBId) }));

export function simulateGame(decision = () => "left", random = () => 0.999) {
  let flow = buildInitialFlow(apiComparisons, profileQuestions, CATEGORY_ORDER, random);
  let selectedStyles = {};
  const choices = [];
  for (let index = 0; index < flow.length; index += 1) {
    const step = flow[index];
    if (step.type !== "code") continue;
    const side = decision(choices.length, step);
    const selected = side === "right" ? step.rightSnippet : step.leftSnippet;
    choices.push({ comparison_id: step.id, round_number: step.comparisonNumber, category: step.category,
      left_snippet_id: step.leftSnippet.id, right_snippet_id: step.rightSnippet.id,
      selected_snippet_id: side === "skip" ? null : selected.id, skipped: side === "skip" });
    const resolution = resolveCumulativeChoice({ flow, currentIndex: index, selectedSnippet: selected,
      comparisons: apiComparisons, categoryOrder: CATEGORY_ORDER, selectedStyles,
      nextRoundNumber: choices.length + 1, random });
    flow = resolution.flow;
    selectedStyles = resolution.selectedStyles;
  }
  return { choices, flow, selectedStyles };
}
