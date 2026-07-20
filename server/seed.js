import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const snippets = [
  // 1. VARIABLES
  {
    id: "variables-python-001",
    category: "variables",
    language: "python",
    label: "Python",
    code: "total = 0",
    intention: "Declarar e inicializar uma variável numérica.",
  },
  {
    id: "variables-javascript-001",
    category: "variables",
    language: "javascript",
    label: "JavaScript",
    code: "let total = 0;",
    intention: "Declarar e inicializar uma variável numérica.",
  },
  {
    id: "variables-c-001",
    category: "variables",
    language: "c",
    label: "C",
    code: "int total = 0;",
    intention: "Declarar e inicializar uma variável numérica.",
  },

  // 2. CONSTANTS
  {
    id: "constants-python-001",
    category: "constants",
    language: "python",
    label: "Python",
    code: "MAX_ATTEMPTS = 3",
    intention: "Declarar um valor constante.",
  },
  {
    id: "constants-javascript-001",
    category: "constants",
    language: "javascript",
    label: "JavaScript",
    code: "const MAX_ATTEMPTS = 3;",
    intention: "Declarar um valor constante.",
  },
  {
    id: "constants-java-001",
    category: "constants",
    language: "java",
    label: "Java",
    code: "final int MAX_ATTEMPTS = 3;",
    intention: "Declarar um valor constante.",
  },

  // 3. ARRAYS / LISTS
  {
    id: "arrays-python-001",
    category: "arrays",
    language: "python",
    label: "Python",
    code: "numbers = [1, 2, 3, 4, 5]",
    intention: "Criar uma lista de números.",
  },
  {
    id: "arrays-javascript-001",
    category: "arrays",
    language: "javascript",
    label: "JavaScript",
    code: "const numbers = [1, 2, 3, 4, 5];",
    intention: "Criar uma lista de números.",
  },
  {
    id: "arrays-java-001",
    category: "arrays",
    language: "java",
    label: "Java",
    code: "int[] numbers = {1, 2, 3, 4, 5};",
    intention: "Criar uma lista de números.",
  },

  // 4. CONDITIONALS
  {
    id: "conditionals-python-001",
    category: "conditionals",
    language: "python",
    label: "Python",
    code: "if total > 10:\n    status = \"high\"\nelse:\n    status = \"normal\"",
    intention: "Tomar uma decisão com base numa condição.",
  },
  {
    id: "conditionals-javascript-001",
    category: "conditionals",
    language: "javascript",
    label: "JavaScript",
    code: "if (total > 10) {\n  status = \"high\";\n} else {\n  status = \"normal\";\n}",
    intention: "Tomar uma decisão com base numa condição.",
  },
  {
    id: "conditionals-c-001",
    category: "conditionals",
    language: "c",
    label: "C",
    code: "if (total > 10) {\n    strcpy(status, \"high\");\n} else {\n    strcpy(status, \"normal\");\n}",
    intention: "Tomar uma decisão com base numa condição.",
  },

  // 5. LOOPS
  {
    id: "loops-python-001",
    category: "loops",
    language: "python",
    label: "Python",
    code: "for number in numbers:\n    total += number",
    intention: "Percorrer uma lista e acumular valores.",
  },
  {
    id: "loops-javascript-001",
    category: "loops",
    language: "javascript",
    label: "JavaScript",
    code: "for (const number of numbers) {\n  total += number;\n}",
    intention: "Percorrer uma lista e acumular valores.",
  },
  {
    id: "loops-c-001",
    category: "loops",
    language: "c",
    label: "C",
    code: "for (int i = 0; i < size; i++) {\n    total += numbers[i];\n}",
    intention: "Percorrer uma lista e acumular valores.",
  },

  // 6. FUNCTIONS
  {
    id: "functions-python-001",
    category: "functions",
    language: "python",
    label: "Python",
    code: "def calculate_total(numbers):\n    return sum(numbers)",
    intention: "Definir uma função que calcula um total.",
  },
  {
    id: "functions-javascript-001",
    category: "functions",
    language: "javascript",
    label: "JavaScript",
    code: "function calculateTotal(numbers) {\n  return numbers.reduce((sum, number) => sum + number, 0);\n}",
    intention: "Definir uma função que calcula um total.",
  },
  {
    id: "functions-java-001",
    category: "functions",
    language: "java",
    label: "Java",
    code: "int calculateTotal(int[] numbers) {\n    int total = 0;\n    for (int number : numbers) {\n        total += number;\n    }\n    return total;\n}",
    intention: "Definir uma função que calcula um total.",
  },

  // 7. OBJECTS / CLASSES
  {
    id: "objects-python-001",
    category: "objects_classes",
    language: "python",
    label: "Python",
    code: "class User:\n    def __init__(self, name):\n        self.name = name",
    intention: "Representar uma entidade com uma estrutura própria.",
  },
  {
    id: "objects-javascript-001",
    category: "objects_classes",
    language: "javascript",
    label: "JavaScript",
    code: "const user = {\n  name: \"Alex\",\n  active: true,\n};",
    intention: "Representar uma entidade com uma estrutura própria.",
  },
  {
    id: "objects-java-001",
    category: "objects_classes",
    language: "java",
    label: "Java",
    code: "class User {\n    String name;\n\n    User(String name) {\n        this.name = name;\n    }\n}",
    intention: "Representar uma entidade com uma estrutura própria.",
  },

  // 8. INPUT
  {
    id: "input-python-001",
    category: "input",
    language: "python",
    label: "Python",
    code: "name = input(\"Name: \")",
    intention: "Ler input do utilizador.",
  },
  {
    id: "input-javascript-001",
    category: "input",
    language: "javascript",
    label: "JavaScript",
    code: "const name = prompt(\"Name:\");",
    intention: "Ler input do utilizador.",
  },
  {
    id: "input-java-001",
    category: "input",
    language: "java",
    label: "Java",
    code: "Scanner scanner = new Scanner(System.in);\nString name = scanner.nextLine();",
    intention: "Ler input do utilizador.",
  },

  // 9. OUTPUT
  {
    id: "output-python-001",
    category: "output",
    language: "python",
    label: "Python",
    code: "print(f\"Total: {total}\")",
    intention: "Mostrar informação no ecrã.",
  },
  {
    id: "output-javascript-001",
    category: "output",
    language: "javascript",
    label: "JavaScript",
    code: "console.log(`Total: ${total}`);",
    intention: "Mostrar informação no ecrã.",
  },
  {
    id: "output-c-001",
    category: "output",
    language: "c",
    label: "C",
    code: "printf(\"Total: %d\\n\", total);",
    intention: "Mostrar informação no ecrã.",
  },

  // 10. ERRORS
  {
    id: "errors-python-001",
    category: "errors",
    language: "python",
    label: "Python",
    code: "try:\n    result = total / count\nexcept ZeroDivisionError:\n    result = 0",
    intention: "Lidar com erros durante a execução.",
  },
  {
    id: "errors-javascript-001",
    category: "errors",
    language: "javascript",
    label: "JavaScript",
    code: "try {\n  result = total / count;\n} catch (error) {\n  result = 0;\n}",
    intention: "Lidar com erros durante a execução.",
  },
  {
    id: "errors-java-001",
    category: "errors",
    language: "java",
    label: "Java",
    code: "try {\n    result = total / count;\n} catch (ArithmeticException error) {\n    result = 0;\n}",
    intention: "Lidar com erros durante a execução.",
  },
];

const profileQuestions = [
  {
    id: "years-programming",
    question_pt: "Há quantos anos programas?",
    question_en: "How many years have you been programming?",
    type: "select",
    options: ["Menos de 1", "1-2", "3-5", "Mais de 5"],
  },
  {
    id: "first-language",
    question_pt: "Qual foi a primeira linguagem em que programaste?",
    question_en: "What was your first programming language?",
    type: "select",
    options: ["C", "Python", "Java", "JavaScript", "Outra"],
  },
  {
    id: "favorite-language",
    question_pt: "Qual é a tua linguagem favorita?",
    question_en: "What is your favourite programming language?",
    type: "select",
    options: ["C", "Python", "Java", "JavaScript", "Outra"],
  },
  {
    id: "experience-level",
    question_pt: "Como classificas o teu nível de programação?",
    question_en: "How would you describe your programming level?",
    type: "select",
    options: ["Iniciante", "Intermédio", "Avançado", "Profissional"],
  },
  {
    id: "teaching-experience",
    question_pt: "Já deste aulas ou explicações de programação?",
    question_en: "Have you ever taught programming?",
    type: "select",
    options: ["Sim", "Não"],
  },
  {
    id: "preferred-style",
    question_pt: "Que estilo de código preferes?",
    question_en: "What coding style do you prefer?",
    type: "select",
    options: ["Curto e direto", "Explícito e detalhado", "Moderno", "Tradicional"],
  },
];

async function seed() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      language TEXT NOT NULL,
      label TEXT NOT NULL,
      code TEXT NOT NULL,
      intention TEXT,
      active BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS profile_questions (
      id TEXT PRIMARY KEY,
      question_pt TEXT NOT NULL,
      question_en TEXT,
      type TEXT NOT NULL,
      options JSONB,
      active BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS profile_answers (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS choices (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      round_number INTEGER,
      category TEXT,
      left_snippet_id TEXT,
      right_snippet_id TEXT,
      selected_snippet_id TEXT,
      selected_language TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS final_results (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query("UPDATE snippets SET active = false");
  await pool.query("UPDATE profile_questions SET active = false");

  for (const snippet of snippets) {
    await pool.query(
      `
      INSERT INTO snippets (
        id,
        category,
        language,
        label,
        code,
        intention,
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (id)
      DO UPDATE SET
        category = EXCLUDED.category,
        language = EXCLUDED.language,
        label = EXCLUDED.label,
        code = EXCLUDED.code,
        intention = EXCLUDED.intention,
        active = true
      `,
      [
        snippet.id,
        snippet.category,
        snippet.language,
        snippet.label,
        snippet.code,
        snippet.intention,
      ]
    );
  }

  for (const question of profileQuestions) {
    await pool.query(
      `
      INSERT INTO profile_questions (
        id,
        question_pt,
        question_en,
        type,
        options,
        active
      )
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id)
      DO UPDATE SET
        question_pt = EXCLUDED.question_pt,
        question_en = EXCLUDED.question_en,
        type = EXCLUDED.type,
        options = EXCLUDED.options,
        active = true
      `,
      [
        question.id,
        question.question_pt,
        question.question_en,
        question.type,
        JSON.stringify(question.options),
      ]
    );
  }

  console.log("Seed completed.");
  console.log(`${snippets.length} snippets inserted/updated.`);
  console.log(`${profileQuestions.length} profile questions inserted/updated.`);

  await pool.end();
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
