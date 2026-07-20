import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";

import {
  createSession,
  getProfileQuestions,
  getSnippets,
  saveChoice,
  saveFinalResult,
  saveProfileAnswer,
} from "../api.js";

const CATEGORY_ORDER = [
  "variables",
  "constants",
  "arrays",
  "conditionals",
  "loops",
  "functions",
  "objects_classes",
  "input",
  "output",
  "errors",
];

const CODE_QUESTIONS_PER_GAME = CATEGORY_ORDER.length;
const PROFILE_QUESTIONS_PER_GAME = 4;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function groupSnippetsByCategory(snippets) {
  return snippets.reduce((acc, snippet) => {
    if (!acc[snippet.category]) {
      acc[snippet.category] = [];
    }

    acc[snippet.category].push(snippet);
    return acc;
  }, {});
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .replace(/\s+/g, " ");
}

function getUniqueSnippetsByCode(snippets) {
  const seenCodes = new Set();

  return snippets.filter((snippet) => {
    const normalizedCode = normalizeCode(snippet.code);

    if (seenCodes.has(normalizedCode)) {
      return false;
    }

    seenCodes.add(normalizedCode);
    return true;
  });
}

function buildCodeSteps(snippets) {
  const groupedSnippets = groupSnippetsByCategory(snippets);

  return CATEGORY_ORDER.map((category, index) => {
    const snippetsInCategory = groupedSnippets[category] || [];

    const uniqueSnippets = getUniqueSnippetsByCode(snippetsInCategory);

    if (uniqueSnippets.length < 2) {
      throw new Error(
        `A categoria "${category}" precisa de pelo menos 2 snippets diferentes.`
      );
    }

    const shuffled = shuffleArray(uniqueSnippets);

    const leftSnippet = shuffled[0];

    const rightSnippet = shuffled.find(
      (snippet) =>
        snippet.id !== leftSnippet.id &&
        snippet.language !== leftSnippet.language &&
        normalizeCode(snippet.code) !== normalizeCode(leftSnippet.code)
    );

    if (!rightSnippet) {
      throw new Error(
        `A categoria "${category}" precisa de snippets de pelo menos 2 linguagens diferentes.`
      );
    }

    return {
      id: `comparison-${category}`,
      type: "code",
      category,
      leftSnippet,
      rightSnippet,
      comparisonNumber: index + 1,
    };
  });
}

function insertProfileQuestionsIntoFlow(codeSteps, profileQuestions) {
  const flow = [...codeSteps];

  const selectedProfileQuestions = shuffleArray(profileQuestions).slice(
    0,
    PROFILE_QUESTIONS_PER_GAME
  );

  const possiblePositions = [];

  for (let i = 1; i < codeSteps.length; i++) {
    possiblePositions.push(i);
  }

  const selectedPositions = shuffleArray(possiblePositions)
    .slice(0, selectedProfileQuestions.length)
    .sort((a, b) => b - a);

  selectedProfileQuestions.forEach((question, index) => {
    const positionAfterCodeQuestion = selectedPositions[index];

    const insertIndex =
      flow.findIndex(
        (step) =>
          step.type === "code" &&
          step.comparisonNumber === positionAfterCodeQuestion
      ) + 1;

    flow.splice(insertIndex, 0, {
      ...question,
      type: "profile",
    });
  });

  return flow;
}

function buildFlow(snippets, profileQuestions) {
  const codeSteps = buildCodeSteps(snippets);

  if (codeSteps.length < CODE_QUESTIONS_PER_GAME) {
    throw new Error(
      `A BD só permite criar ${codeSteps.length} perguntas de código. São necessárias ${CODE_QUESTIONS_PER_GAME}.`
    );
  }

  return insertProfileQuestionsIntoFlow(codeSteps, profileQuestions);
}

function countPreviousCodeQuestions(flow, currentIndex) {
  return flow
    .slice(0, currentIndex + 1)
    .filter((step) => step.type === "code").length;
}

export default function GamePage({ language, setLanguage }) {
  const navigate = useNavigate();
  const text = translations[language].game;

  const [gameState, setGameState] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadGameData() {
      try {
        setIsLoading(true);

        const [snippetsFromApi, questionsFromApi, session] =
          await Promise.all([
            getSnippets(),
            getProfileQuestions(),
            createSession(),
          ]);

        const initialState = {
          flow: buildFlow(snippetsFromApi, questionsFromApi),
          currentIndex: 0,
          answers: [],
          profileAnswers: [],
          dreamCode: [],
        };

        setSessionId(session.sessionId);
        setGameState(initialState);

        sessionStorage.setItem("sessionId", session.sessionId);
        sessionStorage.setItem("gameState", JSON.stringify(initialState));
      } catch (err) {
        console.error(err);
        setError(err.message || "Não foi possível carregar o jogo.");
      } finally {
        setIsLoading(false);
      }
    }

    loadGameData();
  }, []);

  if (isLoading) {
    return (
      <Layout language={language} setLanguage={setLanguage} bracesVariant="game">
        <section className="game-content">
          <h1 className="main-title game-title">This or That</h1>
          <p className="bottom-note game-note">{text.loading || "A carregar jogo..."}</p>
        </section>
      </Layout>
    );
  }

  if (error || !gameState) {
    return (
      <Layout language={language} setLanguage={setLanguage} bracesVariant="game">
        <section className="game-content">
          <h1 className="main-title game-title">This or That</h1>
          <p className="bottom-note game-note">
            {error || text.error || "Erro ao iniciar o jogo."}
          </p>
        </section>
      </Layout>
    );
  }

  const currentStep = gameState.flow[gameState.currentIndex];

  const progress =
    ((gameState.currentIndex + 1) / gameState.flow.length) * 100;

  const questionList = text.questions || [
    text.question || "Qual destas opções preferes?",
  ];

  const dynamicQuestion =
    currentStep.type === "code"
      ? questionList[gameState.currentIndex % questionList.length]
      : language === "pt"
      ? currentStep.question_pt
      : currentStep.question_en;

  const currentCodeQuestionNumber =
    currentStep.type === "code"
      ? countPreviousCodeQuestions(gameState.flow, gameState.currentIndex)
      : null;

  function updateGameState(newState) {
    setGameState(newState);
    sessionStorage.setItem("gameState", JSON.stringify(newState));
  }

  async function finishGame(finalState) {
    const languageCounts = finalState.answers.reduce((acc, answer) => {
      const selectedLanguage = answer.selectedLanguage || "unknown";
      acc[selectedLanguage] = (acc[selectedLanguage] || 0) + 1;
      return acc;
    }, {});

    const topLanguage =
      Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "unknown";

    const finalWinner = {
      language: topLanguage,
      code: finalState.dreamCode.map((snippet) => snippet.code).join("\n\n"),
      snippets: finalState.dreamCode,
    };

    const finalResult = {
      winner: finalWinner,
      languageCounts,
      answers: finalState.answers,
      profileAnswers: finalState.profileAnswers,
      dreamCode: finalState.dreamCode,
    };

    try {
      await saveFinalResult({
        sessionId,
        result: finalResult,
      });
    } catch (err) {
      console.error("Erro ao guardar resultado final:", err);
    }

    sessionStorage.setItem("finalWinner", JSON.stringify(finalWinner));
    sessionStorage.setItem("finalAnswers", JSON.stringify(finalState.answers));
    sessionStorage.setItem(
      "profileAnswers",
      JSON.stringify(finalState.profileAnswers)
    );
    sessionStorage.setItem("dreamCode", JSON.stringify(finalState.dreamCode));

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

  async function handleCodeChoice(choice) {
    const selectedSnippet =
      choice === "left" ? currentStep.leftSnippet : currentStep.rightSnippet;

    const answer = {
      comparisonId: currentStep.id,
      category: currentStep.category,
      leftSnippetId: currentStep.leftSnippet.id,
      rightSnippetId: currentStep.rightSnippet.id,
      selectedSide: choice,
      selectedSnippetId: selectedSnippet.id,
      selectedLanguage: selectedSnippet.language,
      selectedCode: selectedSnippet.code,
      timestamp: new Date().toISOString(),
    };

    const updatedState = {
      ...gameState,
      answers: [...gameState.answers, answer],
      dreamCode: [...gameState.dreamCode, selectedSnippet],
    };

    try {
      await saveChoice({
        sessionId,
        roundNumber: currentStep.comparisonNumber,
        category: currentStep.category,
        leftSnippetId: currentStep.leftSnippet.id,
        rightSnippetId: currentStep.rightSnippet.id,
        selectedSnippetId: selectedSnippet.id,
        selectedLanguage: selectedSnippet.language,
      });
    } catch (err) {
      console.error("Erro ao guardar escolha:", err);
    }

    goToNextStep(updatedState);
  }

  async function handleProfileAnswer(answer) {
    const profileAnswer = {
      questionId: currentStep.id,
      question:
        language === "pt" ? currentStep.question_pt : currentStep.question_en,
      answer,
      timestamp: new Date().toISOString(),
    };

    const updatedState = {
      ...gameState,
      profileAnswers: [...gameState.profileAnswers, profileAnswer],
    };

    try {
      await saveProfileAnswer({
        sessionId,
        questionId: currentStep.id,
        answer,
      });
    } catch (err) {
      console.error("Erro ao guardar resposta de perfil:", err);
    }

    goToNextStep(updatedState);
  }

  async function handleSkip() {
    if (currentStep.type === "code") {
      const answer = {
        comparisonId: currentStep.id,
        category: currentStep.category,
        leftSnippetId: currentStep.leftSnippet.id,
        rightSnippetId: currentStep.rightSnippet.id,
        selectedSide: "skipped",
        selectedSnippetId: "skipped",
        selectedLanguage: "skipped",
        selectedCode: "",
        timestamp: new Date().toISOString(),
      };

      const updatedState = {
        ...gameState,
        answers: [...gameState.answers, answer],
      };

      try {
        await saveChoice({
          sessionId,
          roundNumber: currentStep.comparisonNumber,
          category: currentStep.category,
          leftSnippetId: currentStep.leftSnippet.id,
          rightSnippetId: currentStep.rightSnippet.id,
          selectedSnippetId: "skipped",
          selectedLanguage: "skipped",
        });
      } catch (err) {
        console.error("Erro ao guardar skip:", err);
      }

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
                aria-label={
                  language === "pt"
                    ? "Escolher código da esquerda"
                    : "Choose left code"
                }
              >
                <SyntaxHighlighter
                  language={currentStep.leftSnippet.language || "javascript"}
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
                  {currentStep.leftSnippet.code}
                </SyntaxHighlighter>
              </button>

              <button
                type="button"
                className="code-area clickable-code-area"
                onClick={() => handleCodeChoice("right")}
                aria-label={
                  language === "pt"
                    ? "Escolher código da direita"
                    : "Choose right code"
                }
              >
                <SyntaxHighlighter
                  language={currentStep.rightSnippet.language || "javascript"}
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
                  {currentStep.rightSnippet.code}
                </SyntaxHighlighter>
              </button>
            </div>

            <div className="game-bottom-area">
              <p className="game-progress">
                {`Par ${currentCodeQuestionNumber} de ${CODE_QUESTIONS_PER_GAME}`}
              </p>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
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
            <h2 className="game-question">{dynamicQuestion}</h2>

            <article className="profile-card in-game-profile-card">
              <div className="options-grid in-game-options">
                {currentStep.options.map((option) => (
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