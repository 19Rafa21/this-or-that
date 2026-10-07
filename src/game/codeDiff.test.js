import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCode } from './codeDiff.js';
import { renderCumulativeCode } from './cumulativeCode.js';
const changed = parts => parts.filter(p=>p.changed).map(p=>p.text).join('');
test('diff preserves exact code and marks only the changing function keyword', () => {
  const styles = {variables:'pascal_style',blocks:'block_begin_end',loops:'loop_for_counter',conditionals:'condition_then',assignments:'assignment_colon',logical:'logic_words'};
  const left=renderCumulativeCode({...styles,functions:'function_def'});
  const right=renderCumulativeCode({...styles,functions:'function_fun'});
  const diff=compareCode(left,right);
  assert.equal(diff.left.map(p=>p.text).join(''),left);
  assert.equal(diff.right.map(p=>p.text).join(''),right);
  assert.equal(changed(diff.left),'def');assert.equal(changed(diff.right),'fun');
});
test('operator and delimiter differences are marked without marking identical code',()=>{
  const d=compareCode('if (i == 0) {\n  total += i;\n}', 'if i == 0 {\n  total += i;\n}');
  assert.equal(changed(d.left),'()');assert.equal(changed(d.right),'');
  assert.equal(changed(compareCode('same\n  code','same\n  code').left),'');
  const op=compareCode('a && !b','a and not b');
  assert.equal(changed(op.left),'&&!');assert.equal(changed(op.right),'andnot');
});

test('visual rows align inherited declarations across different block delimiters', async () => {
  const { compareAlignedCode } = await import('./codeDiff.js');
  const left = 'somarPares() {\n  int i = 0;\n  int total = 0;\n\n  return total;\n}';
  const right = 'somarPares()\nbegin\n  int i = 0;\n  int total = 0;\n\n  return total;\nend;';
  const rows = compareAlignedCode(left, right);
  const text = parts => parts?.map(p=>p.text).join('');
  for (const source of ['  int i = 0;', '  int total = 0;', '  return total;']) {
    const row = rows.find(row=>text(row.left) === source);
    assert.equal(text(row.right), source);
  }
  for (const [side, original] of [['left',left],['right',right]]) {
    assert.equal(rows.filter(row=>row[side]!==null).map(row=>text(row[side])).join('\n'), original);
  }
});

test('alignment preserves all cumulative source variants and equal row counts', async () => {
  const { compareAlignedCode } = await import('./codeDiff.js');
  const { apiComparisons } = await import('../../server/test-fixtures.js');
  for (const pair of apiComparisons) {
    const rows = compareAlignedCode(pair.snippet_a.code, pair.snippet_b.code);
    for (const [side, source] of [['left',pair.snippet_a.code],['right',pair.snippet_b.code]]) {
      assert.equal(rows.filter(row=>row[side]!==null).map(row=>row[side].map(p=>p.text).join('')).join('\n'),source);
    }
  }
});
