import { useEffect, useState } from 'react';
import resultsTranslations from '../i18n/resultsTranslations.js';
import { manageDataset } from '../api.js';
import { StageEditor, ProfileEditor } from './DatasetStructureEditor.jsx';
import { structureKey } from '../game/datasetStructure.js';

export default function DatasetManager({ token, onActivated, language }) {
  const [state, setState] = useState(null);
  const [content, setContent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [review, setReview] = useState(false);
  const [examplePage, setExamplePage] = useState(0);
  const pageSize = 24;
  const [originalStructure, setOriginalStructure] = useState('');
  const [regenerateConfirmed, setRegenerateConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const en = language === 'en';
  const t = (pt, english) => en ? english : pt;
  const labels = resultsTranslations[language];
  const exampleTitle = (s) => `${labels.categories[s.category] || s.category} · ${labels.styles[s.style] || s.label}${Object.values(s.inherited_styles).length ? ` · ${Object.values(s.inherited_styles).map((style) => labels.styles[style] || style).join(' / ')}` : ''}`;
  useEffect(() => {
    let cancelled = false;
    manageDataset(token).then((result) => {
      if (!cancelled) { setState(result); setContent(result.draft?.content || null); setOriginalStructure(result.draft?.content ? result.draft.content.structureKey || structureKey(result.draft.content.stages) : ''); }
    }).catch(() => { if (!cancelled) setError('Não foi possível carregar a gestão de datasets. / Could not load dataset management.'); });
    return () => { cancelled = true; };
  }, [token]);
  async function run(action) {
    setBusy(true); setError(''); setSaved(false);
    try {
      await manageDataset(token, action, { revision: state?.draft?.revision, content });
      const result = await manageDataset(token);
      setState(result); setContent(result.draft?.content || null); setOriginalStructure(result.draft?.content ? result.draft.content.structureKey || structureKey(result.draft.content.stages) : '');
      setExamplePage(0); setRegenerateConfirmed(false); setReview(action === 'save'); setConfirmed(false); setSaved(action === 'save');
      if (action === 'activate') onActivated(result.active.id);
    } catch (err) {
      let message;
      try { message = JSON.parse(err.message).error; } catch { /* Network errors use a friendly fallback. */ }
      setError(err.status === 401 ? t('A sessão expirou. Volta a entrar.', 'Your session expired. Sign in again.') : message || t('Não foi possível guardar. Tenta novamente.', 'Could not save. Try again.'));
    } finally { setBusy(false); }
  }
  const structureChanged = content && structureKey(content.stages) !== originalStructure;
  function edit(next) { setContent(next); setReview(false); setConfirmed(false); setSaved(false); }
  function changeRow(key, index, field, value) {
    edit({ ...content, [key]: content[key].map((row, i) => i === index ? { ...row, [field]: value } : row) });
  }
  return <details className="dataset-manager"><summary>{t('Gerir dataset ativo', 'Manage active dataset')}</summary>
    {error && <p role="alert" className="results-error">{error}</p>}
    {!state && !error && <p>{t('A carregar…', 'Loading…')}</p>}
    {state?.active && <div className="dataset-active"><h2>{t('Dataset ativo', 'Active dataset')}: {state.active.version}</h2>
      <p>{state.active.description}</p><p>{state.active.questions} {t('perguntas', 'questions')} · {state.active.comparisons} {t('comparações', 'comparisons')} · {state.active.sessions} {t('sessões', 'sessions')}</p>
      <p>{t('Ativado em', 'Activated on')}: {state.active.activated_at ? new Date(state.active.activated_at).toLocaleString(en ? 'en-GB' : 'pt-PT') : t('data não registada (dataset anterior a esta funcionalidade)', 'date not recorded (dataset predates this feature)')}</p>
    </div>}
    <p>{t('As alterações são preparadas num rascunho. Ao ativá-lo, só os novos participantes recebem o novo conteúdo. As respostas anteriores ficam disponíveis no respetivo dataset.', 'Changes are prepared in a draft. Activation applies to new participants. Previous responses remain available in their original dataset.')}</p>
    {state && !content && <button disabled={busy || !state.active} onClick={() => run('create')}>{t('Preparar atualização', 'Prepare update')}</button>}
    {content && <fieldset disabled={busy} className="dataset-editor"><legend>{t('Rascunho', 'Draft')}</legend>
      <p>{t('Edita as etapas, os textos, as perguntas de perfil e os exemplos. As alterações só entram no jogo depois da ativação.', 'Edit stages, wording, profile questions and examples. Changes reach the game only after activation.')}</p>
      <label>{t('Nome do novo dataset', 'New dataset name')}<input maxLength={80} value={content.version} onChange={(e) => edit({ ...content, version: e.target.value })} /></label>
      <label>{t('Descrição das alterações', 'Description of changes')}<textarea maxLength={2000} value={content.description} onChange={(e) => edit({ ...content, description: e.target.value })} /></label>
      <p>{t('Página de exemplos', 'Examples page')} {examplePage + 1} / {Math.max(1, Math.ceil(content.snippets.length / pageSize))}
        <button disabled={examplePage === 0} onClick={() => setExamplePage(p => p - 1)}>{t('Anterior', 'Previous')}</button>
        <button disabled={(examplePage + 1) * pageSize >= content.snippets.length} onClick={() => setExamplePage(p => p + 1)}>{t('Seguinte', 'Next')}</button>
      </p>
      {!review && <>
        <StageEditor stages={content.stages} onChange={stages => { edit({ ...content, stages }); setRegenerateConfirmed(false); }} language={language} t={t} />
        {structureChanged && <section className="dataset-structure-warning"><p>{t('A ordem, as etapas ou as alternativas mudaram. É necessário regenerar os exemplos para a nova estrutura. Isto substitui as edições manuais dos exemplos deste rascunho. Quando uma etapa precisa de código ainda não escolhido, é usada uma forma base, sem contar como preferência do participante. Revê também as descrições para corresponderem à nova ordem.', 'The order, stages or alternatives changed. Regenerate examples for the new structure. This replaces manual example edits in this draft. Stages that need code not yet chosen use a baseline form, which does not count as a participant preference. Also review descriptions to match the new order.')}</p>
          <label className="dataset-confirm"><input type="checkbox" checked={regenerateConfirmed} onChange={e => setRegenerateConfirmed(e.target.checked)} />{t('Substituir os exemplos do rascunho pela nova estrutura.', 'Replace draft examples with the new structure.')}</label>
          <button disabled={!regenerateConfirmed} onClick={() => run('regenerate')}>{t('Regenerar exemplos', 'Regenerate examples')}</button></section>}
        <ProfileEditor questions={content.questions} onChange={questions => edit({ ...content, questions })} language={language} t={t} />
        <h3>{t('Exemplos de código', 'Code examples')}</h3>
        <p>{t('Existem várias combinações cumulativas. Revê também os exemplos que incluem escolhas das etapas anteriores.', 'Examples are cumulative. Also review combinations containing choices from earlier stages.')}</p>
        <details><summary>{t('Abrir exemplos', 'Open examples')} ({content.snippets.length})</summary>
        {content.snippets.slice(examplePage * pageSize, (examplePage + 1) * pageSize).map((s, offset) => <details key={s.id}><summary>{exampleTitle(s)}</summary>
          <label>{t('Designação interna (não aparece no jogo)', 'Internal label (not shown in the game)')}<input maxLength={2000} value={s.label} onChange={(e) => changeRow('snippets', examplePage * pageSize + offset, 'label', e.target.value)} /></label>
          <label>{t('Código', 'Code')}<textarea className="dataset-code" maxLength={20000} value={s.code} onChange={(e) => changeRow('snippets', examplePage * pageSize + offset, 'code', e.target.value)} /></label>
        </details>)}
        </details>
      </>}
      {saved && <p role="status">{t('Rascunho guardado e validado.', 'Draft saved and validated.')}</p>}
      {review && <section><h3>{t('Rever antes de ativar', 'Review before activation')}</h3>
        <p>{t('A validação verifica o preenchimento e a estrutura. Confirma o significado das perguntas e a coerência do código em todas as combinações.', 'Validation checks required fields and structure. Verify question meaning and code consistency in every combination.')}</p>
        <p>{content.stages.length} {t('etapas', 'stages')} · {content.stages.reduce((total, stage) => total + stage.styles.length - 1, 0)} {t('comparações por participante', 'comparisons per participant')} · {content.questions.length} {t('perguntas de perfil', 'profile questions')}</p>
        {content.stages.map((stage, i) => <details key={stage.category}><summary>{i + 1}. {stage[`title_${language}`]}</summary>{['pt', 'en'].map(lang => <div key={lang}><h4>{stage[`question_${lang}`]}</h4><p>{stage[`title_${lang}`]}</p><p>{stage[`intention_${lang}`]}</p></div>)}</details>)}
        {content.questions.map((q) => <details key={q.id}><summary>{q[`question_${language}`]}</summary>{['pt', 'en'].map((lang) => <div key={lang}><h4>{q[`question_${lang}`]}</h4><ul>{q.options.map((o) => <li key={o.value}>{o[lang]}</li>)}</ul></div>)}</details>)}
        {content.snippets.slice(examplePage * pageSize, (examplePage + 1) * pageSize).map((s) => <details key={s.id}><summary>{exampleTitle(s)}</summary><p>{content.stages.find(stage => stage.category === s.category)?.intention_pt}</p><p>{content.stages.find(stage => stage.category === s.category)?.intention_en}</p><pre>{s.code}</pre></details>)}
        <label className="dataset-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{t('Revi o conteúdo e quero iniciar a recolha neste novo dataset. Os resultados gerais passarão a mostrar este dataset, inicialmente sem respostas.', 'I reviewed the content and want to start collecting responses in this new dataset. Public results will show it, initially with no responses.')}</label>
        <button disabled={!confirmed} onClick={() => run('activate')}>{t('Ativar novo dataset', 'Activate new dataset')}</button>
        <button onClick={() => { setReview(false); setConfirmed(false); }}>{t('Voltar a editar', 'Back to editing')}</button>
      </section>}
      {!review && <button disabled={structureChanged} onClick={() => run('save')}>{busy ? t('A guardar…', 'Saving…') : t('Guardar e rever rascunho', 'Save and review draft')}</button>}
    </fieldset>}
  </details>;
}
