import test from 'node:test';
import assert from 'node:assert/strict';
import { newStage, generateStructure, renderOrderedCode, stagesFromSource } from './datasetStructure.js';
import { getCategoryOrder } from './categoryOrder.js';
import { buildFinalResult, replayTournament } from '../../server/tournament.js';
import { simulateGame } from '../../server/test-fixtures.js';
import { isCumulativeStudy } from './comparisonIndex.js';
import { buildInitialFlow } from './gameUtils.js';
function api(stages) {
  const { snippets, comparisons } = generateStructure(stages);
  const byId = new Map(snippets.map(s => [s.id, s]));
  return comparisons.map(c => ({ ...c, dataset_id: 'test', display_order: stages.findIndex(s => s.category === c.category),
    presentation: stages.find(s => s.category === c.category), snippet_a: byId.get(c.snippet_a_id), snippet_b: byId.get(c.snippet_b_id) }));
}
test('reordered, reduced and single-stage studies finish with their real preferences and wording', () => {
  for (const order of [['functions', 'logical', 'assignments', 'conditionals', 'loops', 'blocks', 'variables'], ['logical', 'variables'], ['functions'], ['loops', 'blocks', 'variables']]) {
    const stages = order.map(category => ({ ...newStage(category), styles: newStage(category).styles.slice(0, 2) }));
    const comparisons = api(stages);
    assert.deepEqual(getCategoryOrder(comparisons), order);
    assert.equal(isCumulativeStudy(comparisons), true);
    for (const c of comparisons) {
      assert.notEqual(c.snippet_a.code, c.snippet_b.code);
      assert.deepEqual(c.snippet_a.inherited_styles, c.snippet_b.inherited_styles);
    }
    for (const decision of [() => 'left', () => 'right', () => 'skip']) {
      const { choices, flow } = simulateGame(decision, () => .99, { comparisons, questions: [] });
      assert.equal(choices.length, order.length);
      assert.deepEqual(flow.map(s => s.presentation.title_pt), stages.map(s => s.title_pt));
      const replay = replayTournament(comparisons, choices);
      assert.equal(replay.complete, true);
      assert.deepEqual(Object.keys(replay.carriedStyles), order);
      assert.equal(replay.finalSnippet.code, renderOrderedCode(replay.carriedStyles));
      const result = buildFinalResult(comparisons, choices, [], [], { id: 'test', version: 'test' });
      assert.equal(result.winner.code, replay.finalSnippet.code);
      assert.equal(result.winner.examples, undefined);
    }
  }
});
test('many profile questions have valid boundaries and preserve order', () => {
  const stages = ['functions', 'loops', 'logical', 'variables'].map(newStage);
  const comparisons = api(stages);
  const questions = Array.from({ length: 20 }, (_, i) => ({ id: `q-${i}` }));
  const initial = buildInitialFlow(comparisons, questions, getCategoryOrder(comparisons), () => .99);
  assert.ok(initial.filter(s => s.type === 'profile').every(s => stages.some(stage => stage.category === s.afterCategory)));
  const { flow } = simulateGame(() => 'right', () => .99, { comparisons, questions });
  assert.deepEqual(flow.filter(s => s.type === 'profile').map(s => s.id), questions.map(q => q.id));
  assert.equal(flow.length, stages.reduce((n, s) => n + s.styles.length - 1, 0) + questions.length);
});

test('a custom alternative participates in every round and reaches the final code and labels', () => {
  const stages = ['variables', 'loops'].map(newStage);
  const option = {id:'custom_let',pt:'Com let',en:'With let',baseStyle:'java_style',from:'var ',to:'let '};
  stages[0].customOptions = [option]; stages[0].styles = ['c_style',option.id];
  stages[1].styles = ['loop_while','loop_for_counter'];
  const comparisons = api(stages);
  const restored = stagesFromSource(comparisons.flatMap(c => [c.snippet_a,c.snippet_b]), comparisons);
  assert.deepEqual(restored[0].customOptions, [option]);
  const {choices} = simulateGame((_index, step) => step.rightSnippet.style === option.id ? 'right' : step.leftSnippet.style === option.id ? 'left' : 'right', () => .99, {comparisons,questions:[]});
  const result = buildFinalResult(comparisons,choices,[],[],{id:'custom',version:'custom'});
  assert.equal(result.selectedStyles.variables, option.id);
  assert.ok(result.winner.code.includes('let i = 0;'));
  assert.equal(result.winner.styleLabels[option.id].pt, 'Com let');
});
