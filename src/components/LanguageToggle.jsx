import translations from "../i18n/translations.js";

export default function LanguageToggle({ language, setLanguage }) {
  const labels = translations[language].common.languages;

  return (
    <div
      className="language-toggle"
      role="group"
      aria-label={translations[language].common.languageSelector}
    >
      <button
        type="button"
        className={language === "pt" ? "active" : ""}
        onClick={() => setLanguage("pt")}
        aria-label={labels.pt}
        title={labels.pt}
        aria-pressed={language === "pt"}
      >
        PT
      </button>

      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        aria-label={labels.en}
        title={labels.en}
        aria-pressed={language === "en"}
      >
        EN
      </button>
    </div>
  );
}
