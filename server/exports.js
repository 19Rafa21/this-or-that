import { timingSafeEqual } from "node:crypto";

export function rowsToCsv(rows, fallbackHeaders = []) {
  const headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders;
  const escape = (value) => {
    if (value == null) return "";
    let text = value instanceof Date ? value.toISOString()
      : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\r\n");
}

export function authorizeExport(req, res, next) {
  const token = process.env.EXPORT_TOKEN;
  if (!token || token.length < 32) return res.status(503).json({ error: "Exports require an EXPORT_TOKEN of at least 32 characters" });
  const supplied = Buffer.from(req.get("Authorization") || "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: "Export authorization required" });
  }
  res.set("Cache-Control", "no-store");
  next();
}

export const exportQueries = {
  choices: `SELECT c.*, d.version AS dataset_version,
    (cmp.dataset_id <> s.dataset_id OR a.dataset_id <> s.dataset_id OR b.dataset_id <> s.dataset_id) AS legacy_reference_mismatch
    FROM choices c JOIN game_sessions s ON s.id = c.session_id
    JOIN datasets d ON d.id = s.dataset_id JOIN comparisons cmp ON cmp.id = c.comparison_id
    JOIN snippets a ON a.id = c.left_snippet_id JOIN snippets b ON b.id = c.right_snippet_id
    ORDER BY s.created_at, c.round_number`,
  "profile-answers": `SELECT pa.*, d.version AS dataset_version, pq.question_pt, pq.question_en
    FROM profile_answers pa JOIN game_sessions s ON s.id = pa.session_id
    JOIN datasets d ON d.id = s.dataset_id JOIN profile_questions pq ON pq.id = pa.question_id
    ORDER BY s.created_at, pq.display_order`,
  "final-results": `SELECT fr.*, d.version AS dataset_version FROM final_results fr
    JOIN game_sessions s ON s.id = fr.session_id JOIN datasets d ON d.id = s.dataset_id ORDER BY fr.created_at`,
  sessions: `SELECT s.id AS session_id, d.version AS dataset_version, s.created_at, s.finished_at,
    s.interface_language, CASE WHEN s.finished_at IS NULL THEN 'in_progress' ELSE 'complete' END AS status,
    (SELECT count(*) FROM choices c WHERE c.session_id = s.id) AS code_answers,
    (SELECT count(*) FROM choices c WHERE c.session_id = s.id AND c.skipped) AS skipped_comparisons,
    fr.result_json->'selectedStyles' AS selected_styles,
    fr.result_json->'carriedStyles' AS carried_styles,
    fr.result_json->'categoryResults' AS category_results,
    fr.result_json->'winner'->>'code' AS final_code,
    COALESCE(fr.result_json->>'protocolVersion', 'legacy_unvalidated') AS protocol_version,
    (SELECT jsonb_object_agg(pq.id, pa.answer_value) FROM profile_answers pa
      JOIN profile_questions pq ON pq.id = pa.question_id WHERE pa.session_id = s.id) AS profile_answers
    FROM game_sessions s JOIN datasets d ON d.id = s.dataset_id
    LEFT JOIN final_results fr ON fr.session_id = s.id ORDER BY s.created_at`,
};
