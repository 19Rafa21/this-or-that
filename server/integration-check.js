import "dotenv/config";
import pg from "pg";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createApp } from "./app.js";
import { createSchema } from "./schema.js";
import { DATASET, comparisons, profileQuestions } from "./seed-data.js";
import { apiSnippets, simulateGame } from "./test-fixtures.js";
import { createAdminAuth, hashAdminPassword } from "./admin-auth.js";

// Use a separate, randomly named schema. Never seed or delete public tables.
const schema = `this_or_that_test_${randomBytes(8).toString("hex")}`;
const config = { connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };
const admin = new pg.Pool(config);
const pool = new pg.Pool({ ...config, options: `-c search_path=${schema}` });
let server;
let created = false;
const previousToken = process.env.EXPORT_TOKEN;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await createSchema(pool);
  await pool.query("INSERT INTO datasets(id, version, description, active) VALUES($1,$2,$3,true)", [DATASET.id, DATASET.version, DATASET.description]);
  await pool.query(`INSERT INTO snippets (id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en)
    SELECT id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,dataset_id text,category text,language text,style text,source_language text,inherited_styles jsonb,label text,code text,intention_pt text,intention_en text)`, [JSON.stringify(apiSnippets)]);
  await pool.query(`INSERT INTO comparisons(id,dataset_id,category,snippet_a_id,snippet_b_id,validation_notes)
    SELECT id,"datasetId",category,"snippetAId","snippetBId","validationNotes"
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,"datasetId" text,category text,"snippetAId" text,"snippetBId" text,"validationNotes" text)`, [JSON.stringify(comparisons)]);
  await pool.query(`INSERT INTO profile_questions(id,dataset_id,question_pt,question_en,options,display_order)
    SELECT id,"datasetId","questionPt","questionEn",options,"displayOrder"
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,"datasetId" text,"questionPt" text,"questionEn" text,options jsonb,"displayOrder" int)`, [JSON.stringify(profileQuestions)]);

  process.env.EXPORT_TOKEN = randomBytes(32).toString("hex");
  const adminPassword = randomBytes(24).toString("hex");
  const adminHash = await hashAdminPassword(adminPassword);
  const adminAuth = createAdminAuth({ configuration: () => ({ username: "test-admin", hash: adminHash }) });
  server = createApp(pool, { adminAuth }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, status = 201) => {
    const response = await fetch(`${base}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(path === "sessions" ? { ...body, clientStudyVersion: 4 } : body) });
    const result = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
    return result;
  };
  const oldClient = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'pt' }) });
  assert.equal(oldClient.status, 426);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM game_sessions')).rows[0].n, 0);
  for (const skip of [false, true]) {
    const session = await post("sessions", { language: skip ? "en" : "pt" });
    assert.equal(session.comparisons.length, 6);
    assert.equal(session.profileQuestions.length, 5);
    await post("final-results", { sessionId: session.sessionId, result: { fake: true } }, 400);
    const { choices } = simulateGame(() => skip ? "skip" : "right");
    const payload = (choice) => ({ sessionId: session.sessionId, comparisonId: choice.comparison_id,
      roundNumber: choice.round_number, category: choice.category, leftSnippetId: choice.left_snippet_id,
      rightSnippetId: choice.right_snippet_id, selectedSnippetId: choice.skipped ? "skipped" : choice.selected_snippet_id });
    await Promise.all([post("choices", payload(choices[0])), post("choices", payload(choices[0]))]);
    await post("choices", { ...payload(choices[0]), selectedSnippetId: "invented" }, 409);
    await post("choices", { ...payload(choices[1]), roundNumber: 8 }, 400);
    let delivered = session.comparisons;
    for (const choice of choices.slice(1)) {
      assert.ok(delivered.some(pair => pair.id === choice.comparison_id), 'client has its next comparison');
      const next = await post("choices", payload(choice));
      assert.ok(next.comparisons.length <= 6);
      const retry = await post("choices", payload(choice));
      assert.deepEqual(retry, next);
      delivered = next.comparisons;
    }
    await post("final-results", { sessionId: session.sessionId }, 400);
    await post("profile-answers", { sessionId: session.sessionId, questionId: profileQuestions[0].id, answer: "invented" }, 400);
    for (const question of profileQuestions) {
      if (question.id.endsWith(":age-band")) {
        await post("profile-answers", { sessionId: session.sessionId, questionId: question.id, answer: "18" }, 400);
      }
      const body = { sessionId: session.sessionId, questionId: question.id,
        answer: skip ? "skipped" : question.id.endsWith(":age-band") ? "prefer_not_answer" : question.options[0].value };
      await post("profile-answers", body);
      await post("profile-answers", body);
    }
    const final = await post("final-results", { sessionId: session.sessionId, result: { winner: { code: "forged" } } });
    assert.notEqual(final.result.winner.code, "forged");
    assert.equal(final.result.winner.examples, undefined);
    assert.equal(final.result.hasSkippedComparisons, skip);
    if (skip) assert.ok(Object.values(final.result.selectedStyles).every((value) => value === null));
    const retry = await post("final-results", { sessionId: session.sessionId });
    assert.deepEqual(retry, final);
    console.log(`HTTP game (${skip ? "all skipped" : "all selected"}): 14 choices, 5 profile answers, validated result, safe retries`);
  }
  const denied = await fetch(`${base}/api/export/sessions.csv`);
  assert.equal(denied.status, 401);
  for (const name of ["sessions", "choices", "profile-answers", "final-results"]) {
    const response = await fetch(`${base}/api/export/${name}.csv`, { headers: { Authorization: `Bearer ${process.env.EXPORT_TOKEN}` } });
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.ok(!csv.includes("[object Object]"));
    assert.ok(csv.includes(DATASET.version));
  }
  const counts = (await pool.query("SELECT (SELECT count(*) FROM choices) AS choices, (SELECT count(*) FROM final_results) AS results")).rows[0];
  assert.equal(Number(counts.choices), 28);
  assert.equal(Number(counts.results), 2);
  // Test analytics only against this isolated schema; never create real study responses.
  await pool.query("UPDATE game_sessions SET created_at = '2026-09-25T12:00:00Z', finished_at = '2026-09-25T12:10:00Z'");
  await pool.query(`INSERT INTO game_sessions(id, dataset_id, interface_language, created_at)
    VALUES ('unfinished-test', $1, 'pt', '2026-09-26T00:00:00Z')`, [DATASET.id]);
  assert.equal((await fetch(`${base}/api/admin/results`)).status, 401);
  await post("admin/login", { username: "test-admin", password: "incorrect" }, 401);
  const login = await post("admin/login", { username: "test-admin", password: adminPassword }, 200);
  const getResults = async (query = "", status = 200) => {
    const response = await fetch(`${base}/api/admin/results${query}`, { headers: { Authorization: `Bearer ${login.token}` } });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return response.json();
  };
  const results = await getResults();
  assert.deepEqual(results.summary, { started: 3, completed: 2, unfinished: 1 });
  assert.equal(results.profile.length, 5);
  const ageResults = results.profile.find((question) => question.id.endsWith(":age-band"));
  assert.deepEqual(ageResults.counts, { prefer_not_answer: 1, skipped: 1 });
  for (const question of results.profile) {
    assert.equal(question.counts.skipped, 1);
    assert.equal(Object.values(question.counts).reduce((sum, count) => sum + count, 0), 2);
  }
  assert.equal(results.preferences.reduce((sum, row) => sum + row.shown, 0), 56);
  assert.equal(results.preferences.reduce((sum, row) => sum + row.decided, 0), 28);
  assert.equal(results.preferences.reduce((sum, row) => sum + row.wins, 0), 14);
  assert.equal(results.skips.reduce((sum, row) => sum + row.skipped, 0), 14);
  assert.equal(results.finals.filter((row) => row.style === null).length, 7);
  assert.equal(results.finals.reduce((sum, row) => sum + row.total, 0), 14);
  assert.equal((await getResults("?status=complete")).summary.started, 2);
  assert.equal((await getResults("?from=2026-09-25&to=2026-09-25")).summary.started, 2);
  assert.deepEqual((await getResults("?from=2026-09-26&to=2026-09-26")).summary, { started: 1, completed: 0, unfinished: 1 });
  const empty = await getResults("?from=2026-09-27");
  assert.equal(empty.summary.started, 0);
  assert.equal(empty.preferences.length, 0);
  await getResults("?from=2026-02-30", 400);
  // Exercise conjunction on the same session, using the requested age + Pascal example.
  const ageId = profileQuestions.find((q) => q.id.endsWith(":age-band")).id;
  const firstId = profileQuestions.find((q) => q.id.endsWith(":first-language")).id;
  await pool.query("UPDATE profile_answers SET answer_value = '55_or_more' WHERE question_id = $1 AND answer_value <> 'skipped'", [ageId]);
  await pool.query("UPDATE profile_answers SET answer_value = 'pascal' WHERE question_id = $1 AND answer_value <> 'skipped'", [firstId]);
  const filtered = (profile, extra = {}, status = 200) => getResults(`?${new URLSearchParams({ ...extra, profile: JSON.stringify(profile) })}`, status);
  const both = await filtered({[ageId]: "55_or_more", [firstId]: "pascal"});
  assert.equal(both.population, 3);
  assert.deepEqual(both.summary, {started: 1, completed: 1, unfinished: 0});
  assert.deepEqual(both.profile.find((q) => q.id === firstId).counts, {pascal: 1});
  assert.equal(both.preferences.reduce((sum, row) => sum + row.wins, 0), 14);
  assert.equal(both.preferences.reduce((sum, row) => sum + row.shown, 0), 28);
  assert.equal(both.skips.reduce((sum, row) => sum + row.total, 0), 14);
  assert.equal(both.finals.reduce((sum, row) => sum + row.total, 0), 7);
  assert.equal((await filtered({[ageId]: "55_or_more", [firstId]: "skipped"})).summary.started, 0);
  const missingProfile = await filtered({[ageId]: "__missing__", [firstId]: "__missing__"});
  assert.deepEqual(missingProfile.summary, {started: 1, completed: 0, unfinished: 1});
  assert.equal(missingProfile.finals.length, 0);
  assert.equal((await filtered({[ageId]: "skipped"})).summary.completed, 1);
  assert.equal((await filtered({[ageId]: "prefer_not_answer"})).summary.started, 0);
  const completeOnly = await filtered({[firstId]: "pascal"}, {status: "complete"});
  assert.equal(completeOnly.population, 2);
  assert.equal(completeOnly.summary.started, 1);
  const wrongDate = await filtered({[firstId]: "pascal"}, {from: "2026-09-26"});
  assert.equal(wrongDate.population, 1);
  assert.equal(wrongDate.summary.started, 0);
  const allFive = Object.fromEntries(profileQuestions.map((q) => [q.id,
    q.id === ageId ? "55_or_more" : q.id === firstId ? "pascal" : q.options[0].value]));
  assert.equal((await filtered(allFive)).summary.started, 1);
  assert.equal((await filtered({})).summary.started, 3);
  await filtered({[ageId]: "invented"}, {}, 400);
  await filtered({"other-dataset:age-band": "55_or_more"}, {}, 400);
  // Historical content and responses remain scoped to their own dataset.
  await pool.query(`INSERT INTO datasets(id, version, description, created_at) VALUES
    ('history', 'history', 'Isolated historical fixture', '2020-01-01'),
    ('empty', 'empty', 'Isolated empty fixture', '2030-01-01')`);
  await pool.query(`INSERT INTO snippets(id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en)
    SELECT 'history:' || id,'history',category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en
    FROM snippets WHERE dataset_id=$1`, [DATASET.id]);
  await pool.query(`INSERT INTO comparisons(id,dataset_id,category,snippet_a_id,snippet_b_id,validation_notes)
    SELECT 'history:' || id,'history',category,'history:' || snippet_a_id,'history:' || snippet_b_id,validation_notes
    FROM comparisons WHERE dataset_id=$1`, [DATASET.id]);
  await pool.query(`INSERT INTO profile_questions(id,dataset_id,question_pt,question_en,options,display_order)
    SELECT 'history:' || id,'history',question_pt,question_en,options,display_order
    FROM profile_questions WHERE id=$1`, [profileQuestions[0].id]);
  await pool.query(`INSERT INTO game_sessions(id,dataset_id,interface_language,created_at,finished_at)
    VALUES ('history-session','history','pt','2020-01-01T12:00:00Z','2020-01-01T12:10:00Z')`);
  await pool.query(`INSERT INTO choices(session_id,comparison_id,round_number,category,left_snippet_id,right_snippet_id,selected_snippet_id,selected_language,selected_style,skipped)
    SELECT 'history-session','history:' || comparison_id,round_number,category,'history:' || left_snippet_id,'history:' || right_snippet_id,
      'history:' || selected_snippet_id,selected_language,selected_style,skipped
    FROM choices WHERE session_id=(SELECT session_id FROM choices WHERE NOT skipped LIMIT 1)`);
  await pool.query(`INSERT INTO profile_answers(session_id,question_id,answer_value)
    VALUES ('history-session',$1,'python')`, [`history:${profileQuestions[0].id}`]);
  await pool.query(`INSERT INTO final_results(session_id,result_json)
    SELECT 'history-session',result_json FROM final_results WHERE session_id=(SELECT session_id FROM choices WHERE NOT skipped AND session_id <> 'history-session' LIMIT 1)`);
  const historical = await getResults("?datasetId=history");
  assert.equal(historical.datasetVersion, "history");
  assert.equal(historical.filters.datasetId, "history");
  assert.deepEqual(historical.summary, { started: 1, completed: 1, unfinished: 0 });
  assert.equal(historical.profile.length, 1);
  assert.deepEqual(historical.profile[0].counts, { python: 1 });
  assert.equal(historical.preferences.reduce((sum, row) => sum + row.wins, 0), 14);
  assert.equal(historical.skips.reduce((sum, row) => sum + row.total, 0), 14);
  assert.equal(historical.finals.reduce((sum, row) => sum + row.total, 0), 7);
  assert.equal((await getResults("?datasetId=history&from=2026-01-01")).summary.started, 0);
  assert.equal((await getResults("?datasetId=empty")).summary.started, 0);
  const defaultResults = await getResults();
  assert.equal(defaultResults.datasetId, DATASET.id);
  assert.equal(defaultResults.summary.started, 3);
  assert.equal(defaultResults.datasets.length, 3);
  assert.equal(defaultResults.datasets.find((dataset) => dataset.id === "history").sessions, 1);
  assert.equal(historical.datasets.find((d) => d.id === "history").questions.length, 1);
  assert.equal((await filtered({[ageId]: "55_or_more"}, {datasetId: "history"}, 400)).error !== undefined, true);
  assert.equal((await filtered({[historical.profile[0].id]: "python"}, {datasetId: "history"})).summary.started, 1);
  await getResults("?datasetId=missing", 404);
  await getResults("?datasetId=history&datasetId=empty", 400);
  const publicResponse = await fetch(`${base}/api/public/results`);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("cache-control"), "no-store");
  const publicResults = await publicResponse.json();
  assert.deepEqual(Object.keys(publicResults).sort(), ["categoryOrder", "finals", "generatedAt", "preferences", "profile", "skips", "styleLabels", "summary"]);
  assert.deepEqual(publicResults.summary, defaultResults.summary);
  assert.deepEqual(publicResults.preferences, defaultResults.preferences);
  assert.deepEqual(publicResults.finals, defaultResults.finals);
  assert.equal(publicResults.profile.length, 5);
  assert.ok(publicResults.profile.every((q) => Object.keys(q).sort().join(",") === "counts,options,question_en,question_pt"));
  assert.equal(publicResults.profile.find((q) => q.question_pt.includes("faixa etária")).counts["55_or_more"], 1);
  for (const query of ["datasetId=history", "status=complete", "from=2026-01-01", "profile=%7B%7D", "sessionId=history-session"]) {
    assert.equal((await fetch(`${base}/api/public/results?${query}`)).status, 400);
  }
  assert.equal((await fetch(`${base}/api/admin/results`)).status, 401);
  assert.equal((await fetch(`${base}/api/export/sessions.csv`)).status, 401);
  // A new active study with no responses must never publish historical data as fallback.
  await pool.query("UPDATE datasets SET active = false WHERE active");
  await pool.query("UPDATE datasets SET active = true WHERE id = 'empty'");
  const emptyPublic = await (await fetch(`${base}/api/public/results`)).json();
  assert.deepEqual(emptyPublic.summary, {started: 0, completed: 0, unfinished: 0});
  assert.deepEqual(emptyPublic.profile, []);
  assert.deepEqual(emptyPublic.finals, []);
  await pool.query("UPDATE datasets SET active = false WHERE active");
  await pool.query("UPDATE datasets SET active = true WHERE id = $1", [DATASET.id]);
  console.log("Public results: aggregate-only response, active dataset, empty study, no filters and private routes protected.");
  const management = async (action, body, expected = 200, authenticated = true) => {
    const response = await fetch(`${base}/api/admin/datasets${action ? `/${action}` : ''}`, {
      method: action ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${login.token}` } : {}) },
      ...(action ? { body: JSON.stringify(body || {}) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
  await management('', null, 401, false);
  await management('create', null, 401, false);
  const ongoing = await post('sessions', { language: 'pt' });
  await management('create');
  await management('create', {}, 409);
  let draft = (await management('')).draft;
  assert.equal(draft.content.questions.length, 5);
  const originalQuestion = draft.content.questions[0].question_pt;
  draft.content.stages[0].title_pt = 'Título configurado';
  draft.content.stages[0].question_en = 'Custom comparison question';
  draft.content.version = 'integration-published';
  draft.content.questions[0].question_pt = 'Pergunta revista para teste';
  draft.content.snippets[0].code = 'example revised for test';
  const invalid = structuredClone(draft.content);
  invalid.questions[0].options[0].value = 'skipped';
  await management('save', { revision: draft.revision, content: invalid }, 400);
  await management('save', { revision: draft.revision, content: draft.content });
  await management('activate', { revision: draft.revision }, 409);
  draft = (await management('')).draft;
  await management('activate', { revision: draft.revision });
  await management('activate', { revision: draft.revision }, 409);
  const managed = await management('');
  assert.equal(managed.draft, null);
  assert.equal(managed.active.version, 'integration-published');
  assert.ok(managed.active.activated_at);
  assert.equal(managed.active.sessions, 0);
  const outdated = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'pt', clientStudyVersion: 3 }) });
  assert.equal(outdated.status, 426);
  const updatedSession = await post('sessions', { language: 'pt' });
  assert.equal(updatedSession.datasetId, managed.active.id);
  assert.equal(updatedSession.profileQuestions[0].question_pt, 'Pergunta revista para teste');
  assert.equal(updatedSession.comparisons.length, 6);
  assert.equal(updatedSession.comparisons[0].presentation.title_pt, 'Título configurado');
  assert.equal(updatedSession.comparisons[0].presentation.question_en, 'Custom comparison question');
  assert.equal((await pool.query('SELECT question_pt FROM profile_questions WHERE id=$1', [ongoing.profileQuestions[0].id])).rows[0].question_pt, originalQuestion);
  await post('profile-answers', { sessionId: ongoing.sessionId, questionId: ongoing.profileQuestions[0].id, answer: 'skipped' });
  await post('profile-answers', { sessionId: updatedSession.sessionId, questionId: ongoing.profileQuestions[0].id, answer: 'skipped' }, 400);
  const firstChoice = simulateGame(() => 'right').choices[0];
  await post('choices', { sessionId: ongoing.sessionId, comparisonId: firstChoice.comparison_id,
    roundNumber: firstChoice.round_number, category: firstChoice.category, leftSnippetId: firstChoice.left_snippet_id,
    rightSnippetId: firstChoice.right_snippet_id, selectedSnippetId: firstChoice.selected_snippet_id });
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM datasets WHERE active')).rows[0].count, 1);
  assert.equal((await (await fetch(`${base}/api/health`)).json()).datasetVersion, 'integration-published');
  await management('create');
  let reordered = (await management('')).draft;
  reordered.content.version = 'integration-reordered';
  reordered.content.stages = [reordered.content.stages.at(-1), reordered.content.stages[0]];
  reordered.content.stages[0].title_pt = 'Funções primeiro';
  const customOption = {id:'custom_method',pt:'Método',en:'Method',baseStyle:'function_function',from:'function ',to:'method '};
  reordered.content.stages[0].customOptions = [customOption];
  reordered.content.stages[0].styles.push(customOption.id);
  reordered.content.questions = [];
  await management('save', { revision: reordered.revision, content: reordered.content }, 400);
  await management('regenerate', { revision: reordered.revision, content: reordered.content });
  reordered = (await management('')).draft;
  assert.equal(reordered.content.generated, true);
  await management('activate', { revision: reordered.revision });
  const reorderedSession = await post('sessions', { language: 'pt' });
  assert.deepEqual(reorderedSession.categoryOrder, ['functions', 'variables']);
  assert.equal(reorderedSession.profileQuestions.length, 0);
  let pairs = reorderedSession.comparisons, contender = null, seen = new Set(), round = 0;
  while (pairs.length) {
    const pair = pairs.find(p => (!contender || p.snippet_a.id === contender || p.snippet_b.id === contender) &&
      (!seen.has(p.snippet_a.id) || !seen.has(p.snippet_b.id)));
    assert.ok(pair);
    const response = await post('choices', { sessionId: reorderedSession.sessionId, comparisonId: pair.id,
      roundNumber: ++round, category: pair.category, leftSnippetId: pair.snippet_a.id,
      rightSnippetId: pair.snippet_b.id, selectedSnippetId: pair.snippet_a.id });
    contender = pair.snippet_a.id; seen.add(pair.snippet_a.id); seen.add(pair.snippet_b.id);
    if (response.comparisons[0]?.category !== pair.category) { contender = null; seen = new Set(); }
    pairs = response.comparisons;
  }
  const reorderedFinal = await post('final-results', { sessionId: reorderedSession.sessionId });
  assert.equal(reorderedFinal.result.categoryResults.length, 2);
  assert.equal(round, 6);
  assert.equal(reorderedFinal.result.winner.styleLabels.custom_method.pt, 'Método');
  const reorderedPublic = await (await fetch(`${base}/api/public/results`)).json();
  assert.deepEqual(reorderedPublic.categoryOrder, ['functions', 'variables']);
  assert.deepEqual(reorderedPublic.styleLabels.custom_method, {pt:'Método',en:'Method'});
  assert.ok(reorderedSession.comparisons.some(pair => [pair.snippet_a,pair.snippet_b].some(s => s.style === 'custom_method' && s.code.includes('method somarPares'))));
  await management('create');
  const customDraft = (await management('')).draft;
  assert.deepEqual(customDraft.content.stages[0].customOptions, [customOption]);
  customDraft.content.version = 'integration-custom-copy';
  await management('save', {revision:customDraft.revision,content:customDraft.content});
  console.log('Dataset management: protected access, draft validation, stale revisions, activation, immutable history and ongoing sessions verified.');
  const logout = await fetch(`${base}/api/admin/logout`, { method: "POST", headers: { Authorization: `Bearer ${login.token}` } });
  assert.equal(logout.status, 200);
  await getResults("", 401);
  console.log("Private results: authentication, counts, skips, date boundaries, empty data and logout verified.");
  console.log("All HTTP/PostgreSQL integration checks passed; public data was not touched.");
} catch (error) {
  console.error("Integration check failed:", error.code === "ERR_ASSERTION" ? error.stack : error.code || error.message);
  process.exitCode = 1;
} finally {
  if (previousToken === undefined) delete process.env.EXPORT_TOKEN;
  else process.env.EXPORT_TOKEN = previousToken;
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  if (created) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    console.log(`Removed temporary test schema ${schema}.`);
  }
  await admin.end();
}
