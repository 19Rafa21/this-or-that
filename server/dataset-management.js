import { randomUUID } from 'node:crypto';
import { InputError } from './tournament.js';
import { stagesFromSource, structureKey, generateStructure } from '../src/game/datasetStructure.js';
import { cumulativeOptions } from '../src/game/cumulativeCode.js';

export async function createManagementSchema(db) {
  await db.query(`ALTER TABLE datasets ADD COLUMN IF NOT EXISTS activated_at timestamptz;
    ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS display_order integer;
    ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS presentation jsonb;
    ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS progressive boolean NOT NULL DEFAULT false;
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
  const comparisons = (await db.query('SELECT * FROM comparisons WHERE dataset_id=$1 AND active', [id])).rows;
  return { questions, snippets, comparisons, stages: stagesFromSource(snippets, comparisons) };
}

function generateValidated(stages) {
  try { return generateStructure(stages); } catch (error) { throw new InputError(error.message); }
}
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validateStages(stages) {
  if (!Array.isArray(stages) || !stages.length || stages.length > 7) throw new InputError('Escolhe entre uma e sete etapas.');
  const seen = new Set();
  for (const stage of stages) {
    if (!stage || !Object.hasOwn(cumulativeOptions, stage.category) || seen.has(stage.category)) throw new InputError('Etapa inválida ou repetida.');
    seen.add(stage.category);
    const custom = stage.customOptions || [];
    if (!Array.isArray(custom) || custom.length > 8) throw new InputError('Cada etapa pode ter até oito alternativas personalizadas.');
    const customIds = new Set();
    for (const option of custom) {
      if (!option || !/^custom_[a-z0-9-]{1,60}$/.test(option.id) || customIds.has(option.id) ||
          !text(option.pt, 100) || !text(option.en, 100) || !cumulativeOptions[stage.category].includes(option.baseStyle) ||
          !text(option.from, 2000) || typeof option.to !== 'string' || option.to.length > 2000 || option.from === option.to) {
        throw new InputError('Preenche o nome nas duas línguas, a alternativa de base e uma substituição diferente para cada nova opção.');
      }
      customIds.add(option.id);
    }
    if (!Array.isArray(stage.styles) || stage.styles.length < 2 || stage.styles.length > 12 || new Set(stage.styles).size !== stage.styles.length || stage.styles.some(s => !cumulativeOptions[stage.category].includes(s) && !customIds.has(s))) throw new InputError('Cada etapa precisa de pelo menos duas alternativas válidas.');
    if (['title_pt', 'title_en', 'question_pt', 'question_en', 'intention_pt', 'intention_en'].some(k => !text(stage[k], 2000))) throw new InputError('Preenche os títulos, perguntas e descrições das etapas nas duas línguas.');
  }
  let branches = 1, count = 0, pairs = 0;
  for (const stage of stages) {
    pairs += branches * stage.styles.length * (stage.styles.length - 1) / 2;
    branches *= stage.styles.length; count += branches;
    if (count > 20000 || pairs > 40000) throw new InputError('Demasiadas combinações. Reduz as alternativas ou as etapas.');
  }
}
export function draftBlueprint(content, source) {
  if (content.generated) return generateValidated(content.stages);
  if (structureKey(content.stages) !== structureKey(source.stages)) throw new InputError('A estrutura mudou. Regenera os exemplos antes de guardar.');
  return source;
}
export function validateDraft(content, source) {
  if (!content || !text(content.version, 80) || !text(content.description, 2000)) throw new InputError('Indica um nome e uma descrição para o dataset.');
  validateStages(content.stages);
  const blueprint = draftBlueprint(content, source);
  if (content.generated && content.structureKey !== structureKey(content.stages)) throw new InputError('A estrutura mudou. Regenera os exemplos antes de guardar.');
  if (!Array.isArray(content.questions) || content.questions.length > 50) throw new InputError('O dataset pode ter até 50 perguntas de perfil.');
  const questionIds = new Set();
  for (const q of content.questions) {
    if (!q || !text(q.id, 250) || questionIds.has(q.id) || !text(q.question_pt, 2000) || !text(q.question_en, 2000)) throw new InputError('Pergunta inválida, repetida ou incompleta.');
    questionIds.add(q.id);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 50) throw new InputError('Cada pergunta precisa de 2 a 50 opções.');
    const values = new Set();
    for (const option of q.options) {
      if (!option || !text(option.value, 100) || ['skipped', '__missing__'].includes(option.value) || values.has(option.value) || !text(option.pt, 500) || !text(option.en, 500)) throw new InputError('Preenche as opções nas duas línguas, sem identificadores repetidos.');
      values.add(option.value);
    }
  }
  if (!Array.isArray(content.snippets) || content.snippets.length !== blueprint.snippets.length) throw new InputError('O rascunho deve conter todos os exemplos da estrutura escolhida.');
  const originals = new Map(blueprint.snippets.map(s => [s.id, s]));
  const ids = new Set();
  for (const row of content.snippets) {
    if (!row || !originals.has(row.id) || ids.has(row.id)) throw new InputError('Exemplo inválido ou repetido.');
    ids.add(row.id);
    if (['label', 'code', 'intention_pt', 'intention_en'].some(field => !text(row[field], field === 'code' ? 20000 : 2000))) throw new InputError('Preenche os textos e o código de todos os exemplos.');
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
    if (draft && !draft.content.stages) draft.content.stages = (await sourceContent(pool, draft.source_id)).stages;
    res.json({ active, draft });
  }));
  for (const action of ['create', 'save', 'regenerate', 'activate']) {
    app.post(`/api/admin/datasets/${action}`, authorize, route(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        // Serializa a criação, a edição e a ativação, incluindo o caso em que ainda não existe um rascunho.
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
          let content = action === 'activate' ? draft.content : req.body.content;
          // Atualiza os rascunhos guardados pelo editor anterior sem reescrever os seus exemplos.
          content = { ...content, stages: content?.stages || source.stages };
          if (action === 'regenerate') {
            validateStages(content.stages);
            content = { ...content, generated: true, structureKey: structureKey(content.stages), snippets: generateValidated(content.stages).snippets };
          }
          validateDraft(content, source);
          if ((await db.query('SELECT id FROM datasets WHERE version=$1', [content.version])).rows.length) throw new InputError('Já existe um dataset com esse nome. Escolhe outro.');
          if (action === 'save' || action === 'regenerate') {
            await db.query('UPDATE dataset_draft SET content=$1,revision=nextval(\'dataset_draft_revision\'),updated_at=now() WHERE id=1', [JSON.stringify(content)]);
          } else {
            if (active?.id !== draft.source_id) throw new InputError('O dataset ativo mudou desde a criação do rascunho.', 409);
            const id = `dataset-${randomUUID()}`;
            const remap = (old) => `${id}:${old.startsWith(`${draft.source_id}:`) ? old.slice(draft.source_id.length + 1) : old}`;
            await db.query('UPDATE datasets SET active=false WHERE active');
            await db.query('INSERT INTO datasets(id,version,description,active,activated_at) VALUES($1,$2,$3,true,now())', [id, content.version, content.description]);
            const blueprint = draftBlueprint(content, source);
            const snippets = blueprint.snippets.map((original) => {
              const edited = content.snippets.find((row) => row.id === original.id);
              return { ...original, id: remap(original.id), dataset_id: id, label: edited.label, code: edited.code, intention_pt: edited.intention_pt, intention_en: edited.intention_en };
            });
            const comparisons = blueprint.comparisons.map((c) => {
              const order = content.stages.findIndex(stage => stage.category === c.category);
              const { styles: _styles, category: _category, ...presentation } = content.stages[order];
              return { ...c, id: remap(c.id), dataset_id: id, snippet_a_id: remap(c.snippet_a_id), snippet_b_id: remap(c.snippet_b_id), display_order: order, presentation, progressive: c.progressive || false };
            });
            const questions = content.questions.map((edited, index) => ({
              id: remap(edited.id), dataset_id: id, type: 'single_choice', display_order: index + 1,
              question_pt: edited.question_pt, question_en: edited.question_en, options: edited.options,
            }));
            if (new Set(questions.map(q => q.id)).size !== questions.length) throw new InputError('Identificadores de perguntas incompatíveis.');
            for (const [table, columns, rows] of [
              ['snippets', 'id,dataset_id,category,language,style,source_language,inherited_styles,label,code,intention_pt,intention_en', snippets],
              ['comparisons', 'id,dataset_id,category,snippet_a_id,snippet_b_id,validation_notes,display_order,presentation,progressive', comparisons],
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
