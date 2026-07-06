import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";

const snippets = [
  {
    id: "s1",
    code: `for (let i = 0; i < numbers.length; i++) {
  console.log(numbers[i]);
}`,
  },
  {
    id: "s2",
    code: `numbers.forEach((number) => {
  console.log(number);
});`,
  },
  {
    id: "s3",
    code: `for (const number of numbers) {
  console.log(number);
}`,
  },
  {
    id: "s4",
    code: `let i = 0;

while (i < numbers.length) {
  console.log(numbers[i]);
  i++;
}`,
  },
  {
    id: "s5",
    code: `numbers.map((number) => {
  console.log(number);
});`,
  },
  {
    id: "s6",
    code: `function printNumbers(numbers) {
  numbers.forEach(function(number) {
    console.log(number);
  });
}`,
  },
  {
    id: "s7",
    code: `const printNumber = (number) => console.log(number);

numbers.forEach(printNumber);`,
  },
  {
    id: "s8",
    code: `for (let index in numbers) {
  console.log(numbers[index]);
}`,
  },
  {
    id: "s9",
    code: `numbers.reduce((_, number) => {
  console.log(number);
  return null;
}, null);`,
  },
  {
    id: "s10",
    code: `[...numbers].forEach(number => console.log(number));`,
  },
  {
    id: "s11",
    code: `for (const [index, number] of numbers.entries()) {
  console.log(number);
}`,
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
  const comparisons = [];

  for (let i = 1; i < snippets.length; i++) {
    comparisons.push({
      id: `comparison-${i}`,
      type: "code",
      challenger: snippets[i],
      comparisonNumber: i,
    });
  }

  const flow = [...comparisons];

  const firstProfilePosition = Math.floor(Math.random() * 3) + 2; // entre 2 e 4
  const secondProfilePosition = Math.floor(Math.random() * 3) + 6; // entre 6 e 8

  flow.splice(firstProfilePosition, 0, profileSteps[0]);
  flow.splice(secondProfilePosition, 0, profileSteps[1]);

  return flow;
}

function getInitialGameState() {
  const savedState = sessionStorage.getItem("gameState");

  if (savedState) {
    return JSON.parse(savedState);
  }

  const initialState = {
    flow: buildFlow(),
    currentIndex: 0,
    currentWinner: snippets[0],
    answers: [],
    profileAnswers: [],
  };

  sessionStorage.setItem("gameState", JSON.stringify(initialState));

  return initialState;
}

export default function GamePage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].game;

  const [gameState, setGameState] = useState(getInitialGameState);

  const currentStep = gameState.flow[gameState.currentIndex];
  const totalCodeComparisons = snippets.length - 1;

  const progress =
    ((gameState.currentIndex + 1) / gameState.flow.length) * 100;

  const dynamicQuestion =
    currentStep.type === "code"
      ? text.questions[gameState.currentIndex % text.questions.length]
      : currentStep.question[language];
  function updateGameState(newState) {
    setGameState(newState);
    sessionStorage.setItem("gameState", JSON.stringify(newState));
  }

  function finishGame(finalState) {
    sessionStorage.setItem("finalWinner", JSON.stringify(finalState.currentWinner));
    sessionStorage.setItem("finalAnswers", JSON.stringify(finalState.answers));
    sessionStorage.setItem(
      "profileAnswers",
      JSON.stringify(finalState.profileAnswers)
    );

    sessionStorage.removeItem("gameState");

    navigate("/conclusion");
  }

  function goToNextStep(newState) {
    if (newState.currentIndex === newState.flow.length - 1) {
      finishGame(newState);
      return;
    }

    updateGameState({
      ...newState,
      currentIndex: newState.currentIndex + 1,
    });
  }

  function handleCodeChoice(choice) {
    const selectedSnippet =
      choice === "left" ? gameState.currentWinner : currentStep.challenger;

    const updatedState = {
      ...gameState,
      currentWinner: selectedSnippet,
      answers: [
        ...gameState.answers,
        {
          comparisonId: currentStep.id,
          winnerIdBeforeChoice: gameState.currentWinner.id,
          challengerId: currentStep.challenger.id,
          selectedSide: choice,
          selectedSnippetId: selectedSnippet.id,
          selectedCode: selectedSnippet.code,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    goToNextStep(updatedState);
  }

  function handleProfileAnswer(answer) {
    const updatedState = {
      ...gameState,
      profileAnswers: [
        ...gameState.profileAnswers,
        {
          questionId: currentStep.id,
          answer,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    goToNextStep(updatedState);
  }

  function handleSkip() {
    if (currentStep.type === "code") {
      const updatedState = {
        ...gameState,
        answers: [
          ...gameState.answers,
          {
            comparisonId: currentStep.id,
            winnerIdBeforeChoice: gameState.currentWinner.id,
            challengerId: currentStep.challenger.id,
            selectedSide: "skipped",
            selectedSnippetId: gameState.currentWinner.id,
            selectedCode: gameState.currentWinner.code,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      goToNextStep(updatedState);
      return;
    }

    handleProfileAnswer("skipped");
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

        {currentStep.type === "code" ? (
        <>
          <h2 className="game-question">{dynamicQuestion}</h2>

          <div className="code-grid">
            <button
              type="button"
              className="code-area clickable-code-area"
              onClick={() => handleCodeChoice("left")}
              aria-label={language === "pt" ? "Escolher código da esquerda" : "Choose left code"}
            >
              <SyntaxHighlighter
                language={gameState.currentWinner.language || "javascript"}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: "transparent",
                  fontSize: "0.92rem",
                  lineHeight: "1.5",
                }}
                codeTagProps={{
                  style: {
                    fontFamily: '"Courier New", monospace',
                  },
                }}
              >
                {gameState.currentWinner.code}
              </SyntaxHighlighter>
            </button>

            <button
              type="button"
              className="code-area clickable-code-area"
              onClick={() => handleCodeChoice("right")}
              aria-label={language === "pt" ? "Escolher código da direita" : "Choose right code"}
            >
              <SyntaxHighlighter
                language={currentStep.challenger.language || "javascript"}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: "transparent",
                  fontSize: "0.92rem",
                  lineHeight: "1.5",
                }}
                codeTagProps={{
                  style: {
                    fontFamily: '"Courier New", monospace',
                  },
                }}
              >
                {currentStep.challenger.code}
              </SyntaxHighlighter>
            </button>
          </div>

          <div className="game-bottom-area">
            <p className="game-progress">
              {`Par ${currentStep.comparisonNumber} de ${totalCodeComparisons}`}
            </p>

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <SmallNavButton
              className="skip-game-button"
              onClick={handleSkip}
            >
              {text.skip}
            </SmallNavButton>
          </div>
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
                    onClick={() => handleProfileAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </article>

            <SmallNavButton
              className="skip-game-button"
              onClick={handleSkip}
            >
              {text.skip}
            </SmallNavButton>
          </>
        )}

        <p className="bottom-note game-note">{text.note}</p>
      </section>
    </Layout>
  );
}