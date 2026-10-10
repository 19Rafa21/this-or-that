import { useNavigate } from "react-router-dom";
import { getCategoryOrder } from "../game/categoryOrder.js";
import { useEffect, useRef, useState } from "react";
import DatasetManager from "../components/DatasetManager.jsx";
import Layout from "../components/Layout.jsx";
import ResultsChart from "../components/ResultsChart.jsx";
import resultsTranslations from "../i18n/resultsTranslations.js";
import { profileRows, preferenceRows, profileFilterLabels } from "../results/resultsUtils.js";
import { adminLogin, adminLogout, getStudyResults } from "../api.js";

export default function ResultsPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(null);
  const [data, setData] = useState(null);
  const text = { ...resultsTranslations[language], styles: { ...resultsTranslations[language].styles, ...Object.fromEntries(Object.entries(data?.styleLabels || {}).map(([id, names]) => [id, names[language]])) } };
  const [datasets, setDatasets] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", status: "all", datasetId: "", profile: {} });
  const requestNumber = useRef(0);

  useEffect(() => {
    if (!auth) return;
    const timer = setTimeout(() => {
      requestNumber.current++;
      setAuth(null); setData(null); setDatasets([]); setBusy(false); setError("expired");
    }, Math.max(0, auth.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [auth]);

  async function load(session, selectedFilters) {
    const request = ++requestNumber.current;
    setBusy(true); setError("");
    try {
      const result = await getStudyResults(session.token, selectedFilters);
      if (request === requestNumber.current) {
        setData(result); setDatasets(result.datasets);
        setFilters((previous) => ({ ...previous, datasetId: result.datasetId }));
      }
    } catch (err) {
      if (request !== requestNumber.current) return;
      if (err.status === 401) { setAuth(null); setData(null); setDatasets([]); setError("expired"); }
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
    setAuth(null); setData(null); setDatasets([]); setError(""); setBusy(false);
    setFilters({ from: "", to: "", status: "all", datasetId: "", profile: {} });
    try { await adminLogout(session.token); } catch { /* Local access is cleared; the server session expires automatically. */ }
  }

  function apply(event) {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) { setError("dateError"); return; }
    load(auth, filters);
  }

  const availableQuestions = datasets.find((dataset) => dataset.id === filters.datasetId)?.questions || [];
  const appliedProfile = data ? profileFilterLabels(data.profile, data.filters.profile, text, language) : [];
  function clearFilters() {
    const cleared = { from: "", to: "", status: "all", datasetId: filters.datasetId, profile: {} };
    setFilters(cleared);
    load(auth, cleared);
  }
  const metadata = data ? `${text.dataset} ${data.datasetVersion} · ${data.filters.from || "…"} — ${data.filters.to || "…"} UTC · ${data.filters.status === "complete" ? text.complete : text.all} · n=${data.summary.started}/${data.population}${appliedProfile.length ? ` · ${appliedProfile.join(" · ")}` : ""}` : "";
  return <Layout language={language} setLanguage={setLanguage} showAbout={false} showBraces={false}>
    <section className="results-page">
      <header className="results-header"><div><p className="results-eyebrow">{text.private}</p>
        <h1>{text.title}</h1><p>{text.intro}</p></div>
        <div className="results-admin-actions">
          <button type="button" onClick={() => navigate('/')}>{language === 'pt' ? 'Voltar ao jogo' : 'Back to game'}</button>
          {auth && <button type="button" onClick={logout}>{text.logout}</button>}
        </div>
      </header>
      {!auth ? <form className="results-login" onSubmit={login}>
        <h2>{text.loginTitle}</h2><p>{text.loginNote}</p>
        <label>{text.username}<input name="username" autoComplete="username" required maxLength={100} disabled={busy} /></label>
        <label>{text.password}<input name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} /></label>
        <button type="submit" disabled={busy}>{busy ? text.loading : text.login}</button>
      </form> : <>
        <DatasetManager token={auth.token} language={language} onActivated={(datasetId) => { const next = { from: "", to: "", status: "all", datasetId, profile: {} }; setFilters(next); load(auth, next); }} />
        <form className="results-filters" onSubmit={apply}>
          <label className="results-dataset-filter">{text.dataset}<select disabled={busy} value={filters.datasetId} onChange={(event) => setFilters({ ...filters, datasetId: event.target.value, profile: {} })}>
            {!datasets.length && <option value="">{text.defaultDataset}</option>}
            {datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>
              {dataset.version} · {dataset.sessions} {text.sessions}{dataset.active ? ` · ${text.currentDataset}` : ""}
            </option>)}
          </select></label>
          <label>{text.from}<input disabled={busy} type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label>{text.to}<input disabled={busy} type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <label>{text.status}<select disabled={busy} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="all">{text.all}</option><option value="complete">{text.complete}</option>
          </select></label>
          <fieldset className="results-profile-filters" disabled={busy}>
            <legend>{text.profileFilters}</legend>
            <p className="results-caption">{text.profileFilterNote}</p>
            <div className="results-profile-grid">
              {availableQuestions.map((question) => <label key={question.id}>{question[`question_${language}`]}
                <select value={filters.profile[question.id] || ""} onChange={(event) => {
                  const profile = { ...filters.profile };
                  if (event.target.value) profile[question.id] = event.target.value;
                  else delete profile[question.id];
                  setFilters({ ...filters, profile });
                }}>
                  <option value="">{text.allProfiles}</option>
                  {question.options.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}
                  <option value="skipped">{text.skipped}</option>
                  <option value="__missing__">{text.missing}</option>
                </select>
              </label>)}
              {!availableQuestions.some((question) => question.id.endsWith(":age-band")) && <label>{text.ageFilter}
                <select disabled value=""><option value="">{text.notCollected}</option></select>
              </label>}
            </div>
          </fieldset>
          <button type="submit" disabled={busy}>{busy ? text.loading : text.apply}</button>
          <button type="button" disabled={busy} onClick={clearFilters}>{text.clearFilters}</button>
        </form>
        <p className="results-caption">{text.scope}</p>
        <p className="results-caption">{text.datasetNote}</p>
      </>}
      {error && <p className="results-error" role="alert">{text[error]}</p>}
      {auth && data && <div aria-busy={busy}>
        <p className="results-caption">{metadata} · {text.updated}: {new Date(data.generatedAt).toLocaleString(language === "pt" ? "pt-PT" : "en-GB")}</p>
        <p className="results-match-count" role="status">{text.matchCount.replace("{matched}", data.summary.started).replace("{total}", data.population)}</p>
        <p className="results-caption">{text.populationNote}</p>
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
          {(data.categoryOrder || getCategoryOrder([...data.preferences, ...data.finals, ...data.skips])).map((category) => <ResultsChart key={category} title={text.categories[category]}
            rows={preferenceRows(data.preferences.filter((row) => row.category === category), text.styles)} text={text} percent metadata={metadata} />)}
        </div><h2>{text.finals}</h2><p className="results-caption">{text.finalNote}</p><div className="results-grid">
          {(data.categoryOrder || getCategoryOrder([...data.preferences, ...data.finals, ...data.skips])).map((category) => <ResultsChart key={category} title={`${text.finals} · ${text.categories[category]}`}
            rows={data.finals.filter((row) => row.category === category).map((row) => ({ label: row.style ? text.styles[row.style] || row.style : text.incomplete, value: row.total }))} text={text} metadata={metadata} />)}
        </div></section>
        <section id="profile"><h2>{text.profile}</h2><p className="results-caption">{text.profileNote} {data.profile.some((question) => question.id.endsWith(":age-band")) && text.ageNote}</p><div className="results-grid">
          {data.profile.map((question) => <ResultsChart key={question.id} title={question[`question_${language}`]}
            rows={profileRows(question, data.summary.started, text, language)} text={text} metadata={metadata} />)}
        </div></section>
      </div>}
    </section>
  </Layout>;
}
