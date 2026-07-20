export const DATASET = {
  id: "dataset-2026-01",
  version: "2026.1",
  description:
    "Curated cross-language comparisons covering ten programming constructs in Python, JavaScript, Java and C#.",
};

export const CATEGORY_ORDER = [
  "variables",
  "constants",
  "arrays",
  "conditionals",
  "loops",
  "functions",
  "objects_classes",
  "input",
  "output",
  "errors",
];

const languageLabels = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  csharp: "C#",
};

const intentions = {
  variables: {
    pt: "Declarar uma variável inteira mutável com o valor inicial zero.",
    en: "Declare a mutable integer variable with an initial value of zero.",
  },
  constants: {
    pt: "Declarar um valor constante com o número máximo de tentativas igual a três.",
    en: "Declare a constant maximum number of attempts equal to three.",
  },
  arrays: {
    pt: "Criar uma coleção ordenada com os números inteiros um, dois e três.",
    en: "Create an ordered collection containing the integers one, two and three.",
  },
  conditionals: {
    pt: "Atribuir o estado aprovado quando a pontuação é pelo menos dez e reprovado nos restantes casos.",
    en: "Assign a passing status when the score is at least ten and a failing status otherwise.",
  },
  loops: {
    pt: "Somar todos os números da coleção [1, 2, 3] usando um ciclo.",
    en: "Sum every number in the collection [1, 2, 3] using a loop.",
  },
  functions: {
    pt: "Definir uma função que devolve o quadrado de um número inteiro.",
    en: "Define a function that returns the square of an integer.",
  },
  objects_classes: {
    pt: "Definir uma classe Person que recebe e guarda um nome na construção.",
    en: "Define a Person class that receives and stores a name during construction.",
  },
  input: {
    pt: "Ler o primeiro argumento fornecido pelo utilizador na linha de comandos.",
    en: "Read the first user-supplied command-line argument.",
  },
  output: {
    pt: "Escrever a mensagem Hello, world! na saída padrão.",
    en: "Write the message Hello, world! to standard output.",
  },
  errors: {
    pt: "Definir uma divisão segura que devolve ausência de valor quando o divisor é zero.",
    en: "Define safe division that returns no value when the divisor is zero.",
  },
};

function makeSnippet(category, language, code) {
  return {
    id: `${category}-${language}-001`,
    datasetId: DATASET.id,
    category,
    language,
    label: languageLabels[language],
    code,
    intentionPt: intentions[category].pt,
    intentionEn: intentions[category].en,
  };
}

export const snippets = [
  makeSnippet("variables", "python", "score = 0"),
  makeSnippet("variables", "javascript", "let score = 0;"),
  makeSnippet("variables", "java", "int score = 0;"),
  makeSnippet("variables", "csharp", "int score = 0;"),

  makeSnippet("constants", "python", "MAX_ATTEMPTS = 3"),
  makeSnippet("constants", "javascript", "const MAX_ATTEMPTS = 3;"),
  makeSnippet("constants", "java", "final int MAX_ATTEMPTS = 3;"),
  makeSnippet("constants", "csharp", "const int MaxAttempts = 3;"),

  makeSnippet("arrays", "python", "numbers = [1, 2, 3]"),
  makeSnippet("arrays", "javascript", "const numbers = [1, 2, 3];"),
  makeSnippet("arrays", "java", "int[] numbers = {1, 2, 3};"),
  makeSnippet("arrays", "csharp", "int[] numbers = { 1, 2, 3 };"),

  makeSnippet(
    "conditionals",
    "python",
    'score = 12\nstatus = "passed" if score >= 10 else "failed"'
  ),
  makeSnippet(
    "conditionals",
    "javascript",
    'const score = 12;\nconst status = score >= 10 ? "passed" : "failed";'
  ),
  makeSnippet(
    "conditionals",
    "java",
    'int score = 12;\nString status = score >= 10 ? "passed" : "failed";'
  ),
  makeSnippet(
    "conditionals",
    "csharp",
    'int score = 12;\nstring status = score >= 10 ? "passed" : "failed";'
  ),

  makeSnippet(
    "loops",
    "python",
    "numbers = [1, 2, 3]\ntotal = 0\nfor number in numbers:\n    total += number"
  ),
  makeSnippet(
    "loops",
    "javascript",
    "const numbers = [1, 2, 3];\nlet total = 0;\nfor (const number of numbers) {\n  total += number;\n}"
  ),
  makeSnippet(
    "loops",
    "java",
    "int[] numbers = {1, 2, 3};\nint total = 0;\nfor (int number : numbers) {\n    total += number;\n}"
  ),
  makeSnippet(
    "loops",
    "csharp",
    "int[] numbers = { 1, 2, 3 };\nint total = 0;\nforeach (int number in numbers)\n{\n    total += number;\n}"
  ),

  makeSnippet(
    "functions",
    "python",
    "def square(number: int) -> int:\n    return number * number"
  ),
  makeSnippet(
    "functions",
    "javascript",
    "function square(number) {\n  return number * number;\n}"
  ),
  makeSnippet(
    "functions",
    "java",
    "static int square(int number) {\n    return number * number;\n}"
  ),
  makeSnippet(
    "functions",
    "csharp",
    "static int Square(int number)\n{\n    return number * number;\n}"
  ),

  makeSnippet(
    "objects_classes",
    "python",
    "class Person:\n    def __init__(self, name: str):\n        self.name = name"
  ),
  makeSnippet(
    "objects_classes",
    "javascript",
    "class Person {\n  constructor(name) {\n    this.name = name;\n  }\n}"
  ),
  makeSnippet(
    "objects_classes",
    "java",
    "class Person {\n    String name;\n\n    Person(String name) {\n        this.name = name;\n    }\n}"
  ),
  makeSnippet(
    "objects_classes",
    "csharp",
    "class Person\n{\n    public string Name { get; }\n\n    public Person(string name)\n    {\n        Name = name;\n    }\n}"
  ),

  makeSnippet(
    "input",
    "python",
    "import sys\n\nuser_value = sys.argv[1]"
  ),
  makeSnippet(
    "input",
    "javascript",
    "const userValue = process.argv[2];"
  ),
  makeSnippet(
    "input",
    "java",
    "String userValue = args[0];"
  ),
  makeSnippet(
    "input",
    "csharp",
    "string userValue = args[0];"
  ),

  makeSnippet("output", "python", 'print("Hello, world!")'),
  makeSnippet("output", "javascript", 'console.log("Hello, world!");'),
  makeSnippet("output", "java", 'System.out.println("Hello, world!");'),
  makeSnippet("output", "csharp", 'Console.WriteLine("Hello, world!");'),

  makeSnippet(
    "errors",
    "python",
    "def safe_divide(a, b):\n    if b == 0:\n        return None\n    return a / b"
  ),
  makeSnippet(
    "errors",
    "javascript",
    "function safeDivide(a, b) {\n  if (b === 0) {\n    return null;\n  }\n  return a / b;\n}"
  ),
  makeSnippet(
    "errors",
    "java",
    "static Double safeDivide(double a, double b) {\n    if (b == 0) {\n        return null;\n    }\n    return a / b;\n}"
  ),
  makeSnippet(
    "errors",
    "csharp",
    "static double? SafeDivide(double a, double b)\n{\n    if (b == 0)\n    {\n        return null;\n    }\n    return a / b;\n}"
  ),
];

function buildComparisons() {
  const comparisons = [];

  for (const category of CATEGORY_ORDER) {
    const categorySnippets = snippets.filter(
      (snippet) => snippet.category === category
    );

    for (let a = 0; a < categorySnippets.length; a += 1) {
      for (let b = a + 1; b < categorySnippets.length; b += 1) {
        const snippetA = categorySnippets[a];
        const snippetB = categorySnippets[b];
        comparisons.push({
          id: `${category}-${snippetA.language}-vs-${snippetB.language}`,
          datasetId: DATASET.id,
          category,
          snippetAId: snippetA.id,
          snippetBId: snippetB.id,
          validationNotes:
            "Manually curated pair. Both snippets implement the shared intention recorded for this category; runtime and standard-library conventions may differ by language.",
        });
      }
    }
  }

  return comparisons;
}

export const comparisons = buildComparisons();

const option = (value, pt, en) => ({ value, pt, en });

export const profileQuestions = [
  {
    id: "primary-language",
    datasetId: DATASET.id,
    displayOrder: 1,
    questionPt: "Qual é a tua principal linguagem de programação?",
    questionEn: "What is your primary programming language?",
    options: [
      option("python", "Python", "Python"),
      option("javascript", "JavaScript", "JavaScript"),
      option("java", "Java", "Java"),
      option("csharp", "C#", "C#"),
      option("c", "C", "C"),
      option("cpp", "C++", "C++"),
      option("other", "Outra", "Other"),
      option("prefer_not_answer", "Prefiro não responder", "Prefer not to answer"),
    ],
  },
  {
    id: "programming-experience",
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
    id: "programming-context",
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
    id: "programming-frequency",
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
    id: "self_assessed_level",
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
