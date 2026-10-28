export const DATASET = {
  id: 'dataset-2026-08', version: '2026.8',
  description: 'Seven syntax dimensions: declarations, blocks, loops, conditions, assignment, logic and functions. Block choices carry forward; other features are compared separately.',
};
export { EXTENDED_CATEGORY_ORDER as CATEGORY_ORDER } from '../../src/game/categoryOrder.js';
const indent = (body) => body.split('\n').map((line) => `  ${line}`).join('\n');
const blocks = [
  { style: 'block_braces', label: '{ … }', render: (header, body) => `${header} {\n${indent(body)}\n}` },
  { style: 'block_indent', label: 'Indentação / Indentation', render: (header, body) => `${header}:\n${indent(body)}` },
  { style: 'block_begin_end', label: 'begin … end', render: (header, body) => `${header}\nbegin\n${indent(body)}\nend;` },
];
const intentions = {
  variables: ['Inicializar as variáveis inteiras i e total a zero. Compara a forma de declarar as variáveis.', 'Initialize the integer variables i and total to zero. Compare the variable declaration syntax.'],
  blocks: ['Quando ativo é verdadeiro, atribuir 1 a total. Compara apenas a delimitação do bloco; esta escolha será mantida nas etapas seguintes.', 'When ativo is true, assign 1 to total. Compare only the block delimiters; this choice carries forward.'],
  loops: ['Somar a total os inteiros de 0 a 9, sem incluir 10. Compara a forma de percorrer esses valores; o bloco mantém-se.', 'Add the integers 0 to 9 to total, excluding 10. Compare the iteration form; the block style stays the same.'],
  conditionals: ['Se i for par, somar i a total. Compara apenas o cabeçalho da condição; o bloco mantém-se.', 'If i is even, add i to total. Compare only the conditional header; the block style stays the same.'],
  assignments: ['Adicionar valor a total, que começa a zero. Todas as alternativas deixam total com o valor 2.', 'Add valor to total, which starts at zero. Every alternative leaves total equal to 2.'],
  logical: ['Permitir apenas quando ativo é verdadeiro e bloqueado é falso. Compara os operadores lógicos em símbolos ou palavras.', 'Allow only when ativo is true and bloqueado is false. Compare symbolic and word-based logical operators.'],
  functions: ['Definir somar, que recebe a e b e devolve a soma. Compara apenas a palavra que inicia a função; os argumentos e o bloco mantêm-se.', 'Define somar, which receives a and b and returns their sum. Compare only the function keyword; arguments and block style stay the same.'],
};
const make = (category, style, label, code, inheritedStyles = {}) => ({
  id: `${DATASET.id}:${category}-${Object.values(inheritedStyles).join('-') || 'base'}-${style}`,
  datasetId: DATASET.id, category, language: `${Object.values(inheritedStyles).join('_')}_${style}`,
  style, sourceLanguage: 'experimental', inheritedStyles, label, code,
  intentionPt: intentions[category][0], intentionEn: intentions[category][1],
});
const declarations = [
  ['c_style', 'int', 'int i = 0;\nint total = 0;'],
  ['python_style', 'Sem palavra-chave / No keyword', 'i = 0\ntotal = 0'],
  ['java_style', 'var', 'var i = 0;\nvar total = 0;'],
  ['pascal_style', ': Integer', 'i: Integer := 0;\ntotal: Integer := 0;'],
].map(([style, label, code]) => make('variables', style, label, code));
const blockSnippets = blocks.map((b) => make('blocks', b.style, b.label,
  `ativo = true;\ntotal = 0;\n\n${b.render('if (ativo)', 'total = 1;')}`));
const loops = blocks.flatMap((b) => [
  ['loop_while', 'while', b.render('while (i < 10)', 'total = total + i;\ni = i + 1;')],
  ['loop_for_counter', 'for (…; …; …)', b.render('for (; i < 10; i = i + 1)', 'total = total + i;')],
  ['loop_for_range', 'for … in …', b.render('for i in 0..<10', 'total = total + i;')],
].map(([style, label, code]) => make('loops', style, label, `i = 0;\ntotal = 0;\n\n${code}`, { blocks: b.style })));
const conditions = blocks.flatMap((b) => [
  ['condition_parenthesized', 'if (…)', 'if (i % 2 == 0)'],
  ['condition_plain', 'if …', 'if i % 2 == 0'],
  ['condition_then', 'if … then', 'if i % 2 == 0 then'],
].map(([style, label, header]) => make('conditionals', style, label,
  `i = 4;\ntotal = 0;\n\n${b.render(header, 'total = total + i;')}`, { blocks: b.style })));
const assignments = [
  ['assignment_explicit', '= … + …', 'total = total + valor;'],
  ['assignment_compound', '+=', 'total += valor;'],
  ['assignment_colon', ':=', 'total := total + valor;'],
].map(([style, label, code]) => make('assignments', style, label, `total = 0;\nvalor = 2;\n\n${code}`));
const logical = [
  ['logic_symbols', '&& / !', 'ativo && !bloqueado'],
  ['logic_words', 'and / not', 'ativo and not bloqueado'],
].map(([style, label, expression]) => make('logical', style, label, `ativo = true;\nbloqueado = false;\n\npermitido = ${expression};`));
const functions = blocks.flatMap((b) => ['function', 'def', 'fun'].map((keyword) =>
  make('functions', `function_${keyword}`, keyword, b.render(`${keyword} somar(a, b)`, 'return a + b;'), { blocks: b.style })));
export const snippets = [...declarations, ...blockSnippets, ...loops, ...conditions, ...assignments, ...logical, ...functions];
export const comparisons = [];
for (let i = 0; i < snippets.length; i++) {
  for (const b of snippets.slice(i + 1)) {
    const a = snippets[i];
    if (a.category !== b.category || JSON.stringify(a.inheritedStyles) !== JSON.stringify(b.inheritedStyles)) continue;
    comparisons.push({ id: `${DATASET.id}:pair-${i}-${b.language}`, datasetId: DATASET.id, category: a.category,
      snippetAId: a.id, snippetBId: b.id, validationNotes: 'Experimental syntax. Compare only the stated feature. Block-dependent alternatives inherit the selected delimiter; other categories use independent short examples.' });
  }
}

const option = (value, pt, en) => ({ value, pt, en });

// Cinco pausas curtas para perguntas de perfil ao longo do estudo, terminando com a idade após a etapa das funções.
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
    questionPt: "Há quantos anos programas? Considera os anos completos de experiência.",
    questionEn: "How many years have you been programming? Count completed years of experience.",
    options: [
      option("never_programmed", "Ainda não comecei a programar", "I have not started programming yet"),
      option("less_than_1", "Menos de 1 ano", "Less than 1 year"),
      option("1_to_less_than_4", "1–3 anos", "1–3 years"),
      option("4_to_less_than_7", "4–6 anos", "4–6 years"),
      option("7_to_less_than_11", "7–10 anos", "7–10 years"),
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
