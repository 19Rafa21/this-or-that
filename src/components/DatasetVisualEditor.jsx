import { useState } from 'react';
import ComparisonCode from './ComparisonCode.jsx';
import resultsTranslations from '../i18n/resultsTranslations.js';
import { CustomOptions } from './DatasetStructureEditor.jsx';
import { renderStageCode, customStyleLabels } from '../game/datasetStructure.js';
import './dataset-studio.css';

function previewCode(styles, stages) {
  try { return renderStageCode(styles, stages); } catch (error) { return `// ${error.message}`; }
}
const contextKey = styles => JSON.stringify(Object.entries(styles || {}).sort(([a], [b]) => a.localeCompare(b)));

export default function DatasetVisualEditor({ content, onChange, language, structureChanged }) {
  const [category, setCategory] = useState('');
  const [previewLanguage, setPreviewLanguage] = useState(language);
  const [mode, setMode] = useState('texts');
  const [context, setContext] = useState('');
  const [leftStyle, setLeftStyle] = useState('');
  const [rightStyle, setRightStyle] = useState('');
  const [side, setSide] = useState(0);
  const t = (pt, en) => language === 'en' ? en : pt;
  const baseLabels = resultsTranslations[language];
  const labels = { ...baseLabels, styles: { ...baseLabels.styles, ...Object.fromEntries(Object.entries(customStyleLabels(content.stages)).map(([id, names]) => [id, names[language] || t('Nova alternativa', 'New alternative')])) } };
  const stage = content.stages.find(s => s.category === category) || content.stages[0];
  if (!stage) return <p>{t('Adiciona uma etapa em “Estrutura” para começar.', 'Add a stage under “Structure” to begin.')}</p>;
  const stageIndex = content.stages.indexOf(stage);
  const snippets = content.snippets.filter(s => s.category === stage.category && stage.styles.includes(s.style));
  const contexts = [...new Map(snippets.map(s => [contextKey(s.inherited_styles), s.inherited_styles || {}])).entries()];
  const currentContext = contexts.find(([key]) => key === context) || contexts[0];
  const alternatives = structureChanged ? stage.styles.map(style => ({ id: style, style, code: previewCode({ ...Object.fromEntries(content.stages.slice(0, stageIndex).map(s => [s.category, s.styles[0]])), [stage.category]: style }, content.stages) })) : snippets.filter(s => contextKey(s.inherited_styles) === currentContext?.[0]);
  const left = alternatives.find(s => s.style === leftStyle) || alternatives[0];
  const right = alternatives.find(s => s.style === rightStyle && s.id !== left?.id) || alternatives.find(s => s.id !== left?.id);
  const pair = [left, right];
  const selected = pair[side];
  function updateStage(field, value) { onChange({ ...content, stages: content.stages.map(s => s === stage ? { ...s, [`${field}_${previewLanguage}`]: value } : s) }); }
  function updateCode(value) { onChange({ ...content, snippets: content.snippets.map(s => s.id === selected.id ? { ...s, code: value } : s) }); }
  return <section className="dataset-visual">
    <div className="dv-stage-list" aria-label={t('Etapas', 'Stages')}>{content.stages.map((s, i) => <button type="button" key={s.category} aria-pressed={s === stage} onClick={() => { setCategory(s.category); setContext(''); setLeftStyle(''); setRightStyle(''); }}><span>{i + 1}.</span>{s[`title_${language}`] || labels.categories[s.category]}</button>)}</div>
    <div className="dv-workspace">
      <div className="dv-controls">
        <h3>{labels.categories[stage.category]}</h3>
        <div className="dv-segment" aria-label={t('Idioma dos textos e da pré-visualização', 'Text and preview language')}>{['pt', 'en'].map(lang => <button type="button" key={lang} aria-pressed={previewLanguage === lang} onClick={() => setPreviewLanguage(lang)}>{lang === 'pt' ? 'Português' : 'English'}</button>)}</div>
        <div className="dv-segment">{[['texts', t('Textos', 'Wording')], ['code', t('Código', 'Code')]].map(([key, label]) => <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>)}</div>
        {mode === 'texts' ? <>{[['question', t('Pergunta principal', 'Main question')], ['title', t('Título da etapa', 'Stage title')], ['intention', t('Orientação para comparar', 'Comparison guidance')]].map(([field, label]) => <label key={field}>{label}<textarea maxLength={2000} value={stage[`${field}_${previewLanguage}`]} onChange={e => updateStage(field, e.target.value)} /></label>)}<p className="dv-help">{t('Revê os textos em português e inglês.', 'Review the Portuguese and English wording.')}</p></> : <>
          <div className="dv-segment">{pair.map((s, i) => <button type="button" key={i} disabled={!s} aria-pressed={side === i} onClick={() => setSide(i)}>{t('Opção', 'Option')} {i === 0 ? 'A' : 'B'}</button>)}</div>
          {structureChanged ? <p className="dv-help">{t('Esta é uma simulação da nova estrutura. Regenera os exemplos em “Estrutura” antes de editar o código.', 'This simulates the new structure. Regenerate examples under “Structure” before editing code.')}</p> : selected && <label>{labels.styles[selected.style] || selected.style}<textarea className="dataset-code" spellCheck={false} maxLength={20000} value={selected.code} onChange={e => updateCode(e.target.value)} /></label>}
          <p className="dv-help">{t('A edição aplica-se apenas a este exemplo e às escolhas anteriores selecionadas. O destaque das diferenças é automático.', 'Edits apply only to this example with the selected previous choices. Differences are highlighted automatically.')}</p>
        </>}
        <details className="dv-advanced"><summary>{t('Opções avançadas', 'Advanced options')}</summary><CustomOptions stage={stage} language={language} t={t} onChange={patch => { const added = patch.customOptions?.find(o => !stage.customOptions?.some(existing => existing.id === o.id)); if (added) setRightStyle(added.id); onChange({ ...content, stages: content.stages.map(s => s === stage ? { ...s, ...patch } : s) }); }} /></details>
      </div>
      <div className="dv-preview-column">
        <div className="dv-preview-toolbar"><span>{t('Pré-visualização', 'Preview')}</span><small>{structureChanged ? t('Simulação · por regenerar', 'Simulation · regeneration needed') : t('Vista do participante', 'Participant view')}</small></div>
        <div className="dv-comparison">
          <h2 className="game-question">{stage[`question_${previewLanguage}`]}</h2>
          <p className="comparison-focus">{previewLanguage === 'pt' ? 'Etapa' : 'Stage'} {stageIndex + 1} / {content.stages.length} — {stage[`title_${previewLanguage}`]}</p>
          <p className="game-context">{stage[`intention_${previewLanguage}`]}</p>
          <div className="code-grid">{pair.map((s, i) => <div key={i} className="code-area">{s ? <ComparisonCode code={s.code} otherCode={pair[1 - i]?.code || ''} /> : <p>{t('Inclui pelo menos duas alternativas.', 'Include at least two alternatives.')}</p>}</div>)}</div>
          <p className="dv-preview-note">{t('As diferenças aparecem a lilás e em negrito, tal como no jogo.', 'Differences appear in bold lavender, just like in the game.')}</p>
        </div>
        <div className="dv-scenario">
          {!structureChanged && contexts.length > 1 && <fieldset className="dv-context"><legend>{t('Escolhas das etapas anteriores', 'Choices from previous stages')}</legend>{Object.keys(currentContext?.[1] || {}).map(cat => <label key={cat}>{labels.categories[cat] || cat}<select value={currentContext[1][cat]} onChange={e => {
            const matching = contexts.filter(([, styles]) => styles[cat] === e.target.value);
            const next = matching.find(([, styles]) => Object.entries(currentContext[1]).every(([key, value]) => key === cat || styles[key] === value)) || matching[0];
            if (next) setContext(next[0]);
          }}>{[...new Set(contexts.map(([, styles]) => styles[cat]))].map(style => <option key={style} value={style}>{labels.styles[style] || style}</option>)}</select></label>)}</fieldset>}
          <div className="dv-pair-selectors">{pair.map((s, i) => <label key={i}>{t('Opção', 'Option')} {i === 0 ? 'A' : 'B'}<select value={s?.style || ''} onChange={e => i === 0 ? setLeftStyle(e.target.value) : setRightStyle(e.target.value)}>{alternatives.filter(a => i === 0 || a.id !== left?.id).map(a => <option key={a.id} value={a.style}>{labels.styles[a.style] || a.style}</option>)}</select></label>)}</div>
        </div>
      </div>
    </div>
  </section>;
}
