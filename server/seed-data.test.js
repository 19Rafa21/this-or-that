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
    64
  );
});

test("existe uma comparação de loops para cada declaração", () => {
  const loopComparisons = comparisons.filter(
    (comparison) => comparison.category === "loops"
  );

  assert.equal(loopComparisons.length, 24);
  assert.equal(
    comparisons.filter((item) => item.category === "conditionals").length,
    96
  );
  assert.equal(comparisons.length, 126);
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
  assert.equal(profileQuestions.length, 7);

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
