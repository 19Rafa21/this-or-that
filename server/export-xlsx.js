import ExcelJS from "exceljs";
import { exportQueries } from "./exports.js";

// A single snapshot keeps the four sheets consistent while new answers arrive.
export async function loadExportSnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data = {};
    for (const [name, query] of Object.entries(exportQueries)) {
      data[name] = (await client.query(query)).rows;
    }
    data.questions = (await client.query(`SELECT id, question_pt FROM profile_questions
      ORDER BY dataset_id, display_order, id`)).rows;
    const options = (await client.query(`SELECT c.id, a.language AS left_language,
      a.code AS left_code, b.language AS right_language, b.code AS right_code
      FROM choices c LEFT JOIN snippets a ON a.id = c.left_snippet_id
      LEFT JOIN snippets b ON b.id = c.right_snippet_id`)).rows;
    const byId = new Map(options.map((row) => [String(row.id), row]));
    data.choices = data.choices.map((row) => ({ ...row, ...byId.get(String(row.id)) }));
    await client.query("COMMIT");
    return data;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function cellValue(value) {
  if (value == null) return null;
  if (value instanceof Date || typeof value === "number" || typeof value === "boolean") return value;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Excel cannot preserve more than 32767 characters in one cell.
  if (text.length > 32767) throw new Error("Export cell exceeds Excel's text limit; use CSV instead");
  return text; // Strings beginning with '=' remain text, never formula objects.
}

function addSheet(book, name, columns, rows) {
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(([key, header, width = 24]) => ({ key, header, width }));
  for (const row of rows) sheet.addRow(columns.map(([key]) => cellValue(row[key])));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
  sheet.getRow(1).height = 54;
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B2068" } };
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.height = 32;
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 11 };
      cell.alignment = { vertical: "top" };
      if (cell.value instanceof Date) cell.numFmt = "yyyy-mm-dd hh:mm:ss";
    });
  });
  return sheet;
}

export function buildExportWorkbook(data) {
  const book = new ExcelJS.Workbook();
  book.creator = "This or That";
  book.created = new Date();
  const identity = [["session_id", "ID da sessão", 36], ["dataset_version", "Versão", 14]];
  addSheet(book, "Participações", [...identity,
    ["created_at", "Início (UTC)"], ["finished_at", "Fim (UTC)"],
    ["status", "Estado"], ["interface_language", "Idioma", 12],
    ["code_answers", "Comparações registadas"], ["skipped_comparisons", "Comparações saltadas"],
    ["protocol_version", "Protocolo"]], data.sessions.map((row) => ({ ...row,
      code_answers: Number(row.code_answers), skipped_comparisons: Number(row.skipped_comparisons) })));

  const questions = new Map(data.questions.map((row) => [row.id, row.question_pt]));
  for (const row of data["profile-answers"]) if (!questions.has(row.question_id)) questions.set(row.question_id, row.question_pt);
  const profileBySession = new Map();
  for (const row of data["profile-answers"]) {
    if (!profileBySession.has(row.session_id)) profileBySession.set(row.session_id, {});
    profileBySession.get(row.session_id)[`question:${row.question_id}`] = row.answer_value;
  }
  addSheet(book, "Perfil", [...identity, ...Array.from(questions, ([id, label]) =>
    [`question:${id}`, `${label} [${id}]`, 38])], data.sessions.map((row) => ({
      session_id: row.session_id, dataset_version: row.dataset_version, ...profileBySession.get(row.session_id) })));

  addSheet(book, "Escolhas", [...identity,
    ["round_number", "Ronda", 10], ["category", "Categoria"], ["comparison_id", "ID da comparação", 36],
    ["left_snippet_id", "ID esquerdo", 36], ["left_language", "Linguagem esquerda"], ["left_code", "Código esquerdo", 55],
    ["right_snippet_id", "ID direito", 36], ["right_language", "Linguagem direita"], ["right_code", "Código direito", 55],
    ["selected_snippet_id", "ID escolhido", 36], ["selected_language", "Linguagem escolhida"],
    ["selected_style", "Estilo escolhido"], ["skipped", "Saltada", 12],
    ["created_at", "Resposta (UTC)"], ["legacy_reference_mismatch", "Referência histórica inconsistente", 30]], data.choices);

  const categories = [...new Set(data["final-results"].flatMap((row) => Object.keys(row.result_json?.selectedStyles || {})))].sort();
  addSheet(book, "Resultados", [...identity, ["created_at", "Resultado (UTC)"],
    ["protocol_version", "Protocolo"], ...categories.map((key) => [`style:${key}`, `Preferência: ${key}`, 26]),
    ["selected_styles", "Preferências (JSON)", 45], ["carried_styles", "Estilos usados na composição (JSON)", 45],
    ["category_results", "Resultados por categoria (JSON)", 55],
    ["final_code", "Composição final", 80], ["result_json", "Resultado completo (JSON)", 80]],
  data["final-results"].map((row) => {
    const result = row.result_json || {};
    return { ...row, protocol_version: result.protocolVersion ?? "legacy_unvalidated",
      selected_styles: result.selectedStyles, carried_styles: result.carriedStyles,
      category_results: result.categoryResults, final_code: result.winner?.code,
      ...Object.fromEntries(categories.map((key) => [`style:${key}`, result.selectedStyles?.[key]])) };
  }));
  return book;
}

export async function exportXlsx(pool) {
  return buildExportWorkbook(await loadExportSnapshot(pool)).xlsx.writeBuffer();
}
