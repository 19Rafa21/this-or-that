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
      <div className="studio-brand">This or That<span aria-hidden="true">↗</span></div>
      <div className="landing-studio-grid">
        <div className="landing-story">
          <p className="studio-eyebrow"><span className="status-dot" />{text.eyebrow}</p>
          <h1>{text.headline}<br /><span>{text.headlineAccent}</span></h1>
          <p className="landing-intro">{text.description}</p>
          <PrimaryButton className="studio-start" onClick={() => navigate('/game')}>{text.startButton}<InterfaceIcon /></PrimaryButton>
          <p className="landing-reassurance">{text.reassurance}</p>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-star">✳</div>
          <div className="art-note">{text.artNote}<span>↘</span></div>
          <div className="art-editor">
            <div className="art-editor-bar"><span><i /><i /><i /></span><span>your-style.code</span><span>↗</span></div>
            <div className="art-code"><span className="art-comment">// {text.artComment}</span><br /><span className="art-keyword">function</span> <span className="art-function">yourStyle</span>() {'{'}<br />{'  '}<span className="art-keyword">const</span> choice = <span className="art-string">"you"</span>;<br /><br />{'  '}<span className="art-keyword">return</span> choice;<br />{'}'}</div>
            <div className="art-editor-bottom"><span className="status-dot" />{text.artFooter}<span>UTF-8</span></div>
          </div>
          <div className="art-choice"><span className="art-choice-brackets">{'{ }'}</span><span>{text.artChoice}<strong>{text.artChoiceValue}</strong></span><span className="art-choice-check"><InterfaceIcon name="check" /></span></div>
        </div>
      </div>
      <div className="landing-bottom"><span>{text.institution}</span><p><span>01</span> {text.stepOne}<i /> <span>02</span> {text.stepTwo}<i /> <span>03</span> {text.stepThree}</p></div>
    </section>
  </Layout>;
}
