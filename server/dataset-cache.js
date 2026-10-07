// Only shared question content is cached. Participant answers always come from PostgreSQL.
export function createDatasetLoader({ ttlMs = 30000, now = Date.now } = {}) {
  const cache = new Map();
  return async function loadDataset(database, datasetId) {
    const existing = cache.get(datasetId);
    if (existing && (existing.pending || existing.expires > now())) return existing.promise;
    const entry = { pending: true, expires: 0 };
    entry.promise = Promise.all([
      database.query(`SELECT c.id, c.category, c.dataset_id, c.display_order, c.presentation, c.progressive,
        to_jsonb(a) AS snippet_a, to_jsonb(b) AS snippet_b FROM comparisons c
        JOIN snippets a ON a.id = c.snippet_a_id JOIN snippets b ON b.id = c.snippet_b_id
        WHERE c.dataset_id = $1 AND c.active AND a.active AND b.active
        AND a.dataset_id = c.dataset_id AND b.dataset_id = c.dataset_id ORDER BY c.id`, [datasetId]),
      database.query(`SELECT id, question_pt, question_en, type, options, display_order
        FROM profile_questions WHERE dataset_id = $1 AND active ORDER BY display_order`, [datasetId]),
    ]).then(([comparisons, questions]) => {
      entry.pending = false;
      entry.expires = now() + ttlMs;
      return { comparisons: comparisons.rows, profileQuestions: questions.rows };
    }).catch((error) => {
      cache.delete(datasetId);
      throw error;
    });
    cache.set(datasetId, entry);
    return entry.promise;
  };
}
