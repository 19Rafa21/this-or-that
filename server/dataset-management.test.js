import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft } from './dataset-management.js';
const source = {
  questions: [{ id: 'age', question_pt: 'Idade?', question_en: 'Age?', options: [{ value: 'a', pt: 'Até 18', en: 'Under 18' }, { value: 'b', pt: '18 ou mais', en: '18 or older' }] }],
  snippets: [{ id: 'example', label: 'Exemplo', code: 'x = 1', intention_pt: 'Declarar x', intention_en: 'Declare x' }],
};
const draft = () => ({ ...structuredClone(source), version: 'new', description: 'Updated examples' });
test('draft edits wording and code while retaining option identity', () => {
  const content = draft(); content.questions[0].options[0].pt = 'Menos de 18'; content.snippets[0].code = 'x := 1';
  assert.doesNotThrow(() => validateDraft(content, source));
});
test('draft rejects removed, duplicated, malformed or renamed content', () => {
  for (const mutate of [
    (c) => { c.questions = []; },
    (c) => { c.questions[0] = null; },
    (c) => { c.questions[0].id = 'other'; },
    (c) => { c.questions[0].options[0] = null; },
    (c) => { c.questions[0].options[0].value = 'other'; },
    (c) => { c.questions[0].options.reverse(); },
    (c) => { c.snippets[0].code = ' '; },
    (c) => { c.snippets[0].code = 'x'.repeat(20001); },
    (c) => { c.version = ''; },
  ]) {
    const content = draft(); mutate(content);
    assert.throws(() => validateDraft(content, source), (error) => error.status === 400);
  }
});
