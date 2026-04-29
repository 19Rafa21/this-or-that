import { useNavigate } from "react-router-dom";
import PrimaryButton from "./PrimaryButton";
import translations from "../i18n/translations";

export default function LandingHero({ language }) {
  const navigate = useNavigate();
  const text = translations[language].landing;

  return (
    <section className="landing-hero">
      <h1>{text.title}</h1>

      <p>{text.description1}</p>
      <p>{text.description2}</p>

      <PrimaryButton onClick={() => navigate("/profile")}>
        {text.startButton}
      </PrimaryButton>
    </section>
  );
}