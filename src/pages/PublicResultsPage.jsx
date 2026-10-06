import { getCategoryOrder } from "../game/categoryOrder.js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import ResultsChart from "../components/ResultsChart.jsx";
import resultsTranslations from "../i18n/resultsTranslations.js";
import { getPublicResults } from "../api.js";
import { profileRows, preferenceRows } from "../results/resultsUtils.js";
import { readStoredWinner } from "../game/gameUtils.js";

export default function PublicResultsPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = resultsTranslations[language];
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [hasCode] = useState(() => Boolean(readStoredWinner(sessionStorage)));

  useEffect(() => {
    let cancelled = false;
    getPublicResults().then((result) => {
      if (!cancelled) setData(result);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; };
  }, [revision]);

  function refresh() {
    setBusy(true); setError(false); setRevision((value) => value + 1);
  }
  const metadata = data ? `${text.currentStudy} · n=${data.summary.started}` : "";
  const chartProps = { text, metadata, toolsEnabled: false };
  return <Layout language={language} setLanguage={setLanguage} showAbout={false} showBraces={false}>
    <section className="results-page">
      <header className="results-header"><div>
        <p className="results-eyebrow">{text.publicEyebrow}</p>
        <h1>{text.publicTitle}</h1><p className="results-public-intro">{text.publicIntro}</p>
      </div></header>
      <div className="results-public-actions">
        <button type="button" onClick={() => navigate(hasCode ? "/conclusion" : "/")}>{hasCode ? text.backToCode : text.home}</button>
        <button type="button" disabled={busy} onClick={refresh}>{busy ? text.loading : text.refresh}</button>
      </div>
      <p className="results-caption">{text.publicScope}</p>
      {busy && <p role="status">{text.loading}</p>}
      {error && <p role="alert" className="results-error">{text.error}</p>}
      {data && <div aria-busy={busy}>
        <p className="results-caption">{text.updated}: {new Date(data.generatedAt).toLocaleString(language === "pt" ? "pt-PT" : "en-GB")}</p>
        <div className="results-summary">
          {[[text.started, data.summary.started], [text.completed, data.summary.completed],
            [text.unfinished, data.summary.unfinished], [text.completion, data.summary.started ? `${(data.summary.completed / data.summary.started * 100).toFixed(1)}%` : "—"]]
            .map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </div>
        {data.summary.started === 0 ? <p className="results-empty">{text.publicEmpty}</p> : <>
          <nav className="results-sections"><a href="#finals">{text.finals}</a><a href="#preferences">{text.preferences}</a><a href="#profile">{text.profile}</a></nav>
          <section id="finals"><h2>{text.finals}</h2><p className="results-caption">{text.finalNote}</p><div className="results-grid">
            {getCategoryOrder([...data.preferences, ...data.finals, ...data.skips]).map((category) => <ResultsChart key={category} title={text.categories[category]}
              rows={data.finals.filter((row) => row.category === category).map((row) => ({ label: row.style ? text.styles[row.style] || row.style : text.incomplete, value: row.total }))} {...chartProps} />)}
          </div></section>
          <section id="preferences"><h2>{text.preferences}</h2><p className="results-caption">{text.preferenceNote}</p><div className="results-grid">
            {getCategoryOrder([...data.preferences, ...data.finals, ...data.skips]).map((category) => <ResultsChart key={category} title={text.categories[category]}
              rows={preferenceRows(data.preferences.filter((row) => row.category === category), text.styles)} percent {...chartProps} />)}
            <ResultsChart title={text.skips} rows={data.skips.map((row) => ({ label: text.categories[row.category] || row.category,
              value: row.total ? row.skipped / row.total * 100 : null, total: row.total, skipped: row.skipped }))} percent {...chartProps} />
          </div><p className="results-caption">{text.skipNote}</p></section>
          <section id="profile"><h2>{text.profile}</h2><p className="results-caption">{text.profileNote}</p><div className="results-grid">
            {data.profile.map((question, index) => <ResultsChart key={index} title={question[`question_${language}`]}
              rows={profileRows(question, data.summary.started, text, language)} {...chartProps} />)}
          </div></section>
        </>}
      </div>}
    </section>
  </Layout>;
}
