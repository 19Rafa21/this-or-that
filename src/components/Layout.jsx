import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LanguageToggle from "./LanguageToggle.jsx";
import BackgroundBraces from "./BackgroundBraces.jsx";
import SmallNavButton from "./SmallNavButton.jsx";
import translations from "../i18n/translations.js";

export default function Layout({
  children,
  language,
  setLanguage,
  showAbout = true,
  showBraces = true,
  bracesVariant = "default",
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    const commonText = translations[language].common;
    document.documentElement.lang = language === "pt" ? "pt-PT" : "en";
    document.title = commonText.documentTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", commonText.documentDescription);
    localStorage.setItem("language", language);
  }, [language]);

  return (
    <main className={`app-page page-${bracesVariant}`} id="main-content">
      <LanguageToggle language={language} setLanguage={setLanguage} />

      {showAbout && (
        <SmallNavButton
          className="about-top-button"
          onClick={() => navigate("/about")}
        >
          {translations[language].common.about}
        </SmallNavButton>
      )}

      {showBraces && <BackgroundBraces variant={bracesVariant} />}

      {children}
    </main>
  );
}
