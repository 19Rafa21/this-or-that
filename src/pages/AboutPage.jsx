import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";

export default function AboutPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].about;

  return (
    <Layout
      language={language}
      setLanguage={setLanguage}
      showAbout={false}
      bracesVariant="about"
    >
      <section className="about-content">
        <button
          type="button"
          className="main-title about-title clickable-logo logo-button"
          onClick={() => navigate("/")}
          aria-label={translations[language].common.goHome}
        >
          {text.title}
        </button>
        <article className="info-card">
          <h2>{text.objectiveTitle}</h2>
          <p>{text.objective1}</p>
          <p>{text.objective2}</p>
        </article>

        <article className="info-card">
          <h2>{text.privacyTitle}</h2>
          <p>{text.privacy1}</p>
          <p>{text.privacy2}</p>
          <p>{text.privacy3}</p>
        </article>

        <article className="info-card team-card">
          <h2>{text.teamTitle}</h2>
          <p>{text.author}</p>
          <p>{text.supervisors}</p>
          <p>{text.institution}</p>
        </article>

        <SmallNavButton
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
        >
          {translations[language].common.back}
        </SmallNavButton>
      </section>
    </Layout>
  );
}
