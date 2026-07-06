import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import GamePage from "./pages/GamePage.jsx";
import ConclusionPage from "./pages/ConclusionPage.jsx";

export default function App() {
  const [language, setLanguage] = useState("pt");

  return (
    <BrowserRouter basename="/~pg55999">
      <Routes>
        <Route path="/" element={<LandingPage language={language} setLanguage={setLanguage} />} />
        <Route path="/about" element={<AboutPage language={language} setLanguage={setLanguage} />} />
        <Route path="/game" element={<GamePage language={language} setLanguage={setLanguage} />} />
        <Route path="/conclusion" element={<ConclusionPage language={language} setLanguage={setLanguage} />} />
      </Routes>
    </BrowserRouter>
  );
}