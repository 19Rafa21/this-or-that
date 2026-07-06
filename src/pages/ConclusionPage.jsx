import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PrimaryButton from "../components/PrimaryButton.jsx";
import translations from "../i18n/translations.js";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ConclusionPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].conclusion;

  const finalWinner = useMemo(() => {
    const savedWinner = sessionStorage.getItem("finalWinner");

    if (!savedWinner) {
      return null;
    }

    return JSON.parse(savedWinner);
  }, []);

  function handleShare() {
    navigator.clipboard.writeText(window.location.origin);
    alert(language === "pt" ? "Link copiado!" : "Link copied!");
  }

  function handleRestart() {
    sessionStorage.removeItem("finalWinner");
    sessionStorage.removeItem("finalAnswers");
    sessionStorage.removeItem("profileAnswers");
    sessionStorage.removeItem("gameState");

    navigate("/");
  }

  return (
    <Layout
      language={language}
      setLanguage={setLanguage}
      showAbout={false}
      bracesVariant="conclusion"
    >
      <div className="mini-logo" onClick={() => navigate("/")}>
        This or That
      </div>

      <section className="conclusion-content">
        <div className="trophy-shape">🏆</div>

        <h1 className="main-title conclusion-title">{text.title}</h1>
        <h2 className="conclusion-subtitle">{text.subtitle}</h2>

        <article className="conclusion-card conclusion-card-large">
          <p>{text.result1}</p>

          <h3 className="final-code-title">
            {text.finalCodeTitle}
          </h3>

          <div className="final-code-block">
            {finalWinner ? (
              <SyntaxHighlighter
                language={finalWinner.language || "javascript"}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: "transparent",
                  fontSize: "0.86rem",
                  lineHeight: "1.45",
                }}
                codeTagProps={{
                  style: {
                    fontFamily: '"Courier New", monospace',
                  },
                }}
              >
                {finalWinner.code}
              </SyntaxHighlighter>
            ) : (
              <pre>
                {language === "pt"
                  ? "// Ainda não existe um código vencedor."
                  : "// There is no winning code yet."}
              </pre>
            )}
          </div>
        </article>

        <div className="conclusion-actions">
          <PrimaryButton onClick={handleShare}>{text.share}</PrimaryButton>

          <button className="restart-button" onClick={handleRestart}>
            {language === "pt" ? "RECOMEÇAR" : "RESTART"}
          </button>
        </div>
      </section>
    </Layout>
  );
}