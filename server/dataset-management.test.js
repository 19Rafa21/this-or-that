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

test('custom alternatives propagate through later stages and retain bilingual names', () => {
  const content = draft();
  const option = { id: 'custom_let', pt: 'Declaração com let', en: 'Let declaration', baseStyle: 'java_style', from: 'var ', to: 'let ' };
  content.stages[0].customOptions = [option];
  content.stages[0].styles.push(option.id);
  Object.assign(content, { generated: true, structureKey: structureKey(content.stages), snippets: generateStructure(content.stages).snippets });
  assert.doesNotThrow(() => validateDraft(content, source));
  const later = content.snippets.filter(s => s.category === 'loops' && s.inherited_styles.variables === option.id);
  assert.equal(later.length, 3);
  assert.ok(later.every(s => s.code.includes('let i = 0;') && !s.code.includes('var ')));
  assert.equal(content.snippets.find(s => s.style === option.id).label, option.pt);
  content.stages[0].customOptions[0].to = 'const ';
  assert.throws(() => validateDraft(content, source), /Regenera/);
});

test('custom alternatives reject missing matches, invalid definitions and excessive graphs', () => {
  for (const patch of [{from: 'missing fragment'}, {pt: ''}, {to: 'var '}, {baseStyle: 'custom_other'}, {id: '__proto__'}]) {
    const content = draft();
    const option = {id: 'custom_let', pt: 'Let', en: 'Let', baseStyle: 'java_style', from: 'var ', to: 'let ', ...patch};
    content.stages[0].customOptions = [option]; content.stages[0].styles.push(option.id);
    content.generated = true; content.structureKey = structureKey(content.stages);
    assert.throws(() => validateDraft(content, source), error => error.status === 400);
  }
  const many = ['variables','blocks','loops','conditionals','assignments','logical','functions'].map(newStage);
  for (const stage of many) {
    stage.customOptions = Array.from({length: 8}, (_, i) => ({id:`custom_${stage.category}-${i}`,pt:`Opção ${i}`,en:`Option ${i}`,baseStyle:stage.styles[0],from:'i',to:`i${i}`}));
    stage.styles.push(...stage.customOptions.map(o => o.id));
  }
  assert.throws(() => validateDraft({...draft(),stages:many},source), /Demasiadas/);
});

test('custom structure keys survive JSONB property reordering', () => {
  const content = draft();
  content.stages[0].customOptions = [{id:'custom_let',pt:'Let',en:'Let',baseStyle:'java_style',from:'var ',to:'let '}];
  content.stages[0].styles.push('custom_let');
  Object.assign(content, {generated:true,structureKey:structureKey(content.stages),snippets:generateStructure(content.stages).snippets});
  content.stages[0].customOptions = content.stages[0].customOptions.map(o => Object.fromEntries(Object.entries(o).reverse()));
  assert.doesNotThrow(() => validateDraft(content, source));
});
