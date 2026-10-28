import { getCategoryOrder } from "../src/game/categoryOrder.js";
import { InputError } from "./tournament.js";

export function parseResultFilters(query = {}) {
  const date = (value) => {
    if (value === undefined || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith("0000-") || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      throw new InputError("Invalid date filter");
    }
    return value;
  };
  const from = date(query.from);
  const to = date(query.to);
  if (from && to && from > to) throw new InputError("Invalid date range");
  if (query.status && !["all", "complete"].includes(query.status)) throw new InputError("Invalid status filter");
  const datasetId = query.datasetId || null;
  if (datasetId !== null && (typeof datasetId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,99}$/.test(datasetId))) {
    throw new InputError("Invalid dataset filter");
  }
  let profile = {};
  if (query.profile !== undefined && query.profile !== "") {
    if (typeof query.profile !== "string" || query.profile.length > 8000) throw new InputError("Invalid profile filters");
    try { profile = JSON.parse(query.profile); } catch { throw new InputError("Invalid profile filters"); }
    if (!profile || Array.isArray(profile) || typeof profile !== "object" || Object.keys(profile).length > 20 ||
        Object.entries(profile).some(([id, value]) => !id || id.length > 200 || typeof value !== "string" || !value || value.length > 100)) {
      throw new InputError("Invalid profile filters");
    }
  }
  return { from, to, status: query.status || "all", datasetId, profile };
}

const scope = `WITH base AS (
  SELECT id, finished_at FROM game_sessions WHERE dataset_id = $1
  AND ($2::date IS NULL OR created_at >= ($2::date::timestamp AT TIME ZONE 'UTC'))
  AND ($3::date IS NULL OR created_at < (($3::date + 1)::timestamp AT TIME ZONE 'UTC'))
  AND (NOT $4::boolean OR finished_at IS NOT NULL)
) , eligible AS (
  SELECT b.* FROM base b WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_each_text($5::jsonb) filter
    WHERE CASE WHEN filter.value = '__missing__' THEN
      EXISTS (SELECT 1 FROM profile_answers pa WHERE pa.session_id = b.id AND pa.question_id = filter.key)
    ELSE NOT EXISTS (SELECT 1 FROM profile_answers pa
      WHERE pa.session_id = b.id AND pa.question_id = filter.key AND pa.answer_value = filter.value)
    END
  )
) `;

export async function loadStudyResults(pool, filters, { activeOnly = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const datasets = (await client.query(`SELECT d.id, d.version, d.active,
      COALESCE((SELECT jsonb_object_agg(option->>'id', jsonb_build_object('pt', option->>'pt', 'en', option->>'en'))
        FROM (SELECT DISTINCT presentation FROM comparisons WHERE dataset_id=d.id AND active) definitions
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(definitions.presentation->'customOptions', '[]'::jsonb)) option), '{}'::jsonb) AS style_labels,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('category', stages.category, 'display_order', stages.display_order) ORDER BY stages.display_order, stages.category)
        FROM (SELECT category, min(display_order) AS display_order FROM comparisons WHERE dataset_id=d.id AND active GROUP BY category) stages), '[]'::jsonb) AS stages,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'question_pt', q.question_pt,
        'question_en', q.question_en, 'options', q.options) ORDER BY q.display_order)
        FROM profile_questions q WHERE q.dataset_id = d.id), '[]'::jsonb) AS questions,
      count(s.id)::int AS sessions,
      count(s.id) FILTER (WHERE s.finished_at IS NOT NULL)::int AS completed,
      COALESCE(bool_or(EXISTS (SELECT 1 FROM choices c WHERE c.session_id = s.id)
        OR EXISTS (SELECT 1 FROM profile_answers a WHERE a.session_id = s.id)), false) AS has_responses
      FROM datasets d LEFT JOIN game_sessions s ON s.dataset_id = d.id
      GROUP BY d.id ORDER BY d.created_at DESC, d.id DESC`)).rows;
    const selected = activeOnly ? datasets.find((dataset) => dataset.active) : filters.datasetId
      ? datasets.find((dataset) => dataset.id === filters.datasetId)
      : datasets.find((dataset) => dataset.has_responses) || datasets.find((dataset) => dataset.active) || datasets[0];
    if (!selected) throw new InputError("Unknown dataset", 404);
    for (const [id, value] of Object.entries(filters.profile)) {
      const question = selected.questions.find((item) => item.id === id);
      if (!question || !["skipped", "__missing__", ...question.options.map((option) => option.value)].includes(value)) {
        throw new InputError("Unknown profile question or option for this dataset");
      }
    }
    const params = [selected.id, filters.from, filters.to, filters.status === "complete", JSON.stringify(filters.profile)];
    const { population, ...summary } = (await client.query(scope + `SELECT (SELECT count(*)::int FROM base) AS population, count(*)::int AS started,
      count(*) FILTER (WHERE finished_at IS NOT NULL)::int AS completed,
      count(*) FILTER (WHERE finished_at IS NULL)::int AS unfinished FROM eligible`, params)).rows[0];
    const profile = (await client.query(scope + `SELECT q.id, q.question_pt, q.question_en, q.options,
      COALESCE((SELECT jsonb_object_agg(answer_value, total) FROM (
        SELECT pa.answer_value, count(*)::int AS total FROM profile_answers pa
        JOIN eligible e ON e.id = pa.session_id WHERE pa.question_id = q.id GROUP BY pa.answer_value
      ) counts), '{}'::jsonb) AS counts
      FROM profile_questions q WHERE q.dataset_id = $1 ORDER BY q.display_order`, params)).rows;
    const preferences = (await client.query(scope + `SELECT c.category, s.style,
      count(*)::int AS shown, count(*) FILTER (WHERE NOT c.skipped)::int AS decided,
      count(*) FILTER (WHERE c.selected_snippet_id = s.id AND NOT c.skipped)::int AS wins,
      count(*) FILTER (WHERE c.skipped)::int AS skipped
      FROM choices c JOIN eligible e ON e.id = c.session_id
      JOIN comparisons cmp ON cmp.id = c.comparison_id AND cmp.dataset_id = $1
      JOIN snippets s ON s.id IN (c.left_snippet_id, c.right_snippet_id) AND s.dataset_id = $1
      GROUP BY c.category, s.style ORDER BY c.category, s.style`, params)).rows;
    const skips = (await client.query(scope + `SELECT c.category, count(*)::int AS total,
      count(*) FILTER (WHERE c.skipped)::int AS skipped
      FROM choices c JOIN eligible e ON e.id = c.session_id
      GROUP BY c.category ORDER BY c.category`, params)).rows;
    const finals = (await client.query(scope + `SELECT category.key AS category,
      category.value #>> '{}' AS style, count(*)::int AS total
      FROM final_results f JOIN eligible e ON e.id = f.session_id
      CROSS JOIN LATERAL jsonb_each(f.result_json->'selectedStyles') category
      WHERE f.result_json->>'protocolVersion' = '4' AND e.finished_at IS NOT NULL
      GROUP BY category.key, category.value ORDER BY category.key, category.value`, params)).rows;
    await client.query("COMMIT");
    return { styleLabels: selected.style_labels || {}, datasetId: selected.id, datasetVersion: selected.version, datasets,
      categoryOrder: selected.stages ? getCategoryOrder(selected.stages) : getCategoryOrder([...preferences, ...finals, ...skips]),
      generatedAt: new Date().toISOString(), filters: { ...filters, datasetId: selected.id },
      population, summary, profile, preferences, skips, finals };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

// Resumo público: âmbito fixo, campos agregados explícitos, sem catálogo de conjuntos de dados nem filtros.
export async function loadPublicResults(pool) {
  const data = await loadStudyResults(pool, parseResultFilters(), { activeOnly: true });
  return {
    generatedAt: data.generatedAt,
    categoryOrder: data.categoryOrder,
    styleLabels: data.styleLabels,
    summary: { started: data.summary.started, completed: data.summary.completed, unfinished: data.summary.unfinished },
    profile: data.profile.map((question) => ({
      question_pt: question.question_pt, question_en: question.question_en,
      options: question.options.map(({ value, pt, en }) => ({ value, pt, en })),
      counts: Object.fromEntries([...question.options.map((option) => option.value), "skipped"]
        .map((value) => [value, question.counts[value] || 0])),
    })),
    preferences: data.preferences.map(({ category, style, shown, decided, wins, skipped }) =>
      ({ category, style, shown, decided, wins, skipped })),
    skips: data.skips.map(({ category, total, skipped }) => ({ category, total, skipped })),
    finals: data.finals.map(({ category, style, total }) => ({ category, style, total })),
  };
}
