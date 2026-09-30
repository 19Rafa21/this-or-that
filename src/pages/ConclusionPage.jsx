import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PrimaryButton from "../components/PrimaryButton.jsx";
import translations from "../i18n/translations.js";
import { readStoredWinner } from "../game/gameUtils.js";

export default function ConclusionPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].conclusion;
  const [shareStatus, setShareStatus] = useState("");

  const finalWinner = useMemo(() => {
    return readStoredWinner(sessionStorage);
  }, []);

  async function handleShare() {
    const shareUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;

    try {
      if (navigator.share) {
        await navigator.share({ title: text.shareTitle, text: text.shareText, url: shareUrl });
        setShareStatus(text.shared);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus(text.copied);
      }
    } catch (error) {
      if (error?.name !== "AbortError") setShareStatus(text.shareError);
    }
  }

  function handleRestart() {
    sessionStorage.removeItem("finalWinner");
    sessionStorage.removeItem("finalAnswers");
    sessionStorage.removeItem("profileAnswers");
    sessionStorage.removeItem("gameState");
    sessionStorage.removeItem("sessionId");
    sessionStorage.removeItem("dreamCode");

    navigate("/");
  }

  return (
    <Layout
      language={language}
      setLanguage={setLanguage}
      showAbout={false}
      bracesVariant="conclusion"
    >
      <button
        type="button"
        className="mini-logo logo-button"
        onClick={() => navigate("/")}
        aria-label={translations[language].common.goHome}
      >
        {translations[language].common.brand}
      </button>

      <section className="conclusion-content">
        <div className="trophy-shape" aria-hidden="true">🏆</div>

        <h1 className="main-title conclusion-title">{text.title}</h1>
        <h2 className="conclusion-subtitle">{text.subtitle}</h2>

        <article className="conclusion-card conclusion-card-large">
          <p>{text.result1}</p>
          <p>{text.experimentalNote}</p>
          {finalWinner?.hasSkippedComparisons && <p role="status">{text.skippedNote}</p>}

          <h3 className="final-code-title">
            {text.finalCodeTitle}
          </h3>

          <div className="final-code-block">
            {finalWinner ? (
              <pre className="comparison-code"><code>{finalWinner.code}</code></pre>
            ) : (
              <pre>
                {text.noWinnerCode}
              </pre>
            )}
          </div>
        </article>

        <div className="conclusion-actions">
          {finalWinner && <PrimaryButton className="general-results-button" onClick={() => navigate("/resultados-gerais")}>{text.generalResults}</PrimaryButton>}
          <PrimaryButton onClick={handleShare}>{text.share}</PrimaryButton>

          <p className="share-status" role="status" aria-live="polite">
            {shareStatus}
          </p>

          <button className="restart-button" onClick={handleRestart}>
            {text.restart}
          </button>
        </div>
      </section>
    </Layout>
  );
}
