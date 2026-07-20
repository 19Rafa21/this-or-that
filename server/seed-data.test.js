import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_ORDER,
  comparisons,
  profileQuestions,
  snippets,
} from "./seed-data.js";

test("cada categoria tem quatro linguagens distintas", () => {
  for (const category of CATEGORY_ORDER) {
    const categorySnippets = snippets.filter(
      (snippet) => snippet.category === category
    );
    assert.equal(categorySnippets.length, 4);
    assert.equal(
      new Set(categorySnippets.map((snippet) => snippet.language)).size,
      4
    );
  }
});

test("cada categoria contém as seis combinações de linguagens", () => {
  for (const category of CATEGORY_ORDER) {
    assert.equal(
      comparisons.filter((comparison) => comparison.category === category)
        .length,
      6
    );
  }
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
    assert.notEqual(snippetA.language, snippetB.language);
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
