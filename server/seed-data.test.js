import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_ORDER,
  comparisons,
  profileQuestions,
  snippets,
} from "./seed-data.js";

test("o protótipo contém declarações e loops cumulativos", () => {
  assert.deepEqual(CATEGORY_ORDER, ["variables", "loops", "conditionals"]);
  assert.equal(snippets.filter((item) => item.category === "variables").length, 4);
  assert.equal(snippets.filter((item) => item.category === "loops").length, 16);
  assert.equal(
    snippets.filter((item) => item.category === "conditionals").length,
    48
  );
});

test("existe uma comparação de loops para cada declaração", () => {
  const loopComparisons = comparisons.filter(
    (comparison) => comparison.category === "loops"
  );

  assert.equal(loopComparisons.length, 24);
  assert.equal(
    comparisons.filter((item) => item.category === "conditionals").length,
    48
  );
  assert.equal(comparisons.length, 78);
});

test("todas as comparações referenciam snippets existentes e compatíveis", () => {
  const snippetsById = new Map(snippets.map((snippet) => [snippet.id, snippet]));

  for (const comparison of comparisons) {
    const snippetA = snippetsById.get(comparison.snippetAId);
    const snippetB = snippetsById.get(comparison.snippetBId);
    assert.ok(snippetA);
    assert.ok(snippetB);
    assert.equal(snippetA.category, comparison.category);
    assert.equal(snippetB.category, comparison.category);
    assert.notEqual(snippetA.style, snippetB.style);
    assert.ok(snippetA.sourceLanguage);
    assert.ok(snippetB.sourceLanguage);
    assert.deepEqual(snippetA.inheritedStyles, snippetB.inheritedStyles);
    assert.equal(snippetA.intentionPt, snippetB.intentionPt);
    assert.equal(snippetA.intentionEn, snippetB.intentionEn);
  }
});

test("perguntas usam valores canónicos e rótulos bilingues", () => {
  assert.equal(profileQuestions.length, 5);

  for (const question of profileQuestions) {
    const values = question.options.map((item) => item.value);
    assert.equal(new Set(values).size, values.length);
    assert.ok(question.questionPt);
    assert.ok(question.questionEn);

    for (const item of question.options) {
      assert.ok(item.value);
      assert.ok(item.pt);
      assert.ok(item.en);
    }
  }
});

test("perfil conciso inclui idade e permite não responder a todas as perguntas", () => {
  assert.deepEqual(profileQuestions.map((question) => question.id.split(":").at(-1)), [
    "primary-language", "programming-experience", "first-language", "programming-frequency", "age-band",
  ]);
  assert.deepEqual(profileQuestions.map((question) => question.displayOrder), [1, 2, 3, 4, 5]);
  for (const question of profileQuestions) {
    assert.ok(question.options.some((item) => item.value === "prefer_not_answer"));
  }
  const age = profileQuestions.find((question) => question.id.endsWith(":age-band"));
  assert.deepEqual(age.options.map((item) => item.value), [
    "under_18", "18_to_24", "25_to_34", "35_to_44", "45_to_54", "55_or_more", "prefer_not_answer",
  ]);
});

test("cada condicional conserva declarações, ciclo e delimitadores já escolhidos", () => {
  for (const snippet of snippets.filter((s) => s.category === 'conditionals')) {
    const loop = snippets.find((s) => s.category === 'loops' && s.style === snippet.inheritedStyles.loops && s.inheritedStyles.variables === snippet.inheritedStyles.variables);
    const lines = snippet.code.split('\n');
    const start = lines.findIndex((line) => /^\s*if /.test(line));
    assert.ok(start >= 0);
    const style = snippet.inheritedStyles.loops;
    let length;
    if (style === 'pascal_style') {
      assert.equal(lines[start + 1].trim(), 'begin');
      assert.equal(lines[start + 2].trim(), 'total := total + i;');
      assert.equal(lines[start + 3].trim(), 'end;');
      assert.ok(!snippet.code.includes('{'));
      length = 4;
    } else if (style === 'python_style') {
      assert.ok(lines[start].endsWith(':'));
      assert.equal(lines[start + 1], '        total += i');
      assert.ok(!snippet.code.includes('{'));
      assert.ok(!snippet.code.includes('begin'));
      length = 2;
    } else {
      assert.ok(lines[start].endsWith(' {'));
      assert.equal(lines[start + 1].trim(), 'total += i;');
      assert.equal(lines[start + 2].trim(), '}');
      assert.ok(!snippet.code.includes('begin'));
      length = 3;
    }
    lines.splice(start, length);
    assert.equal(lines.join('\n'), loop.code, snippet.id);
  }
});

test("pares condicionais diferem apenas no cabeçalho, sem bibliotecas nem duplicados", () => {
  for (const comparison of comparisons.filter((c) => c.category === 'conditionals')) {
    const [a, b] = [comparison.snippetAId, comparison.snippetBId].map((id) => snippets.find((s) => s.id === id));
    assert.notEqual(a.code, b.code);
    const normalize = (code) => code.replace(/^\s*if .+$/m, 'CONDITION HEADER');
    assert.equal(normalize(a.code), normalize(b.code));
    for (const s of [a, b]) {
      assert.ok(!s.code.includes('Math.'));
      const condition = s.code.split('\n').find((line) => /^\s*if /.test(line));
      assert.match(condition, /i (% 2 ==|mod 2 =) 0/);
    }
  }
});

test("todos os exemplos definem os acumuladores e os limites sem variáveis implícitas", () => {
  for (const snippet of snippets) {
    assert.match(snippet.code, /\bi(?:\s*:\s*Integer)?\s*:?= 0/);
    assert.match(snippet.code, /\btotal(?:\s*:\s*Integer)?\s*:?= 0/);
    assert.doesNotMatch(snippet.code, /\bn\b/);
    if (snippet.category !== 'variables') assert.match(snippet.code, /i < 10/);
  }
});
