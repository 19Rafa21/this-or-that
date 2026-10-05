import { createManagementSchema } from "./dataset-management.js";
export async function createSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS datasets_one_active_idx
      ON datasets (active)
      WHERE active = true;

    ALTER TABLE datasets ADD COLUMN IF NOT EXISTS seed_hash TEXT;

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      language TEXT NOT NULL,
      style TEXT NOT NULL,
      source_language TEXT NOT NULL,
      inherited_styles JSONB NOT NULL DEFAULT '{}'::jsonb,
      label TEXT NOT NULL,
      code TEXT NOT NULL,
      intention_pt TEXT NOT NULL,
      intention_en TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (dataset_id, category, language),
      CHECK (length(trim(code)) > 0),
      CHECK (length(trim(language)) > 0),
      CHECK (length(trim(style)) > 0),
      CHECK (length(trim(source_language)) > 0),
      CHECK (jsonb_typeof(inherited_styles) = 'object')
    );

    ALTER TABLE snippets
      ADD COLUMN IF NOT EXISTS style TEXT,
      ADD COLUMN IF NOT EXISTS source_language TEXT,
      ADD COLUMN IF NOT EXISTS inherited_styles JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS snippets_dataset_category_idx
      ON snippets (dataset_id, category)
      WHERE active = true;

    CREATE TABLE IF NOT EXISTS comparisons (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      snippet_a_id TEXT NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
      snippet_b_id TEXT NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
      validation_notes TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (snippet_a_id <> snippet_b_id),
      UNIQUE (dataset_id, snippet_a_id, snippet_b_id)
    );

    CREATE INDEX IF NOT EXISTS comparisons_dataset_category_idx
      ON comparisons (dataset_id, category)
      WHERE active = true;

    CREATE TABLE IF NOT EXISTS profile_questions (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      question_pt TEXT NOT NULL,
      question_en TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'single_choice',
      options JSONB NOT NULL,
      display_order INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (dataset_id, display_order),
      CHECK (jsonb_typeof(options) = 'array'),
      CHECK (jsonb_array_length(options) >= 2)
    );

    CREATE INDEX IF NOT EXISTS profile_questions_dataset_order_idx
      ON profile_questions (dataset_id, display_order)
      WHERE active = true;

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL REFERENCES datasets(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      interface_language TEXT NOT NULL CHECK (interface_language IN ('pt', 'en')),
      CHECK (finished_at IS NULL OR finished_at >= created_at)
    );

    CREATE INDEX IF NOT EXISTS game_sessions_dataset_created_idx
      ON game_sessions (dataset_id, created_at);

    CREATE TABLE IF NOT EXISTS profile_answers (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES profile_questions(id),
      answer_value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS profile_answers_question_idx
      ON profile_answers (question_id, answer_value);

    CREATE TABLE IF NOT EXISTS choices (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      comparison_id TEXT NOT NULL REFERENCES comparisons(id),
      round_number INTEGER NOT NULL CHECK (round_number > 0),
      category TEXT NOT NULL,
      left_snippet_id TEXT NOT NULL REFERENCES snippets(id),
      right_snippet_id TEXT NOT NULL REFERENCES snippets(id),
      selected_snippet_id TEXT REFERENCES snippets(id),
      selected_language TEXT,
      selected_style TEXT,
      skipped BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, round_number),
      UNIQUE (session_id, comparison_id),
      CHECK (left_snippet_id <> right_snippet_id),
      CHECK (
        (skipped = true AND selected_snippet_id IS NULL AND selected_language IS NULL)
        OR
        (skipped = false AND selected_snippet_id IS NOT NULL AND selected_language IS NOT NULL)
      ),
      CHECK (
        selected_snippet_id IS NULL
        OR selected_snippet_id = left_snippet_id
        OR selected_snippet_id = right_snippet_id
      )
    );

    ALTER TABLE choices
      ADD COLUMN IF NOT EXISTS selected_style TEXT;

    CREATE INDEX IF NOT EXISTS choices_comparison_selected_idx
      ON choices (comparison_id, selected_snippet_id);

    CREATE INDEX IF NOT EXISTS choices_category_language_idx
      ON choices (category, selected_language);

    CREATE TABLE IF NOT EXISTS final_results (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (jsonb_typeof(result_json) = 'object')
    );
  `);
  await createManagementSchema(client);
}

export async function dropProjectTables(client) {
  await client.query(`
    DROP TABLE IF EXISTS dataset_draft CASCADE;
    DROP SEQUENCE IF EXISTS dataset_draft_revision;
    DROP TABLE IF EXISTS final_results CASCADE;
    DROP TABLE IF EXISTS choices CASCADE;
    DROP TABLE IF EXISTS profile_answers CASCADE;
    DROP TABLE IF EXISTS game_sessions CASCADE;
    DROP TABLE IF EXISTS profile_questions CASCADE;
    DROP TABLE IF EXISTS comparisons CASCADE;
    DROP TABLE IF EXISTS snippets CASCADE;
    DROP TABLE IF EXISTS datasets CASCADE;
  `);
}
