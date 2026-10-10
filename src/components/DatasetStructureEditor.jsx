import { useState } from 'react';
import { cumulativeOptions } from '../game/cumulativeCode.js';
import { newStage } from '../game/datasetStructure.js';
import resultsTranslations from '../i18n/resultsTranslations.js';

function move(items, index, delta) {
  const next = [...items];
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}
function OrderButtons({ items, index, onChange, t }) {
  return <div className="dataset-actions">
    <button type="button" disabled={index === 0} onClick={() => onChange(move(items, index, -1))}>{t('Subir', 'Move up')}</button>
    <button type="button" disabled={index === items.length - 1} onClick={() => onChange(move(items, index, 1))}>{t('Descer', 'Move down')}</button>
    <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>{t('Remover', 'Remove')}</button>
  </div>;
}
export function StageEditor({ stages, onChange, language, t }) {
  const labels = resultsTranslations[language];
  const available = Object.keys(cumulativeOptions).filter(category => !stages.some(s => s.category === category));
  const [selected, setSelected] = useState('');
  const categoryToAdd = available.includes(selected) ? selected : available[0] || '';
  function update(index, patch) { onChange(stages.map((stage, i) => i === index ? { ...stage, ...patch } : stage)); }
  return <section><h3>{t('Etapas de comparação', 'Comparison stages')}</h3>
    <p>{t('A ordem abaixo é a ordem do jogo. Os três textos aparecem acima dos excertos; a designação de cada exemplo serve apenas para o identificar no editor.', 'The order below is the game order. All three texts appear above the snippets; each example label only identifies it in the editor.')}</p>
    {stages.map((stage, i) => <details key={stage.category}><summary>{i + 1}. {stage[`title_${language}`] || labels.categories[stage.category]} · {stage.styles.length - 1} {t('comparações por participante', 'comparisons per participant')}</summary>
      <OrderButtons items={stages} index={i} onChange={onChange} t={t} />
      {['pt', 'en'].map(lang => <div key={lang} className="dataset-stage-texts">
        {[['question', t('Pergunta principal', 'Main question')], ['title', t('Título da etapa', 'Stage title')], ['intention', t('Descrição acima do código', 'Description above the code')]].map(([field, label]) => <label key={field}>{label} ({lang.toUpperCase()})<textarea maxLength={2000} value={stage[`${field}_${lang}`]} onChange={e => update(i, { [`${field}_${lang}`]: e.target.value })} /></label>)}
      </div>)}
      <fieldset><legend>{t('Alternativas incluídas (mínimo duas)', 'Included alternatives (at least two)')}</legend>
        {cumulativeOptions[stage.category].map(style => <label className="dataset-confirm" key={style}><input type="checkbox" checked={stage.styles.includes(style)} onChange={e => update(i, { styles: e.target.checked ? [...stage.styles, style] : stage.styles.filter(s => s !== style) })} />{labels.styles[style] || style}</label>)}
      </fieldset>
      <details><summary>{t('Opções avançadas', 'Advanced options')}</summary><CustomOptions stage={stage} onChange={patch => update(i, patch)} language={language} t={t} /></details>
      <div className="dataset-text-preview"><strong>{t('Pré-visualização dos textos', 'Text preview')}</strong><h4>{stage[`question_${language}`]}</h4><p>{t('Etapa', 'Stage')} {i + 1} / {stages.length} — {stage[`title_${language}`]}</p><p>{stage[`intention_${language}`]}</p></div>
    </details>)}
    {available.length > 0 && <div className="dataset-actions"><label>{t('Categoria a adicionar', 'Category to add')}<select value={categoryToAdd} onChange={e => setSelected(e.target.value)}>{available.map(category => <option key={category} value={category}>{labels.categories[category]}</option>)}</select></label><button type="button" onClick={() => onChange([...stages, newStage(categoryToAdd)])}>{t('Adicionar etapa', 'Add stage')}</button></div>}
  </section>;
}
export function ProfileEditor({ questions, onChange, language, t }) {
  function update(index, patch) { onChange(questions.map((q, i) => i === index ? { ...q, ...patch } : q)); }
  return <section><h3>{t('Perguntas de perfil', 'Profile questions')}</h3>
    <p>{t('As perguntas são intercaladas entre as etapas, mantendo esta ordem. Podes remover todas se não precisares de recolher dados de perfil.', 'Questions are distributed between stages in this order. You can remove all of them if profile data is not needed.')}</p>
    {questions.map((q, i) => <details key={q.id}><summary>{i + 1}. {q[`question_${language}`] || t('Nova pergunta', 'New question')}</summary>
      <OrderButtons items={questions} index={i} onChange={onChange} t={t} />
      {['pt', 'en'].map(lang => <label key={lang}>{t('Pergunta', 'Question')} ({lang.toUpperCase()})<textarea maxLength={2000} value={q[`question_${lang}`]} onChange={e => update(i, { [`question_${lang}`]: e.target.value })} /></label>)}
      {q.options.map((option, oi) => <div key={option.value} className="dataset-option-editor">
        <div className="dataset-options">{['pt', 'en'].map(lang => <label key={lang}>{t('Opção', 'Option')} {oi + 1} ({lang.toUpperCase()})<input maxLength={500} value={option[lang]} onChange={e => update(i, { options: q.options.map((o, j) => j === oi ? { ...o, [lang]: e.target.value } : o) })} /></label>)}</div>
        <OrderButtons items={q.options} index={oi} onChange={options => update(i, { options })} t={t} />
      </div>)}
      <button type="button" disabled={q.options.length >= 50} onClick={() => update(i, { options: [...q.options, { value: `option-${crypto.randomUUID()}`, pt: '', en: '' }] })}>{t('Adicionar opção', 'Add option')}</button>
    </details>)}
    <button type="button" disabled={questions.length >= 50} onClick={() => onChange([...questions, { id: `new-${crypto.randomUUID()}`, question_pt: '', question_en: '', options: [{ value: 'option-1', pt: '', en: '' }, { value: 'option-2', pt: '', en: '' }] }])}>{t('Adicionar pergunta de perfil', 'Add profile question')}</button>
  </section>;
}

export function CustomOptions({ stage, onChange, language, t }) {
  const options = stage.customOptions || [];
  const labels = resultsTranslations[language];
  function update(id, patch) { onChange({ customOptions: options.map(o => o.id === id ? { ...o, ...patch } : o) }); }
  function add() {
    const id = `custom_${crypto.randomUUID()}`;
    onChange({ styles: [...stage.styles, id], customOptions: [...options, { id, pt: '', en: '', baseStyle: cumulativeOptions[stage.category][0], from: '', to: '' }] });
  }
  return <section className="dv-custom-options"><h4>{t('Alternativas personalizadas', 'Custom alternatives')}</h4>
    <p className="dv-help">{t('Cria uma variante a partir de uma opção existente. A substituição é literal e aplica-se também às etapas seguintes, quando esta alternativa é escolhida.', 'Create a variant from an existing option. The literal replacement also applies to later stages when this alternative is chosen.')}</p>
    {options.map((option, i) => <details key={option.id} open><summary>{option[language] || `${t('Nova alternativa', 'New alternative')} ${i + 1}`}</summary>
      <label className="dataset-confirm"><input type="checkbox" checked={stage.styles.includes(option.id)} onChange={e => onChange({ styles: e.target.checked ? [...stage.styles, option.id] : stage.styles.filter(s => s !== option.id) })} />{t('Incluir nesta etapa', 'Include in this stage')}</label>
      {['pt', 'en'].map(lang => <label key={lang}>{t('Nome', 'Name')} ({lang.toUpperCase()})<input maxLength={100} value={option[lang]} onChange={e => update(option.id, { [lang]: e.target.value })} /></label>)}
      <label>{t('Partir da alternativa', 'Start from alternative')}<select value={option.baseStyle} onChange={e => update(option.id, { baseStyle: e.target.value })}>{cumulativeOptions[stage.category].map(style => <option key={style} value={style}>{labels.styles[style]}</option>)}</select></label>
      <label>{t('Trecho original (exato)', 'Original fragment (exact)')}<textarea spellCheck={false} maxLength={2000} value={option.from} onChange={e => update(option.id, { from: e.target.value })} /></label>
      <label>{t('Substituir por', 'Replace with')}<textarea spellCheck={false} maxLength={2000} value={option.to} onChange={e => update(option.id, { to: e.target.value })} /></label>
      <button type="button" onClick={() => onChange({ styles: stage.styles.filter(s => s !== option.id), customOptions: options.filter(o => o.id !== option.id) })}>{t('Remover alternativa', 'Remove alternative')}</button>
    </details>)}
    <button type="button" disabled={options.length >= 8 || stage.styles.length >= 12} onClick={add}>+ {t('Adicionar alternativa', 'Add alternative')}</button>
  </section>;
}
