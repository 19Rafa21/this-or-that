import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PrimaryButton from "../components/PrimaryButton.jsx";
import InterfaceIcon from "../components/InterfaceIcon.jsx";
import translations from "../i18n/translations.js";

export default function LandingPage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].landing;
  return <Layout language={language} setLanguage={setLanguage} showBraces={false} bracesVariant="landing">
    <section className="landing-studio">
      <header className="landing-heading"><h1>This or That</h1><p>{text.eyebrow}</p></header>
      <div className="landing-studio-grid">
        <div className="landing-story">
          <h2>{text.headline}</h2>
          <p className="landing-intro">{text.description}</p>
          <PrimaryButton className="studio-start" onClick={() => navigate('/game')}>{text.startButton}<InterfaceIcon /></PrimaryButton>
          <p className="landing-reassurance">{text.reassurance}</p>
        </div>
        <figure className="landing-example">
          <figcaption>{text.exampleTitle}</figcaption>
          <div className="landing-example-pair"><pre><code><span>int</span> total = 0;</code></pre><span className="example-or">{text.exampleOr}</span><pre><code>total = 0</code></pre></div>
          <p>{text.exampleNote}</p>
        </figure>
      </div>
      <footer className="landing-bottom"><span>Rafael Alves · {text.institution}</span><button type="button" onClick={() => navigate('/about')}>{text.aboutLink}</button></footer>
    </section>
  </Layout>;
}
