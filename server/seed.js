import Database from "better-sqlite3";

const db = new Database("database.sqlite");

const insertSnippet = db.prepare(`
  INSERT OR REPLACE INTO snippets
  (id, category, language, label, code, intention, active)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertSnippet.run(
  "variables-c-001",
  "variables",
  "c",
  "C",
  "int total = 0;",
  "Criar e inicializar uma variável numérica.",
  1
);

insertSnippet.run(
  "variables-python-001",
  "variables",
  "python",
  "Python",
  "total = 0",
  "Criar e inicializar uma variável numérica.",
  1
);

insertSnippet.run(
  "loops-c-001",
  "loops",
  "c",
  "C",
  `for (int i = 0; i < n; i++) {
    printf("%d\\n", numbers[i]);
}`,
  "Percorrer uma lista e imprimir cada elemento.",
  1
);

insertSnippet.run(
  "loops-python-001",
  "loops",
  "python",
  "Python",
  `for number in numbers:
    print(number)`,
  "Percorrer uma lista e imprimir cada elemento.",
  1
);

const insertQuestion = db.prepare(`
  INSERT OR REPLACE INTO profile_questions
  (id, question_pt, question_en, type, options, active)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insertQuestion.run(
  "years-programming",
  "Há quantos anos programas?",
  "How many years have you been programming?",
  "select",
  JSON.stringify(["Menos de 1", "1-2", "3-5", "Mais de 5"]),
  1
);

insertQuestion.run(
  "first-language",
  "Qual foi a primeira linguagem em que programaste?",
  "What was the first programming language you used?",
  "select",
  JSON.stringify(["C", "Python", "Java", "JavaScript", "Outra"]),
  1
);

insertQuestion.run(
  "favorite-language",
  "Qual é a tua linguagem favorita?",
  "What is your favourite programming language?",
  "select",
  JSON.stringify(["C", "Python", "Java", "JavaScript", "Outra"]),
  1
);

console.log("Seed completed.");