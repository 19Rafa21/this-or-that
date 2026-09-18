export const DATASET = {
  id: "dataset-2026-05",
  version: "2026.5",
  description:
    "Cumulative prototype comparing C, Python, Java and Pascal declaration, loop and conditional styles.",
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

export const profileQuestions = [
  {
    id: "2026-04-primary-language",
    datasetId: DATASET.id,
    displayOrder: 1,
    questionPt: "Que linguagem de programação usas mais atualmente?",
    questionEn: "Which programming language do you use most currently?",
    options: [
      option("python", "Python", "Python"),
      option("javascript", "JavaScript", "JavaScript"),
      option("java", "Java", "Java"),
      option("csharp", "C#", "C#"),
      option("c", "C", "C"),
      option("cpp", "C++", "C++"),
      option("pascal", "Pascal", "Pascal"),
      option("not_currently", "Não programo atualmente", "I do not currently program"),
      option("other", "Outra", "Other"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "2026-04-programming-experience",
    datasetId: DATASET.id,
    displayOrder: 2,
    questionPt: "Há quantos anos programas?",
    questionEn: "How many years have you been programming?",
    options: [
      option("less_than_1", "Menos de 1 ano", "Less than 1 year"),
      option("1_to_3", "1 a 3 anos", "1 to 3 years"),
      option("4_to_6", "4 a 6 anos", "4 to 6 years"),
      option("7_to_10", "7 a 10 anos", "7 to 10 years"),
      option("more_than_10", "Mais de 10 anos", "More than 10 years"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "2026-04-programming-context",
    datasetId: DATASET.id,
    displayOrder: 3,
    questionPt: "Em que contexto programas atualmente?",
    questionEn: "In which context do you currently program?",
    options: [
      option("education", "Sobretudo académico", "Mostly academic"),
      option("professional", "Sobretudo profissional", "Mostly professional"),
      option("both", "Académico e profissional", "Academic and professional"),
      option("personal", "Projetos pessoais", "Personal projects"),
      option("not_currently", "Não programo atualmente", "I do not currently program"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "2026-04-programming-frequency",
    datasetId: DATASET.id,
    displayOrder: 4,
    questionPt: "Com que frequência programas?",
    questionEn: "How often do you program?",
    options: [
      option("daily", "Diariamente", "Daily"),
      option("several_weekly", "Várias vezes por semana", "Several times a week"),
      option("weekly", "Cerca de uma vez por semana", "About once a week"),
      option("monthly", "Algumas vezes por mês", "A few times a month"),
      option("rarely", "Raramente", "Rarely"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "2026-04-self-assessed-level",
    datasetId: DATASET.id,
    displayOrder: 5,
    questionPt: "Como avalias o teu nível geral de programação?",
    questionEn: "How do you assess your overall programming level?",
    options: [
      option("beginner", "Iniciante", "Beginner"),
      option("intermediate", "Intermédio", "Intermediate"),
      option("advanced", "Avançado", "Advanced"),
      option("expert", "Especialista", "Expert"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
];

profileQuestions.push(
  {
    id: "first-language",
    datasetId: DATASET.id,
    displayOrder: 6,
    questionPt: "Qual foi a primeira linguagem de programação que aprendeste?",
    questionEn: "Which programming language did you learn first?",
    options: profileQuestions[0].options.filter((item) => item.value !== "not_currently"),
  },
  {
    id: "preference-change",
    datasetId: DATASET.id,
    displayOrder: 7,
    questionPt: "Desde que começaste a programar, as tuas preferências de estilo de código mudaram?",
    questionEn: "Have your code-style preferences changed since you started programming?",
    options: [
      option("unchanged", "Não mudaram", "They have not changed"),
      option("slightly", "Mudaram um pouco", "They have changed a little"),
      option("substantially", "Mudaram bastante", "They have changed substantially"),
      option("unsure", "Não sei avaliar", "I am not sure"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  }
);

for (const question of profileQuestions) {
  question.id = `${DATASET.id}:${question.id.replace(/^2026-04-/, "")}`;
}
