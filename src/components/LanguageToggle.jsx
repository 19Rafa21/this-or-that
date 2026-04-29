export default function LanguageToggle({ language, setLanguage }) {
  return (
    <div className="language-toggle">
      <button
        className={language === "pt" ? "active" : ""}
        onClick={() => setLanguage("pt")}
        aria-label="Português"
      >
        🇵🇹
      </button>

      <button
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        aria-label="English"
      >
        🇬🇧
      </button>
    </div>
  );
}