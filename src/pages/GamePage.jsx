import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";

const codeQuestions = [
  {
    id: "q1",
    left: `for (let i = 0; i < numbers.length; i++) {
  console.log(numbers[i]);
}`,
    right: `numbers.forEach((number) => {
  console.log(number);
});`,
  },
  {
    id: "q2",
    left: `if (age >= 18) {
  canVote = true;
} else {
  canVote = false;
}`,
    right: `canVote = age >= 18;`,
  },
  {
    id: "q3",
    left: `const doubled = [];

for (const n of numbers) {
  doubled.push(n * 2);
}`,
    right: `const doubled = numbers.map(n => n * 2);`,
  },
  {
    id: "q4",
    left: `function sum(a, b) {
  return a + b;
}`,
    right: `const sum = (a, b) => a + b;`,
  },
  {
    id: "q5",
    left: `let total = 0;

for (const price of prices) {
  total += price;
}`,
    right: `const total = prices.reduce((acc, price) => acc + price, 0);`,
  },
  {
    id: "q6",
    left: `if (user) {
  name = user.name;
}`,
    right: `name = user?.name;`,
  },
  {
    id: "q7",
    left: `const activeUsers = [];

for (const user of users) {
  if (user.active) {
    activeUsers.push(user);
  }
}`,
    right: `const activeUsers = users.filter(user => user.active);`,
  },
  {
    id: "q8",
    left: `switch (status) {
  case "open":
    label = "Open";
    break;
  default:
    label = "Unknown";
}`,
    right: `label = status === "open" ? "Open" : "Unknown";`,
  },
  {
    id: "q9",
    left: `const person = {
  name: name,
  age: age
};`,
    right: `const person = {
  name,
  age
};`,
  },
  {
    id: "q10",
    left: `try {
  saveData(data);
} catch (error) {
  console.log(error);
}`,
    right: `saveData(data).catch(error => {
  console.log(error);
});`,
  },
];

const profileSteps = [
  {
    id: "profile-language",
    type: "profile",
    question: {
      pt: "Qual a tua linguagem de programação principal?",
      en: "What is your main programming language?",
    },
    options: ["Python", "JavaScript", "Java", "C#", "C++", "Outra"],
  },
  {
    id: "profile-experience",
    type: "profile",
    question: {
      pt: "Anos de experiência?",
      en: "Years of experience?",
    },
    options: {
      pt: ["<1 ano", "1-3 anos", "3-5 anos", "5+ anos"],
      en: ["<1 year", "1-3 years", "3-5 years", "5+ years"],
    },
  },
];

function buildFlow() {
  const codeSteps = codeQuestions.map((question, index) => ({
    type: "code",
    number: index + 1,
    ...question,
  }));

  const flow = [...codeSteps];

  // posições no meio para simular aparecimento "aleatório"
  const firstPosition = Math.floor(Math.random() * 3) + 2; // entre 2 e 4
  const secondPosition = Math.floor(Math.random() * 3) + 6; // entre 6 e 8

  flow.splice(firstPosition, 0, profileSteps[0]);
  flow.splice(secondPosition, 0, profileSteps[1]);

  return flow;
}

export default function GamePage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].game;

  const [flow] = useState(() => {
    const savedFlow = sessionStorage.getItem("gameFlow");

    if (savedFlow) {
      return JSON.parse(savedFlow);
    }

    const newFlow = buildFlow();
    sessionStorage.setItem("gameFlow", JSON.stringify(newFlow));
    return newFlow;
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    return Number(sessionStorage.getItem("currentIndex")) || 0;
  });

  const [answers, setAnswers] = useState(() => {
    const savedAnswers = sessionStorage.getItem("answers");
    return savedAnswers ? JSON.parse(savedAnswers) : [];
  });

  const currentStep = flow[currentIndex];
  const progress = ((currentIndex + 1) / flow.length) * 100;

  function goNext(answer) {
    const updatedAnswers = [
      ...answers,
      {
        stepId: currentStep.id,
        type: currentStep.type,
        answer,
      },
    ];

    setAnswers(updatedAnswers);
    sessionStorage.setItem("answers", JSON.stringify(updatedAnswers));

    if (currentIndex === flow.length - 1) {
      sessionStorage.removeItem("gameFlow");
      sessionStorage.removeItem("currentIndex");
      sessionStorage.removeItem("answers");

      navigate("/conclusion");
      return;
    }

    const nextIndex = currentIndex + 1;

    setCurrentIndex(nextIndex);
    sessionStorage.setItem("currentIndex", String(nextIndex));
  }

  return (
    <Layout language={language} setLanguage={setLanguage} bracesVariant="game">
      <section className="game-content">
        <h1
          className="main-title game-title clickable-logo"
          onClick={() => navigate("/")}
        >
          This or That
        </h1>

        <p className="game-progress">
          {currentStep.type === "code"
            ? `Par ${currentStep.number} de 10`
            : language === "pt"
            ? "Pergunta de perfil"
            : "Profile question"}
        </p>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {currentStep.type === "code" ? (
          <>
            <h2 className="game-question">{text.question}</h2>

            <div className="code-grid">
              <article className="code-area">
                <div className="code-label">CÓDIGO</div>
                <pre>{currentStep.left}</pre>
              </article>

              <article className="code-area">
                <div className="code-label">CÓDIGO</div>
                <pre>{currentStep.right}</pre>
              </article>
            </div>

            <div className="vote-grid">
              <button className="vote-button" onClick={() => goNext("left")}>
                {text.vote}
              </button>

              <button className="vote-button" onClick={() => goNext("right")}>
                {text.vote}
              </button>
            </div>

            <SmallNavButton
              className="skip-game-button"
              onClick={() => goNext("skipped")}
            >
              {text.skip}
            </SmallNavButton>
          </>
        ) : (
          <>
            <h2 className="game-question">
              {currentStep.question[language]}
            </h2>

            <article className="profile-card in-game-profile-card">
              <div className="options-grid in-game-options">
                {(Array.isArray(currentStep.options)
                  ? currentStep.options
                  : currentStep.options[language]
                ).map((option) => (
                  <button
                    key={option}
                    className="option-button"
                    onClick={() => goNext(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </article>
          </>
        )}

        <p className="bottom-note game-note">{text.note}</p>
      </section>
    </Layout>
  );
}