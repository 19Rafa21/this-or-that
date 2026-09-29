export const DATASET = {
  id: "dataset-2026-06",
  version: "2026.6",
  description:
    "Cumulative syntax study with a focused five-question profile including age bands.",
};

export const CATEGORY_ORDER = ["variables", "loops", "conditionals"];

const intentions = {
  variables: {
    pt: "Declarar uma variável inteira mutável com o valor inicial zero.",
    en: "Declare a mutable integer variable with an initial value of zero.",
  },
  loops: {
    pt: "Percorrer os valores de zero até n usando um ciclo.",
    en: "Iterate over the values from zero to n using a loop.",
  },
  conditionals: {
    pt: "Somar a total os valores pares encontrados durante o ciclo.",
    en: "Add the even values found during the loop to total.",
  },
};

function makeSnippet({
  id,
  category,
  variant,
  style,
  sourceLanguage,
  label,
  code,
  inheritedStyles = {},
}) {
  return {
    id: `${DATASET.id}:${id}`,
    datasetId: DATASET.id,
    category,
    language: variant,
    style,
    sourceLanguage,
    inheritedStyles,
    label,
    code,
    intentionPt: intentions[category].pt,
    intentionEn: intentions[category].en,
  };
}

const styles = [
  {
    id: "c",
    style: "c_style",
    label: "C",
    declaration: "int i = 0;",
    renderLoop(body = "") {
      const content = body ? `${indent(body, 2)}\n` : "";
      return `while (i < n) {\n${content}  i++;\n}`;
    },
    conditional: "if (i % 2 == 0) {\n  total += i;\n}",
  },
  {
    id: "python",
    style: "python_style",
    label: "Python",
    declaration: "i = 0",
    renderLoop(body = "") {
      const content = body ? `${indent(body, 4)}\n` : "";
      return `while i < n:\n${content}    i += 1`;
    },
    conditional: "if i % 2 == 0:\n    total += i",
  },
  {
    id: "java",
    style: "java_style",
    label: "Java",
    declaration: "var i = 0;",
    renderLoop(body = "") {
      const content = body ? `\n${indent(body, 2)}\n` : "\n";
      return `for (; i < n; i++) {${content}}`;
    },
    conditional:
      "if (Math.floorMod(i, 2) == 0) {\n  total += i;\n}",
  },
  {
    id: "pascal",
    style: "pascal_style",
    label: "Pascal",
    declaration: "i: Integer := 0;",
    renderLoop(body = "") {
      const content = body ? `${indent(body, 2)}\n` : "";
      return `while i < n do\nbegin\n${content}  i := i + 1;\nend;`;
    },
    conditional:
      "if i mod 2 = 0 then\nbegin\n  total := total + i;\nend;",
  },
];

function indent(code, spaces) {
  const padding = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}

const declarationSnippets = styles.map((item) =>
  makeSnippet({
    id: `variables-${item.id}-style`,
    category: "variables",
    variant: `${item.id}_declaration`,
    style: item.style,
    sourceLanguage: item.id,
    label: item.label,
    code: item.declaration,
  })
);

const loopSnippets = styles.flatMap((declarationStyle) =>
  styles.map((loopStyle) =>
    makeSnippet({
      id: `loops-${declarationStyle.id}-declaration-${loopStyle.id}-style`,
      category: "loops",
      variant: `${declarationStyle.id}_declaration__${loopStyle.id}_loop`,
      style: loopStyle.style,
      sourceLanguage: loopStyle.id,
      inheritedStyles: { variables: declarationStyle.style },
      label: loopStyle.label,
      code: `${declarationStyle.declaration}\n\n${loopStyle.renderLoop()}`,
    })
  )
);

const conditionalSnippets = styles.flatMap((declarationStyle) =>
  styles.flatMap((loopStyle) =>
    styles.map((conditionalStyle) =>
      makeSnippet({
        id: `conditionals-${declarationStyle.id}-declaration-${loopStyle.id}-loop-${conditionalStyle.id}-style`,
        category: "conditionals",
        variant: `${declarationStyle.id}_declaration__${loopStyle.id}_loop__${conditionalStyle.id}_conditional`,
        style: conditionalStyle.style,
        sourceLanguage: conditionalStyle.id,
        inheritedStyles: {
          variables: declarationStyle.style,
          loops: loopStyle.style,
        },
        label: conditionalStyle.label,
        code: `${declarationStyle.declaration}\n\n${loopStyle.renderLoop(
          conditionalStyle.conditional
        )}`,
      })
    )
  )
);

export const snippets = [
  ...declarationSnippets,
  ...loopSnippets,
  ...conditionalSnippets,
];

function comparison(id, category, snippetAId, snippetBId) {
  return {
    id: `${DATASET.id}:${id}`,
    datasetId: DATASET.id,
    category,
    snippetAId,
    snippetBId,
    validationNotes: "Manually curated experimental syntax comparison.",
  };
}

function buildPairComparisons(items, category, context) {
  const result = [];

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      result.push(
        comparison(
          `${category}-${context}-${items[left].sourceLanguage}-vs-${items[right].sourceLanguage}`,
          category,
          items[left].id,
          items[right].id
        )
      );
    }
  }

  return result;
}

export const comparisons = [
  ...buildPairComparisons(declarationSnippets, "variables", "declaration"),
  ...styles.flatMap((declarationStyle) =>
    buildPairComparisons(
      loopSnippets.filter(
        (snippet) =>
          snippet.inheritedStyles.variables === declarationStyle.style
      ),
      "loops",
      `${declarationStyle.id}-declaration`
    )
  ),
  ...styles.flatMap((declarationStyle) =>
    styles.flatMap((loopStyle) =>
      buildPairComparisons(
        conditionalSnippets.filter(
          (snippet) =>
            snippet.inheritedStyles.variables === declarationStyle.style &&
            snippet.inheritedStyles.loops === loopStyle.style
        ),
        "conditionals",
        `${declarationStyle.id}-declaration-${loopStyle.id}-loop`
      )
    )
  ),
];

const option = (value, pt, en) => ({ value, pt, en });

// Ordered as two short profile breaks, then age after the final comparisons.
const languageOptions = [
  option("python", "Python", "Python"),
  option("javascript", "JavaScript", "JavaScript"),
  option("java", "Java", "Java"),
  option("csharp", "C#", "C#"),
  option("c", "C", "C"),
  option("cpp", "C++", "C++"),
  option("pascal", "Pascal", "Pascal"),
  option("other", "Outra", "Other"),
  option("never_programmed", "Ainda não aprendi a programar", "I have not learned to program yet"),
  option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
];

export const profileQuestions = [
  {
    id: "primary-language",
    displayOrder: 1,
    questionPt: "Que linguagem de programação usas mais atualmente?",
    questionEn: "Which programming language do you use most currently?",
    options: [...languageOptions.filter((item) => !["never_programmed", "prefer_not_answer"].includes(item.value)),
      option("not_currently", "Não programo atualmente", "I do not currently program"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer")],
  },
  {
    id: "programming-experience",
    displayOrder: 2,
    questionPt: "Há quantos anos programas?",
    questionEn: "How many years have you been programming?",
    options: [
      option("never_programmed", "Ainda não comecei a programar", "I have not started programming yet"),
      option("less_than_1", "Menos de 1 ano", "Less than 1 year"),
      option("1_to_less_than_4", "1 a menos de 4 anos", "1 to less than 4 years"),
      option("4_to_less_than_7", "4 a menos de 7 anos", "4 to less than 7 years"),
      option("7_to_less_than_11", "7 a menos de 11 anos", "7 to less than 11 years"),
      option("11_or_more", "11 anos ou mais", "11 years or more"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "first-language",
    displayOrder: 3,
    questionPt: "Qual foi a primeira linguagem de programação que aprendeste?",
    questionEn: "Which programming language did you learn first?",
    options: languageOptions,
  },
  {
    id: "programming-frequency",
    displayOrder: 4,
    questionPt: "Com que frequência programas atualmente?",
    questionEn: "How often do you currently program?",
    options: [
      option("daily", "Diariamente", "Daily"),
      option("several_weekly", "Várias vezes por semana", "Several times a week"),
      option("weekly", "Cerca de uma vez por semana", "About once a week"),
      option("monthly", "Algumas vezes por mês", "A few times a month"),
      option("rarely", "Menos de uma vez por mês", "Less than once a month"),
      option("not_currently", "Não programo atualmente", "I do not currently program"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "age-band",
    displayOrder: 5,
    questionPt: "Qual é a tua faixa etária?",
    questionEn: "What is your age group?",
    options: [
      option("under_18", "Menos de 18 anos", "Under 18"),
      option("18_to_24", "18–24 anos", "18–24"),
      option("25_to_34", "25–34 anos", "25–34"),
      option("35_to_44", "35–44 anos", "35–44"),
      option("45_to_54", "45–54 anos", "45–54"),
      option("55_or_more", "55 anos ou mais", "55 or older"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
].map((question) => ({ ...question, id: `${DATASET.id}:${question.id}`, datasetId: DATASET.id }));
