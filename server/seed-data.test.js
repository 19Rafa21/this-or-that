import test from 'node:test';
import assert from 'node:assert/strict';
import { snippets, comparisons, profileQuestions, CATEGORY_ORDER } from './seed-data.js';

test('extended study has seven dimensions, 14 comparisons and five profile questions', () => {
  assert.equal(CATEGORY_ORDER.length, 7);
  assert.equal(snippets.length, 39);
  assert.equal(comparisons.length, 40);
  assert.equal(profileQuestions.length, 5);
  assert.equal(CATEGORY_ORDER.reduce((sum, category) => sum + new Set(snippets.filter(s => s.category === category).map(s => s.style)).size - 1, 0), 14);
});
test('comparisons are unique, visibly different and share context and intention', () => {
  assert.equal(new Set(snippets.map(s => s.id)).size, snippets.length);
  assert.equal(new Set(comparisons.map(c => c.id)).size, comparisons.length);
  for (const c of comparisons) {
    const [a,b] = [c.snippetAId,c.snippetBId].map(id => snippets.find(s => s.id === id));
    assert.equal(a.category,c.category);assert.equal(b.category,c.category);
    assert.notEqual(a.style,b.style);assert.notEqual(a.code,b.code);
    assert.deepEqual(a.inheritedStyles,b.inheritedStyles);
    assert.equal(a.intentionPt,b.intentionPt);assert.equal(a.intentionEn,b.intentionEn);
    assert.ok(a.intentionPt && a.intentionEn);
  }
});
test('loops, conditions and functions retain the chosen block independently of other styles', () => {
  for (const s of snippets.filter(s=>['loops','conditionals','functions'].includes(s.category))) {
    const block=s.inheritedStyles.blocks;
    assert.deepEqual(Object.keys(s.inheritedStyles),['blocks']);
    assert.equal(s.code.includes('{'),block==='block_braces');
    assert.equal(s.code.includes('\nbegin\n'),block==='block_begin_end');
    if(block==='block_indent'){assert.match(s.code,/:\n {2}/);assert.ok(!s.code.includes('end;'));}
  }
});
test('condition and function pairs change only their respective headers', () => {
  for(const c of comparisons.filter(c=>['conditionals','functions'].includes(c.category))){
    const [a,b]=[c.snippetAId,c.snippetBId].map(id=>snippets.find(s=>s.id===id));
    const normalize=code=>code.replace(/^if .+$/m,'HEADER').replace(/^(function|def|fun) /m,'FUNCTION ');
    assert.equal(normalize(a.code),normalize(b.code));
  }
});
test('profile questions retain optional, bilingual and non-overlapping answer labels',()=>{
  for(const q of profileQuestions){
    assert.ok(q.questionPt && q.questionEn);
    assert.ok(q.options.some(o=>o.value==='prefer_not_answer'));
    assert.equal(new Set(q.options.map(o=>o.value)).size,q.options.length);
    assert.ok(q.options.every(o=>o.pt && o.en));
  }
});
