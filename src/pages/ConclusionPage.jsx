import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import InterfaceIcon from "../components/InterfaceIcon.jsx";
import resultsTranslations from "../i18n/resultsTranslations.js";
import translations from "../i18n/translations.js";
import { readStoredWinner } from "../game/gameUtils.js";

function ResultCode({ code }) {
  return <div className="result-code-scroll" tabIndex={0}><pre className="result-code">{code.split('\n').map((line, i) => <span className="result-code-line" key={i}><span className="result-line-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><code>{line || '\u00a0'}</code></span>)}</pre></div>;
}

export default function ConclusionPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].conclusion;
  const labels = resultsTranslations[language];
  const [shareStatus, setShareStatus] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const finalWinner = useMemo(() => readStoredWinner(sessionStorage), []);
  const choices = Object.entries(finalWinner?.selectedStyles || {});

  async function handleCopy() {
    try { await navigator.clipboard.writeText(finalWinner.code); setCopyStatus('copied'); }
    catch { setCopyStatus('error'); }
  }
  async function handleShare() {
    const shareUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: text.shareTitle, text: text.shareText, url: shareUrl });
        setShareStatus(text.shared);
      } else { await navigator.clipboard.writeText(shareUrl); setShareStatus(text.copied); }
    } catch (error) { if (error?.name !== 'AbortError') setShareStatus(text.shareError); }
  }
  function handleRestart() {
    for (const key of ['finalWinner','finalAnswers','profileAnswers','gameState','sessionId','dreamCode']) sessionStorage.removeItem(key);
    navigate('/');
  }

  return <Layout language={language} setLanguage={setLanguage} showAbout={false} showBraces={false} bracesVariant="conclusion">
    <button type="button" className="mini-logo logo-button" onClick={() => navigate('/')} aria-label={translations[language].common.goHome}>{translations[language].common.brand}</button>
    <section className="result-studio">
      <header className="result-hero">
        <div>
          <p className="studio-eyebrow"><span className="status-dot" />{finalWinner ? text.eyebrow : text.emptyEyebrow}</p>
          <h1>{finalWinner ? text.heroTitle : text.emptyTitle}<br /><span>{finalWinner ? text.heroAccent : text.emptyAccent}</span></h1>
          <p className="result-intro">{finalWinner ? (finalWinner.examples ? text.examplesSubtitle : text.subtitle) : text.emptyDescription}</p>
        </div>
        <div className="signature-art" aria-hidden="true"><span className="signature-bracket">{'{'}</span><div className="signature-stripes">{Array.from({length:7},(_,i)=><i key={i} style={{'--stripe':i}} />)}</div><span className="signature-bracket">{'}'}</span><span className="signature-caption">{text.artCaption}</span></div>
      </header>

      {finalWinner ? <>
        <div className="result-workspace">
          <article className="result-editor">
            <header className="result-editor-header"><div><span className="editor-file-icon" aria-hidden="true">{'</>'}</span><h2>{finalWinner.examples ? text.examplesTitle : text.codeTab}</h2></div><button className="quiet-button" onClick={handleCopy}><InterfaceIcon name={copyStatus === 'copied' ? 'check' : 'copy'} />{copyStatus === 'copied' ? text.codeCopied : text.copyCode}</button></header>
            {finalWinner.examples ? finalWinner.examples.map(example => <section className="result-historical" key={example.category}><h3>{labels.categories[example.category] || example.category}</h3>{example.status === 'incomplete' && <p>{labels.incomplete}</p>}<ResultCode code={example.code}/></section>) : <ResultCode code={finalWinner.code}/>}
            <footer className="result-editor-footer"><span className="status-dot" /><span>{finalWinner.examples ? text.examplesNote : text.experimentalNote}</span></footer>
            <span className="sr-only" role="status" aria-live="polite">{copyStatus === 'copied' ? text.codeCopied : copyStatus === 'error' ? text.copyError : ''}</span>
            {copyStatus === 'error' && <p className="result-inline-error">{text.copyError}</p>}
          </article>
          <aside className="result-signature">
            <div className="signature-heading"><span className="studio-eyebrow">{text.signatureEyebrow}</span><h2>{text.signatureTitle}</h2><p>{text.signatureDescription}</p></div>
            {choices.length > 0 ? <ol className="signature-list">{choices.map(([category, style], i) => <li key={category}><span className="signature-number">{String(i + 1).padStart(2,'0')}</span><div><span>{labels.categories[category] || category}</span><strong className={!style ? 'unconfirmed-style' : ''}>{style ? labels.styles[style] || style : text.unconfirmed}</strong></div><span className={`signature-indicator${style ? '' : ' unconfirmed'}`} aria-hidden="true">{style ? <InterfaceIcon name="check" width="14" height="14" /> : '—'}</span></li>)}</ol> : <p className="signature-description">{text.legacySummary}</p>}
            {finalWinner.hasSkippedComparisons && <p className="signature-skip-note">{text.skippedNote}</p>}
          </aside>
        </div>
        <p className="result-thanks"><InterfaceIcon name="check" />{text.result1}</p>
        <section className="result-next"><div><span className="studio-eyebrow">{text.nextEyebrow}</span><h2>{text.nextTitle}</h2><p>{text.nextDescription}</p></div><button className="result-primary" onClick={() => navigate('/resultados-gerais')}>{text.generalResults}<InterfaceIcon /></button></section>
      </> : <div className="result-empty"><span aria-hidden="true">{'{ … }'}</span><p>{text.emptyPrompt}</p><button className="result-primary" onClick={() => navigate('/game')}>{text.startGame}<InterfaceIcon /></button></div>}
      <footer className="result-actions"><button className="quiet-button" onClick={handleRestart}><InterfaceIcon name="restart" />{text.restart}</button><span>{text.footerNote}</span><button className="quiet-button" onClick={handleShare}><InterfaceIcon name="share" />{text.share}</button></footer>
      <p className="share-status" role="status" aria-live="polite">{shareStatus}</p>
    </section>
  </Layout>;
}
