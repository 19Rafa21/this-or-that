import { useNavigate } from "react-router-dom";
import LanguageToggle from "./LanguageToggle.jsx";
import BackgroundBraces from "./BackgroundBraces.jsx";
import SmallNavButton from "./SmallNavButton.jsx";
import translations from "../i18n/translations.js";

export default function Layout({
  children,
  language,
  setLanguage,
  showAbout = true,
  bracesVariant = "default",
}) {
  const navigate = useNavigate();

  return (
    <main className="app-page">
      <LanguageToggle language={language} setLanguage={setLanguage} />

      {showAbout && (
        <SmallNavButton
          className="about-top-button"
          onClick={() => navigate("/about")}
        >
          {translations[language].common.about}
        </SmallNavButton>
      )}

      <BackgroundBraces variant={bracesVariant} />

      {children}
    </main>
  );
}