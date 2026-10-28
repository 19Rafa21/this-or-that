import { EXTENDED_CATEGORY_ORDER } from '../src/game/categoryOrder.js';
import { cumulativeOptions, renderCumulativeCode } from '../src/game/cumulativeCode.js';
export const DATASET = { id: 'dataset-2026-09', version: '2026.9',
  description: 'Seven cumulative syntax decisions building one function. Every later alternative preserves all earlier choices; final output is the complete selected code.' };
export const CATEGORY_ORDER = EXTENDED_CATEGORY_ORDER;
const intentions = {
  variables: ['Escolhe como declarar i e total, inicialmente a zero. Estas declarações serão mantidas.', 'Choose how to declare i and total, initially zero. These declarations will be retained.'],
  blocks: ['Escolhe os delimitadores do bloco que contém o teu código. As declarações mantêm-se; a função será completada na última etapa.', 'Choose the block delimiters around your code. Declarations stay the same; the function will be completed in the last stage.'],
  loops: ['Acrescenta um ciclo que soma os valores de 0 a 9, excluindo 10. Mantêm-se as declarações e os blocos escolhidos.', 'Add a loop that sums values from 0 to 9, excluding 10. Your declarations and block delimiters are retained.'],
  conditionals: ['Dentro do ciclo escolhido, soma apenas os valores pares. Compara a escrita da condição; o resto mantém-se.', 'Within your selected loop, add only even values. Compare the conditional syntax; everything else stays the same.'],
  assignments: ['Escolhe como atualizar total dentro da condição. Mantêm-se a declaração, os blocos, o ciclo e o if.', 'Choose how to update total inside the condition. Declarations, blocks, loop and if are retained.'],
  logical: ['Acrescenta à condição: o valor não pode ser 8 ou superior. Compara símbolos com palavras, mantendo as escolhas anteriores.', 'Extend the condition: the value must not be 8 or greater. Compare symbols with words while retaining previous choices.'],
  functions: ['Completa a declaração de somarPares com a palavra que preferes. Todo o código construído e os delimitadores mantêm-se.', 'Complete the declaration of somarPares with your preferred keyword. All the code and block delimiters you built are retained.'],
};
export const snippets = [];
export const comparisons = [];
function expand(categoryIndex, inheritedStyles, path) {
  const category = CATEGORY_ORDER[categoryIndex];
  if (!category) return;
  const alternatives = cumulativeOptions[category].map((style, index) => {
    const context = { ...inheritedStyles, [category]: style };
    const branch = [...path, index];
    const snippet = { id: `${DATASET.id}:${category}:${branch.join('-')}`, datasetId: DATASET.id,
      category, language: `${category}_${branch.join('_')}`, style, sourceLanguage: 'experimental',
      inheritedStyles: { ...inheritedStyles }, label: style, code: renderCumulativeCode(context),
      intentionPt: intentions[category][0], intentionEn: intentions[category][1] };
    snippets.push(snippet);
    expand(categoryIndex + 1, context, branch);
    return snippet;
  });
  for (let i = 0; i < alternatives.length; i++) for (let j = i + 1; j < alternatives.length; j++) {
    comparisons.push({ id: `${DATASET.id}:${category}:${path.join('-') || 'root'}:${i}-${j}`, datasetId: DATASET.id,
      category, snippetAId: alternatives[i].id, snippetBId: alternatives[j].id,
      validationNotes: 'Complete cumulative code. Both alternatives inherit every earlier choice and differ only in the current syntax decision.' });
  }
}
expand(0, {}, []);

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
