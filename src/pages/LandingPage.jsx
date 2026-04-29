import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PrimaryButton from "../components/PrimaryButton.jsx";
import translations from "../i18n/translations.js";

export default function LandingPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].landing;

  return (
    <Layout language={language} setLanguage={setLanguage} bracesVariant="landing">
      <section className="landing-content">
        <h1 className="main-title landing-title">{text.title}</h1>

        <div className="landing-text">
          <p>{text.description1}</p>
          <p>{text.description2}</p>
        </div>

        <PrimaryButton onClick={() => navigate("/game")}>
          {text.startButton}
        </PrimaryButton>
      </section>
    </Layout>
  );
}