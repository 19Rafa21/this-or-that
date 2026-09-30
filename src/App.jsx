import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import GamePage from "./pages/GamePage.jsx";
import ConclusionPage from "./pages/ConclusionPage.jsx";
import resultsTranslations from "./i18n/resultsTranslations.js";
const routerBasename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL;
const PublicResultsPage = lazy(() => import("./pages/PublicResultsPage.jsx"));
const ResultsPage = lazy(() => import("./pages/ResultsPage.jsx"));

export default function App() {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem("language");
    return savedLanguage === "en" ? "en" : "pt";
  });

  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<LandingPage language={language} setLanguage={setLanguage} />} />
        <Route path="/about" element={<AboutPage language={language} setLanguage={setLanguage} />} />
        <Route path="/game" element={<GamePage language={language} setLanguage={setLanguage} />} />
        <Route path="/conclusion" element={<ConclusionPage language={language} setLanguage={setLanguage} />} />
        <Route path="/resultados-gerais" element={<Suspense fallback={<p role="status">{resultsTranslations[language].loading}</p>}><PublicResultsPage language={language} setLanguage={setLanguage} /></Suspense>} />
        <Route path="/resultados" element={<Suspense fallback={<p role="status">{resultsTranslations[language].loading}</p>}><ResultsPage language={language} setLanguage={setLanguage} /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}
