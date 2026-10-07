import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft } from './dataset-management.js';
import { newStage, generateStructure, structureKey } from '../src/game/datasetStructure.js';
const stages = [newStage('variables'), newStage('loops')];
const source = {
  questions: [{ id: 'age', question_pt: 'Idade?', question_en: 'Age?', options: [{ value: 'a', pt: 'Até 18', en: 'Under 18' }, { value: 'b', pt: '18 ou mais', en: '18 or older' }] }],
  stages, ...generateStructure(stages),
};
const draft = () => ({ ...structuredClone(source), version: 'new', description: 'Updated examples' });
test('draft edits participant wording and code', () => {
  const content = draft(); content.questions[0].options[0].pt = 'Menos de 18'; content.snippets[0].code = 'x := 1';
  content.stages[0].title_pt = 'Novo título';
  assert.doesNotThrow(() => validateDraft(content, source));
});
test('profile questions and options can be added, removed and reordered, including no profile', () => {
  const content = draft();
  content.questions.push({ ...structuredClone(content.questions[0]), id: 'new-question' });
  content.questions.reverse();
  content.questions[0].options.push({ value: 'new', pt: 'Nova', en: 'New' });
  content.questions[0].options.reverse();
  assert.doesNotThrow(() => validateDraft(content, source));
  content.questions = [];
  assert.doesNotThrow(() => validateDraft(content, source));
});
test('structural edits require regeneration and accept rebuilt snippets', () => {
  const content = draft(); content.stages.reverse();
  assert.throws(() => validateDraft(content, source), /Regenera/);
  Object.assign(content, { generated: true, structureKey: structureKey(content.stages), snippets: generateStructure(content.stages).snippets });
  assert.doesNotThrow(() => validateDraft(content, source));
  content.stages.pop();
  assert.throws(() => validateDraft(content, source), /Regenera/);
});
test('draft rejects malformed, duplicate, incomplete or missing graph content', () => {
  for (const mutate of [
    c => { c.questions[0] = null; },
    c => { c.questions.push(c.questions[0]); },
    c => { c.questions[0].options[0] = null; },
    c => { c.questions[0].options[0].value = 'skipped'; },
    c => { c.questions[0].options[0].value = c.questions[0].options[1].value; },
    c => { c.questions[0].options.pop(); },
    c => { c.stages = []; },
    c => { c.stages.push(c.stages[0]); },
    c => { c.stages[0].styles = ['c_style']; },
    c => { c.stages[0].title_en = ''; },
    c => { c.snippets.pop(); },
    c => { c.snippets[0].code = ' '; },
    c => { c.snippets[0].code = 'x'.repeat(20001); },
    c => { c.version = ''; },
  ]) {
    const content = draft(); mutate(content);
    assert.throws(() => validateDraft(content, source), error => error.status === 400);
  }
});
