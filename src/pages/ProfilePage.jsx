import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";

export default function ProfilePage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].profile;

  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedExperience, setSelectedExperience] = useState("");

  return (
    <Layout language={language} setLanguage={setLanguage} bracesVariant="profile">
      <section className="profile-content">
        <h1 className="main-title profile-title">{text.title}</h1>
        <h2 className="profile-subtitle">{text.subtitle}</h2>

        <article className="profile-card">
          <h3>{text.languageQuestion}</h3>
          <div className="options-grid language-options">
            {text.languages.map((item) => (
              <button key={item} className={`option-button ${selectedLanguage === item ? "selected" : ""}`} onClick={() => setSelectedLanguage(item)}>
                {item}
              </button>
            ))}
          </div>
        </article>

        <article className="profile-card">
          <h3>{text.experienceQuestion}</h3>
          <div className="options-grid experience-options">
            {text.experience.map((item) => (
              <button key={item} className={`option-button ${selectedExperience === item ? "selected" : ""}`} onClick={() => setSelectedExperience(item)}>
                {item}
              </button>
            ))}
          </div>
        </article>

        <SmallNavButton onClick={() => navigate("/game")}>{text.nextButton}</SmallNavButton>
        <p className="bottom-note">{text.note}</p>
      </section>
    </Layout>
  );
}
