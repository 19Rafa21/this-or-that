import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";
import { createSchema, dropProjectTables } from "./schema.js";
import {
  CATEGORY_ORDER,
  comparisons,
  DATASET,
  profileQuestions,
  snippets,
} from "./seed-data.js";

const { Pool } = pg;
const RESET_CONFIRMATION = "RESET_THIS_OR_THAT";
const resetRequested = process.argv.includes("--reset");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

if (
  resetRequested &&
  process.env.CONFIRM_DATABASE_RESET !== RESET_CONFIRMATION
) {
  throw new Error(
    `Reset refused. Set CONFIRM_DATABASE_RESET=${RESET_CONFIRMATION} and run the command again.`
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

function validateSeedData() {
  const snippetIds = new Set(snippets.map((snippet) => snippet.id));
  const comparisonIds = new Set(comparisons.map((comparison) => comparison.id));
  const questionIds = new Set(profileQuestions.map((question) => question.id));

  if (snippetIds.size !== snippets.length) {
    throw new Error("The seed contains duplicate snippet IDs.");
  }

  if (comparisonIds.size !== comparisons.length) {
    throw new Error("The seed contains duplicate comparison IDs.");
  }

  if (questionIds.size !== profileQuestions.length) {
    throw new Error("The seed contains duplicate profile-question IDs.");
  }

  for (const category of CATEGORY_ORDER) {
    if (!snippets.some((snippet) => snippet.category === category)) {
      throw new Error(`Category ${category} does not contain snippets.`);
    }
  }

  const snippetsById = new Map(snippets.map((snippet) => [snippet.id, snippet]));

  for (const comparison of comparisons) {
    const snippetA = snippetsById.get(comparison.snippetAId);
    const snippetB = snippetsById.get(comparison.snippetBId);

    if (!snippetA || !snippetB) {
      throw new Error(`Comparison ${comparison.id} references a missing snippet.`);
    }

    if (
      snippetA.category !== comparison.category ||
      snippetB.category !== comparison.category
    ) {
      throw new Error(`Comparison ${comparison.id} mixes categories.`);
    }

    if (snippetA.style === snippetB.style) {
      throw new Error(`Comparison ${comparison.id} uses the same style twice.`);
    }

    if (
      JSON.stringify(snippetA.inheritedStyles) !==
      JSON.stringify(snippetB.inheritedStyles)
    ) {
      throw new Error(`Comparison ${comparison.id} mixes inherited styles.`);
    }
  }

  for (const question of profileQuestions) {
    const optionValues = question.options.map((item) => item.value);

    if (new Set(optionValues).size !== optionValues.length) {
      throw new Error(`Question ${question.id} has duplicate option values.`);
    }

    if (
      question.options.some(
        (item) => !item.value || !item.pt || !item.en
      )
    ) {
      throw new Error(`Question ${question.id} has an incomplete option.`);
    }
  }
}

async function insertDataset(client) {
  await client.query('LOCK TABLE datasets IN SHARE ROW EXCLUSIVE MODE');
  const managed = (await client.query('SELECT id FROM datasets WHERE active AND activated_at IS NOT NULL')).rows[0];
  if (managed && managed.id !== DATASET.id && !process.argv.includes(`--expected-active=${managed.id}`)) throw new Error('The active dataset is managed in admin. Use admin to prepare updates; seeding would replace the active study.');
  const hash = createHash("sha256").update(JSON.stringify({ DATASET, CATEGORY_ORDER, snippets, comparisons, profileQuestions })).digest("hex");
  const existing = await client.query("SELECT seed_hash FROM datasets WHERE id = $1", [DATASET.id]);
  if (existing.rowCount && existing.rows[0].seed_hash !== hash) {
    throw new Error("This dataset version already exists with different contents. Create a new dataset ID/version; do not overwrite research data.");
  }
  await client.query("UPDATE datasets SET active = false WHERE active = true");
  await client.query(
    `
      INSERT INTO datasets (id, version, description, active, seed_hash, activated_at)
      VALUES ($1, $2, $3, true, $4, now())
      ON CONFLICT (id) DO UPDATE SET
        version = EXCLUDED.version,
        description = EXCLUDED.description,
        active = true,
        activated_at = COALESCE(datasets.activated_at, now())
    `,
    [DATASET.id, DATASET.version, DATASET.description, hash]
  );
}

async function insertSnippets(client) {
  await client.query(`INSERT INTO snippets (id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en,active)
    SELECT id, "datasetId", category, language, style, "sourceLanguage", "inheritedStyles", label, code, "intentionPt", "intentionEn", true
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,"datasetId" text,category text,language text,style text,"sourceLanguage" text,"inheritedStyles" jsonb,label text,code text,"intentionPt" text,"intentionEn" text)
    ON CONFLICT (id) DO NOTHING`, [JSON.stringify(snippets)]);
}

async function insertComparisons(client) {
  await client.query(`INSERT INTO comparisons (id,dataset_id,category,snippet_a_id,snippet_b_id,validation_notes,active)
    SELECT id,"datasetId",category,"snippetAId","snippetBId","validationNotes",true
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,"datasetId" text,category text,"snippetAId" text,"snippetBId" text,"validationNotes" text)
    ON CONFLICT (id) DO NOTHING`, [JSON.stringify(comparisons)]);
}

async function insertProfileQuestions(client) {
  await client.query(
    "UPDATE profile_questions SET active = false WHERE dataset_id = $1",
    [DATASET.id]
  );

  for (const question of profileQuestions) {
    await client.query(
      `
        INSERT INTO profile_questions (
          id, dataset_id, question_pt, question_en, type, options,
          display_order, active
        )
        VALUES ($1, $2, $3, $4, 'single_choice', $5, $6, true)
        ON CONFLICT (id) DO UPDATE SET
          dataset_id = EXCLUDED.dataset_id,
          question_pt = EXCLUDED.question_pt,
          question_en = EXCLUDED.question_en,
          type = EXCLUDED.type,
          options = EXCLUDED.options,
          display_order = EXCLUDED.display_order,
          active = true
      `,
      [
        question.id,
        question.datasetId,
        question.questionPt,
        question.questionEn,
        JSON.stringify(question.options),
        question.displayOrder,
      ]
    );
  }
}

function describeDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  return `${databaseUrl.hostname}${databaseUrl.pathname}`;
}

async function seed() {
  validateSeedData();
  const client = await pool.connect();

  try {
    console.log(`Target database: ${describeDatabase()}`);
    console.log(`Mode: ${resetRequested ? "FULL RESET" : "SAFE UPSERT"}`);

    await client.query("BEGIN");

    if (resetRequested) {
      await dropProjectTables(client);
    }

    await createSchema(client);
    await insertDataset(client);
    await insertSnippets(client);
    await insertComparisons(client);
    await insertProfileQuestions(client);
    await client.query("COMMIT");

    console.log("Seed completed successfully.");
    console.log(`Dataset: ${DATASET.version}`);
    console.log(`Snippets: ${snippets.length}`);
    console.log(`Validated comparisons: ${comparisons.length}`);
    console.log(`Profile questions: ${profileQuestions.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await pool.end().catch(() => {});
  process.exit(1);
});
