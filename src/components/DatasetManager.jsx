import { useEffect, useState } from 'react';
import resultsTranslations from '../i18n/resultsTranslations.js';
import { manageDataset } from '../api.js';

export default function DatasetManager({ token, onActivated, language }) {
  const [state, setState] = useState(null);
  const [content, setContent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const en = language === 'en';
  const t = (pt, english) => en ? english : pt;
  const labels = resultsTranslations[language];
  const exampleTitle = (s) => `${labels.categories[s.category] || s.category} · ${s.label}${Object.values(s.inherited_styles).length ? ` · ${Object.values(s.inherited_styles).map((style) => labels.styles[style] || style).join(' / ')}` : ''}`;
  useEffect(() => {
    let cancelled = false;
    manageDataset(token).then((result) => {
      if (!cancelled) { setState(result); setContent(result.draft?.content || null); }
    }).catch(() => { if (!cancelled) setError('Não foi possível carregar a gestão de datasets. / Could not load dataset management.'); });
    return () => { cancelled = true; };
  }, [token]);
  async function run(action) {
    setBusy(true); setError(''); setSaved(false);
    try {
      await manageDataset(token, action, { revision: state?.draft?.revision, content });
      const result = await manageDataset(token);
      setState(result); setContent(result.draft?.content || null);
      setReview(action === 'save'); setConfirmed(false); setSaved(action === 'save');
      if (action === 'activate') onActivated(result.active.id);
    } catch (err) {
      let message;
      try { message = JSON.parse(err.message).error; } catch { /* Network errors use a friendly fallback. */ }
      setError(err.status === 401 ? t('A sessão expirou. Volta a entrar.', 'Your session expired. Sign in again.') : message || t('Não foi possível guardar. Tenta novamente.', 'Could not save. Try again.'));
    } finally { setBusy(false); }
  }
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
      <p>{t('Edita os textos, as opções e os exemplos. A estrutura das comparações e os identificadores das opções são preservados.', 'Edit wording, option labels and examples. Comparison structure and option identifiers are preserved.')}</p>
      <label>{t('Nome do novo dataset', 'New dataset name')}<input maxLength={80} value={content.version} onChange={(e) => edit({ ...content, version: e.target.value })} /></label>
      <label>{t('Descrição das alterações', 'Description of changes')}<textarea maxLength={2000} value={content.description} onChange={(e) => edit({ ...content, description: e.target.value })} /></label>
      {!review && <>
        <h3>{t('Perguntas de perfil', 'Profile questions')}</h3>
        {content.questions.map((q, i) => <details key={q.id}><summary>{i + 1}. {q[`question_${language}`]}</summary>
          {['pt', 'en'].map((lang) => <label key={lang}>{t('Pergunta', 'Question')} ({lang.toUpperCase()})<textarea maxLength={2000} value={q[`question_${lang}`]} onChange={(e) => changeRow('questions', i, `question_${lang}`, e.target.value)} /></label>)}
          {q.options.map((option, oi) => <div className="dataset-options" key={option.value}>{['pt', 'en'].map((lang) => <label key={lang}>{t('Opção', 'Option')} {oi + 1} ({lang.toUpperCase()})<input maxLength={500} value={option[lang]} onChange={(e) => changeRow('questions', i, 'options', q.options.map((o, j) => j === oi ? { ...o, [lang]: e.target.value } : o))} /></label>)}</div>)}
        </details>)}
        <h3>{t('Exemplos de código', 'Code examples')}</h3>
        <p>{t('Existem várias combinações cumulativas. Revê também os exemplos que incluem escolhas das etapas anteriores.', 'Examples are cumulative. Also review combinations containing choices from earlier stages.')}</p>
        <details><summary>{t('Abrir exemplos', 'Open examples')} ({content.snippets.length})</summary>
        {content.snippets.map((s, i) => <details key={s.id}><summary>{exampleTitle(s)}</summary>
          <label>{t('Designação', 'Label')}<input maxLength={2000} value={s.label} onChange={(e) => changeRow('snippets', i, 'label', e.target.value)} /></label>
          <label>{t('Código', 'Code')}<textarea className="dataset-code" maxLength={20000} value={s.code} onChange={(e) => changeRow('snippets', i, 'code', e.target.value)} /></label>
          {['pt', 'en'].map((lang) => <label key={lang}>{t('Objetivo', 'Intention')} ({lang.toUpperCase()})<textarea maxLength={2000} value={s[`intention_${lang}`]} onChange={(e) => changeRow('snippets', i, `intention_${lang}`, e.target.value)} /></label>)}
        </details>)}
        </details>
      </>}
      {saved && <p role="status">{t('Rascunho guardado e validado.', 'Draft saved and validated.')}</p>}
      {review && <section><h3>{t('Rever antes de ativar', 'Review before activation')}</h3>
        <p>{t('A validação verifica o preenchimento e a estrutura. Confirma o significado das perguntas e a coerência do código em todas as combinações.', 'Validation checks required fields and structure. Verify question meaning and code consistency in every combination.')}</p>
        {content.questions.map((q) => <details key={q.id}><summary>{q[`question_${language}`]}</summary>{['pt', 'en'].map((lang) => <div key={lang}><h4>{q[`question_${lang}`]}</h4><ul>{q.options.map((o) => <li key={o.value}>{o[lang]}</li>)}</ul></div>)}</details>)}
        {content.snippets.map((s) => <details key={s.id}><summary>{exampleTitle(s)}</summary><p>{s.intention_pt}</p><p>{s.intention_en}</p><pre>{s.code}</pre></details>)}
        <label className="dataset-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{t('Revi o conteúdo e quero iniciar a recolha neste novo dataset. Os resultados gerais passarão a mostrar este dataset, inicialmente sem respostas.', 'I reviewed the content and want to start collecting responses in this new dataset. Public results will show it, initially with no responses.')}</label>
        <button disabled={!confirmed} onClick={() => run('activate')}>{t('Ativar novo dataset', 'Activate new dataset')}</button>
        <button onClick={() => { setReview(false); setConfirmed(false); }}>{t('Voltar a editar', 'Back to editing')}</button>
      </section>}
      {!review && <button onClick={() => run('save')}>{busy ? t('A guardar…', 'Saving…') : t('Guardar e rever rascunho', 'Save and review draft')}</button>}
    </fieldset>}
  </details>;
}
