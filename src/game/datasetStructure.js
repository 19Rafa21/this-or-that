import { cumulativeOptions, renderCumulativeCode } from './cumulativeCode.js';
import { getCategoryOrder } from './categoryOrder.js';
import resultsTranslations from '../i18n/resultsTranslations.js';

export function stagesFromSource(snippets, comparisons) {
  return getCategoryOrder(comparisons).map(category => {
    const pair = comparisons.find(c => c.category === category);
    const example = snippets.find(s => s.category === category);
    return { category, styles: [...new Set(snippets.filter(s => s.category === category).map(s => s.style))],
      title_pt: pair?.presentation?.title_pt || resultsTranslations.pt.categories[category] || category,
      title_en: pair?.presentation?.title_en || resultsTranslations.en.categories[category] || category,
      question_pt: pair?.presentation?.question_pt || 'Qual destas opções preferes?',
      question_en: pair?.presentation?.question_en || 'Which option do you prefer?',
      intention_pt: pair?.presentation?.intention_pt || example?.intention_pt || '',
      intention_en: pair?.presentation?.intention_en || example?.intention_en || '' };
  });
}
export const structureKey = stages => JSON.stringify(stages.map(({ category, styles }) => ({ category, styles: [...styles].sort() })));
export function newStage(category) {
  return { category, styles: [...cumulativeOptions[category]],
    title_pt: resultsTranslations.pt.categories[category], title_en: resultsTranslations.en.categories[category],
    question_pt: 'Qual destas opções preferes?', question_en: 'Which option do you prefer?',
    intention_pt: 'Compara as alternativas destacadas. As escolhas anteriores mantêm-se.',
    intention_en: 'Compare the highlighted alternatives. Previous choices are retained.' };
}

// Supply neutral scaffolding when a decision appears before its usual dependencies.
// Only actual decisions enter inherited_styles; scaffolding is never a recorded preference.
export function renderOrderedCode(styles) {
  const context = { ...styles };
  if (context.logical) context.conditionals ||= 'condition_parenthesized';
  if (context.conditionals || context.assignments) context.loops ||= 'loop_while';
  if (context.loops || context.functions) context.blocks ||= 'block_braces';
  context.variables ||= 'c_style';
  return renderCumulativeCode(context);
}
export function generateStructure(stages) {
  const snippets = [], comparisons = [];
  function expand(index, inherited, path) {
    const stage = stages[index];
    if (!stage) return;
    const alternatives = stage.styles.map((style, n) => {
      const branch = [...path, n];
      const context = { ...inherited, [stage.category]: style };
      const snippet = { id: `generated:${stage.category}:${branch.join('-')}`, category: stage.category,
        language: `${stage.category}_${branch.join('_')}`, style, source_language: 'experimental',
        inherited_styles: { ...inherited }, label: style, code: renderOrderedCode(context),
        intention_pt: stage.intention_pt, intention_en: stage.intention_en };
      snippets.push(snippet);
      expand(index + 1, context, branch);
      return snippet;
    });
    for (let a = 0; a < alternatives.length; a++) for (let b = a + 1; b < alternatives.length; b++) {
      comparisons.push({ id: `generated:${stage.category}:${path.join('-') || 'root'}:${a}-${b}`,
        category: stage.category, snippet_a_id: alternatives[a].id, snippet_b_id: alternatives[b].id,
        validation_notes: 'Cumulative alternatives generated for the configured stage order.', progressive: true });
    }
  }
  expand(0, {}, []);
  return { snippets, comparisons };
}
