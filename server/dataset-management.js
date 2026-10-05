import { randomUUID } from 'node:crypto';
import { InputError } from './tournament.js';

export async function createManagementSchema(db) {
  await db.query(`ALTER TABLE datasets ADD COLUMN IF NOT EXISTS activated_at timestamptz;
    CREATE SEQUENCE IF NOT EXISTS dataset_draft_revision;
    CREATE TABLE IF NOT EXISTS dataset_draft (
      id integer PRIMARY KEY CHECK(id = 1), source_id text NOT NULL REFERENCES datasets(id),
      content jsonb NOT NULL, revision integer NOT NULL DEFAULT nextval('dataset_draft_revision'),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
}

async function sourceContent(db, id) {
  const questions = (await db.query('SELECT * FROM profile_questions WHERE dataset_id=$1 AND active ORDER BY display_order', [id])).rows;
  const snippets = (await db.query('SELECT * FROM snippets WHERE dataset_id=$1 AND active ORDER BY category,id', [id])).rows;
  return { questions, snippets };
}

// The editor changes wording and examples, never the tournament graph or identity of an option.
export function validateDraft(content, source) {
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!content || !text(content.version, 80) || !text(content.description, 2000)) throw new InputError('Indica um nome e uma descrição para o dataset.');
  for (const [key, fields] of [['questions', ['question_pt', 'question_en']], ['snippets', ['label', 'code', 'intention_pt', 'intention_en']]]) {
    if (!Array.isArray(content[key]) || content[key].length !== source[key].length) throw new InputError('O rascunho deve manter todas as perguntas e exemplos.');
    const ids = new Set();
    for (const row of content[key]) {
      if (!row || typeof row !== 'object') throw new InputError('Conteúdo inválido.');
      const original = source[key].find((item) => item.id === row.id);
      if (!original || ids.has(row.id)) throw new InputError('Identificador inválido ou repetido.');
      ids.add(row.id);
      if (fields.some((field) => !text(row[field], field === 'code' ? 20000 : 2000))) throw new InputError('Preenche os textos em português e inglês e o código de todos os exemplos.');
      if (key === 'questions' && (!Array.isArray(row.options) || row.options.length !== original.options.length || row.options.some((option, i) => !option || option.value !== original.options[i].value || !text(option.pt, 500) || !text(option.en, 500)))) throw new InputError('Preenche as opções nas duas línguas, mantendo a sua ordem e identificação.');
    }
  }
}

export function registerDatasetManagement(app, pool, authorize, route) {
  app.get('/api/admin/datasets', authorize, route(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const active = (await pool.query(`SELECT d.id,d.version,d.description,d.activated_at,
      (SELECT count(*)::int FROM profile_questions WHERE dataset_id=d.id AND active) AS questions,
      (SELECT count(*)::int FROM comparisons WHERE dataset_id=d.id AND active) AS comparisons,
      (SELECT count(*)::int FROM game_sessions WHERE dataset_id=d.id) AS sessions
      FROM datasets d WHERE active`)).rows[0] || null;
    const draft = (await pool.query('SELECT * FROM dataset_draft WHERE id=1')).rows[0] || null;
    res.json({ active, draft });
  }));
  for (const action of ['create', 'save', 'activate']) {
    app.post(`/api/admin/datasets/${action}`, authorize, route(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        // Serialize creation, editing and activation, including the empty-draft case.
        await db.query('LOCK TABLE datasets IN SHARE ROW EXCLUSIVE MODE');
        const active = (await db.query('SELECT * FROM datasets WHERE active')).rows[0];
        const draft = (await db.query('SELECT * FROM dataset_draft WHERE id=1 FOR UPDATE')).rows[0];
        if (action === 'create') {
          if (draft) throw new InputError('Já existe um rascunho. Abre-o para continuar.', 409);
          if (!active) throw new InputError('Não existe um dataset ativo.', 409);
          const content = { version: `${active.version}-novo`, description: active.description, ...await sourceContent(db, active.id) };
          await db.query('INSERT INTO dataset_draft(id,source_id,content) VALUES(1,$1,$2)', [active.id, JSON.stringify(content)]);
        } else {
          if (!draft || draft.revision !== req.body?.revision) throw new InputError('O rascunho mudou. Atualiza a página antes de continuar.', 409);
          const source = await sourceContent(db, draft.source_id);
          const content = action === 'save' ? req.body.content : draft.content;
          validateDraft(content, source);
          if ((await db.query('SELECT id FROM datasets WHERE version=$1', [content.version])).rows.length) throw new InputError('Já existe um dataset com esse nome. Escolhe outro.');
          if (action === 'save') {
            await db.query('UPDATE dataset_draft SET content=$1,revision=nextval(\'dataset_draft_revision\'),updated_at=now() WHERE id=1', [JSON.stringify(content)]);
          } else {
            if (active?.id !== draft.source_id) throw new InputError('O dataset ativo mudou desde a criação do rascunho.', 409);
            const id = `dataset-${randomUUID()}`;
            const remap = (old) => `${id}:${old.startsWith(`${draft.source_id}:`) ? old.slice(draft.source_id.length + 1) : old}`;
            await db.query('UPDATE datasets SET active=false WHERE active');
            await db.query('INSERT INTO datasets(id,version,description,active,activated_at) VALUES($1,$2,$3,true,now())', [id, content.version, content.description]);
            const snippets = source.snippets.map((original) => {
              const edited = content.snippets.find((row) => row.id === original.id);
              return { ...original, id: remap(original.id), dataset_id: id, label: edited.label, code: edited.code, intention_pt: edited.intention_pt, intention_en: edited.intention_en };
            });
            const comparisons = (await db.query('SELECT * FROM comparisons WHERE dataset_id=$1 AND active', [draft.source_id])).rows
              .map((c) => ({ ...c, id: remap(c.id), dataset_id: id, snippet_a_id: remap(c.snippet_a_id), snippet_b_id: remap(c.snippet_b_id) }));
            const questions = source.questions.map((original) => {
              const edited = content.questions.find((row) => row.id === original.id);
              return { ...original, id: remap(original.id), dataset_id: id, question_pt: edited.question_pt, question_en: edited.question_en, options: edited.options };
            });
            for (const [table, columns, rows] of [
              ['snippets', 'id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en', snippets],
              ['comparisons', 'id,dataset_id,category,snippet_a_id,snippet_b_id,validation_notes', comparisons],
              ['profile_questions', 'id,dataset_id,question_pt,question_en,type,options,display_order', questions],
            ]) {
              await db.query(`INSERT INTO ${table} (${columns}) SELECT ${columns} FROM jsonb_populate_recordset(null::${table},$1::jsonb)`, [JSON.stringify(rows)]);
            }
            await db.query('DELETE FROM dataset_draft WHERE id=1');
          }
        }
        await db.query('COMMIT');
        res.json({ ok: true });
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { db.release(); }
    }));
  }
}
