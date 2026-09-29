import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout.jsx";
import ResultsChart from "../components/ResultsChart.jsx";
import resultsTranslations from "../i18n/resultsTranslations.js";
import { profileRows, preferenceRows } from "../results/resultsUtils.js";
import { adminLogin, adminLogout, getStudyResults } from "../api.js";

export default function ResultsPage({ language, setLanguage }) {
  const text = resultsTranslations[language];
  const [auth, setAuth] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", status: "all" });
  const requestNumber = useRef(0);

  useEffect(() => {
    if (!auth) return;
    const timer = setTimeout(() => {
      requestNumber.current++;
      setAuth(null); setData(null); setBusy(false); setError("expired");
    }, Math.max(0, auth.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [auth]);

  async function load(session, selectedFilters) {
    const request = ++requestNumber.current;
    setBusy(true); setError("");
    try {
      const result = await getStudyResults(session.token, selectedFilters);
      if (request === requestNumber.current) setData(result);
    } catch (err) {
      if (request !== requestNumber.current) return;
      if (err.status === 401) { setAuth(null); setData(null); setError("expired"); }
      else { setData(null); setError("error"); }
    } finally { if (request === requestNumber.current) setBusy(false); }
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const credentials = new FormData(form);
    setBusy(true); setError("");
    try {
      const session = await adminLogin(credentials.get("username"), credentials.get("password"));
      form.reset(); setAuth(session);
      await load(session, filters);
    } catch (err) {
      form.elements.password.value = "";
      setError(err.status === 401 ? "invalid" : err.status === 429 ? "limited" : err.status === 503 ? "unconfigured" : "error");
    } finally { setBusy(false); }
  }

  async function logout() {
    const session = auth;
    requestNumber.current++;
    setAuth(null); setData(null); setError(""); setBusy(false);
    try { await adminLogout(session.token); } catch { /* Local access is cleared; the server session expires automatically. */ }
  }

  function apply(event) {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) { setError("dateError"); return; }
    load(auth, filters);
  }

  const metadata = data ? `${text.dataset} ${data.datasetVersion} · ${data.filters.from || "…"} — ${data.filters.to || "…"} UTC · ${data.filters.status === "complete" ? text.complete : text.all} · n=${data.summary.started}` : "";
  return <Layout language={language} setLanguage={setLanguage} showAbout={false}>
    <section className="results-page">
      <header className="results-header"><div><p className="results-eyebrow">{text.private}</p>
        <h1>{text.title}</h1><p>{text.intro}</p></div>
        {auth && <button type="button" onClick={logout}>{text.logout}</button>}
      </header>
      {!auth ? <form className="results-login" onSubmit={login}>
        <h2>{text.loginTitle}</h2><p>{text.loginNote}</p>
        <label>{text.username}<input name="username" autoComplete="username" required maxLength={100} disabled={busy} /></label>
        <label>{text.password}<input name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} /></label>
        <button type="submit" disabled={busy}>{busy ? text.loading : text.login}</button>
      </form> : <>
        <form className="results-filters" onSubmit={apply}>
          <label>{text.from}<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label>{text.to}<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <label>{text.status}<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="all">{text.all}</option><option value="complete">{text.complete}</option>
          </select></label>
          <button type="submit" disabled={busy}>{busy ? text.loading : text.apply}</button>
        </form>
        <p className="results-caption">{text.scope}</p>
      </>}
      {error && <p className="results-error" role="alert">{text[error]}</p>}
      {auth && data && <div aria-busy={busy}>
        <p className="results-caption">{metadata} · {text.updated}: {new Date(data.generatedAt).toLocaleString(language === "pt" ? "pt-PT" : "en-GB")}</p>
        <div className="results-summary">
          {[ [text.started, data.summary.started], [text.completed, data.summary.completed],
            [text.unfinished, data.summary.unfinished], [text.completion, data.summary.started ? `${(data.summary.completed / data.summary.started * 100).toFixed(1)}%` : "—"]
          ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </div>
        {data.summary.started === 0 && <p className="results-empty">{text.empty}</p>}
        <nav className="results-sections"><a href="#participation">{text.overview}</a><a href="#preferences">{text.preferences}</a><a href="#profile">{text.profile}</a></nav>
        <section id="participation"><h2>{text.overview}</h2><div className="results-grid">
          <ResultsChart title={text.overview} rows={[{ label: text.completed, value: data.summary.completed }, { label: text.unfinished, value: data.summary.unfinished }]} text={text} metadata={metadata} />
          <ResultsChart title={text.skips} rows={data.skips.map((row) => ({ label: text.categories[row.category] || row.category,
            value: row.total ? row.skipped / row.total * 100 : null, total: row.total, skipped: row.skipped }))} text={text} percent metadata={metadata} />
        </div><p className="results-caption">{text.skipNote}</p></section>
        <section id="preferences"><h2>{text.preferences}</h2><p className="results-caption">{text.preferenceNote}</p><div className="results-grid">
          {Object.keys(text.categories).map((category) => <ResultsChart key={category} title={text.categories[category]}
            rows={preferenceRows(data.preferences.filter((row) => row.category === category), text.styles)} text={text} percent metadata={metadata} />)}
        </div><h2>{text.finals}</h2><p className="results-caption">{text.finalNote}</p><div className="results-grid">
          {Object.keys(text.categories).map((category) => <ResultsChart key={category} title={`${text.finals} · ${text.categories[category]}`}
            rows={data.finals.filter((row) => row.category === category).map((row) => ({ label: row.style ? text.styles[row.style] || row.style : text.incomplete, value: row.total }))} text={text} metadata={metadata} />)}
        </div></section>
        <section id="profile"><h2>{text.profile}</h2><p className="results-caption">{text.profileNote} {text.ageNote}</p><div className="results-grid">
          {data.profile.map((question) => <ResultsChart key={question.id} title={question[`question_${language}`]}
            rows={profileRows(question, data.summary.started, text, language)} text={text} metadata={metadata} />)}
        </div></section>
      </div>}
    </section>
  </Layout>;
}
