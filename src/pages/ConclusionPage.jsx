import Layout from "../components/Layout.jsx";
import PrimaryButton from "../components/PrimaryButton.jsx";
import translations from "../i18n/translations.js";
import { useNavigate } from "react-router-dom";

export default function ConclusionPage({ language, setLanguage }) {
  const text = translations[language].conclusion;
  const navigate = useNavigate();

  function handleShare() {
    navigator.clipboard.writeText(window.location.origin);
    alert(text.copied);
  }

  return (
    <Layout language={language} setLanguage={setLanguage} showAbout={false} bracesVariant="conclusion">
      <div
        className="mini-logo"
        onClick={() => navigate("/")}
      >
        This or That
      </div>
      <section className="conclusion-content">
        <div className="trophy-shape">🏆</div>

        <h1
        className="main-title conclusion-title clickable-logo"
        onClick={() => navigate("/")}
      >
        {text.title}
      </h1>
        <h2 className="conclusion-subtitle">{text.subtitle}</h2>

        <article className="conclusion-card">
          <p>{text.result1}</p>
          <p>{text.result2}</p>
        </article>

        <PrimaryButton onClick={handleShare}>{text.share}</PrimaryButton>
      </section>
    </Layout>
  );
}
