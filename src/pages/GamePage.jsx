import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";
import {
  getWinningLanguage,
  readStoredGame,
  SKIPPED_VALUE,
} from "../game/gameUtils.js";

import {
  createSession,
  getComparisons,
  getProfileQuestions,
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
const PROFILE_QUESTIONS_PER_GAME = 5;
let pendingGameInitialization = null;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function buildCodeSteps(comparisons) {
  const comparisonsByCategory = comparisons.reduce((acc, comparison) => {
    if (!acc[comparison.category]) acc[comparison.category] = [];
    acc[comparison.category].push(comparison);
    return acc;
  }, {});

  const languageExposure = {};

  return CATEGORY_ORDER.map((category, index) => {
    const availableComparisons = comparisonsByCategory[category] || [];
    const comparison = shuffleArray(availableComparisons).sort((a, b) => {
      const scoreA =
        (languageExposure[a.snippet_a.language] || 0) +
        (languageExposure[a.snippet_b.language] || 0);
      const scoreB =
        (languageExposure[b.snippet_a.language] || 0) +
        (languageExposure[b.snippet_b.language] || 0);
      return scoreA - scoreB;
    })[0];

    if (!comparison) throw new Error(`missing-comparison-${category}`);

    languageExposure[comparison.snippet_a.language] =
      (languageExposure[comparison.snippet_a.language] || 0) + 1;
    languageExposure[comparison.snippet_b.language] =
      (languageExposure[comparison.snippet_b.language] || 0) + 1;

    const reverseSides = Math.random() < 0.5;
    const leftSnippet = reverseSides
      ? comparison.snippet_b
      : comparison.snippet_a;
    const rightSnippet = reverseSides
      ? comparison.snippet_a
      : comparison.snippet_b;

    return {
      id: comparison.id,
      type: "code",
      category,
      datasetId: comparison.dataset_id,
      leftSnippet,
      rightSnippet,
      comparisonNumber: index + 1,
    };
  });
}

function insertProfileQuestionsIntoFlow(codeSteps, profileQuestions) {
  const flow = [...codeSteps];

  const selectedProfileQuestions = profileQuestions.slice(
    0,
    PROFILE_QUESTIONS_PER_GAME
  );

  selectedProfileQuestions.forEach((question, index) => {
    const positionAfterCodeQuestion = Math.min(
      (index + 1) * 2,
      codeSteps.length - 1
    );

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

function buildFlow(comparisons, profileQuestions) {
  const codeSteps = buildCodeSteps(comparisons);

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    async function loadGameData() {
      try {
        setIsLoading(true);

        const storedGame = readStoredGame(sessionStorage);
        if (storedGame) {
          setSessionId(storedGame.sessionId);
          setGameState(storedGame.gameState);
          return;
        }

        if (!pendingGameInitialization) {
          pendingGameInitialization = Promise.all([
            getComparisons(),
            getProfileQuestions(),
            createSession(language),
          ]);
        }

        const initialization = pendingGameInitialization;
        const [comparisonsFromApi, questionsFromApi, session] =
          await initialization;
        if (pendingGameInitialization === initialization) {
          pendingGameInitialization = null;
        }

        const initialState = {
          flow: buildFlow(comparisonsFromApi, questionsFromApi),
          currentIndex: 0,
          answers: [],
          profileAnswers: [],
          dreamCode: [],
          datasetId: session.datasetId,
          datasetVersion: session.datasetVersion,
        };

        setSessionId(session.sessionId);
        setGameState(initialState);

        sessionStorage.setItem("sessionId", session.sessionId);
        sessionStorage.setItem("gameState", JSON.stringify(initialState));
      } catch (err) {
        console.error(err);
        pendingGameInitialization = null;
        setError(text.loadError);
      } finally {
        setIsLoading(false);
      }
    }

    loadGameData();
  }, [language, text.loadError]);

  if (isLoading) {
    return (
      <Layout language={language} setLanguage={setLanguage} bracesVariant="game">
        <section className="game-content">
          <h1 className="main-title game-title">{translations[language].common.brand}</h1>
          <p className="bottom-note game-note">{text.loading}</p>
        </section>
      </Layout>
    );
  }

  if (error || !gameState) {
    return (
      <Layout language={language} setLanguage={setLanguage} bracesVariant="game">
        <section className="game-content">
          <h1 className="main-title game-title">{translations[language].common.brand}</h1>
          <p className="bottom-note game-note">
            {error || text.loadError}
          </p>
        </section>
      </Layout>
    );
  }

  const currentStep = gameState.flow[gameState.currentIndex];

  const progress =
    ((gameState.currentIndex + 1) / gameState.flow.length) * 100;

  const questionList = text.questions;

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
    const { winner: topLanguage, counts: languageCounts } = getWinningLanguage(
      finalState.answers
    );

    const finalWinner = {
      language: topLanguage || "text",
      code: finalState.dreamCode.map((snippet) => snippet.code).join("\n\n"),
      snippets: finalState.dreamCode,
    };

    const finalResult = {
      winner: finalWinner,
      languageCounts,
      answers: finalState.answers,
      profileAnswers: finalState.profileAnswers,
      dreamCode: finalState.dreamCode,
      datasetId: finalState.datasetId,
      datasetVersion: finalState.datasetVersion,
    };

    try {
      await saveFinalResult({
        sessionId,
        result: finalResult,
      });
    } catch (err) {
      console.error("Erro ao guardar resultado final:", err);
      throw err;
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

  async function goToNextStep(newState) {
    if (newState.currentIndex === newState.flow.length - 1) {
      const stateAwaitingFinalSave = {
        ...newState,
        isAwaitingFinalSave: true,
      };
      updateGameState(stateAwaitingFinalSave);
      await finishGame(stateAwaitingFinalSave);
      return;
    }

    updateGameState({
      ...newState,
      currentIndex: newState.currentIndex + 1,
    });
  }

  async function retryFinalSave() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError("");

    try {
      await finishGame(gameState);
    } catch (err) {
      console.error("Erro ao repetir a gravação do resultado final:", err);
      setSubmissionError(text.finalSaveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCodeChoice(choice) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError("");

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

    let responseSaved = false;

    try {
      await saveChoice({
        sessionId,
        comparisonId: currentStep.id,
        roundNumber: currentStep.comparisonNumber,
        category: currentStep.category,
        leftSnippetId: currentStep.leftSnippet.id,
        rightSnippetId: currentStep.rightSnippet.id,
        selectedSnippetId: selectedSnippet.id,
      });
      responseSaved = true;
      await goToNextStep(updatedState);
    } catch (err) {
      console.error("Erro ao guardar escolha:", err);
      setSubmissionError(responseSaved ? text.finalSaveError : text.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleProfileAnswer(option) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError("");

    const answerValue =
      typeof option === "string" ? option : option.value;
    const answerLabel =
      typeof option === "string" ? option : option[language];

    const profileAnswer = {
      questionId: currentStep.id,
      question:
        language === "pt" ? currentStep.question_pt : currentStep.question_en,
      answer: answerValue,
      answerLabel,
      timestamp: new Date().toISOString(),
    };

    const updatedState = {
      ...gameState,
      profileAnswers: [...gameState.profileAnswers, profileAnswer],
    };

    let responseSaved = false;

    try {
      await saveProfileAnswer({
        sessionId,
        questionId: currentStep.id,
        answer: answerValue,
      });
      responseSaved = true;
      await goToNextStep(updatedState);
    } catch (err) {
      console.error("Erro ao guardar resposta de perfil:", err);
      setSubmissionError(responseSaved ? text.finalSaveError : text.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    if (isSubmitting) return;

    if (currentStep.type === "code") {
      setIsSubmitting(true);
      setSubmissionError("");
      const answer = {
        comparisonId: currentStep.id,
        category: currentStep.category,
        leftSnippetId: currentStep.leftSnippet.id,
        rightSnippetId: currentStep.rightSnippet.id,
        selectedSide: SKIPPED_VALUE,
        selectedSnippetId: SKIPPED_VALUE,
        selectedLanguage: SKIPPED_VALUE,
        selectedCode: "",
        timestamp: new Date().toISOString(),
      };

      const updatedState = {
        ...gameState,
        answers: [...gameState.answers, answer],
      };

      let responseSaved = false;

      try {
        await saveChoice({
          sessionId,
          comparisonId: currentStep.id,
          roundNumber: currentStep.comparisonNumber,
          category: currentStep.category,
          leftSnippetId: currentStep.leftSnippet.id,
          rightSnippetId: currentStep.rightSnippet.id,
          selectedSnippetId: SKIPPED_VALUE,
        });
        responseSaved = true;
        await goToNextStep(updatedState);
      } catch (err) {
        console.error("Erro ao guardar skip:", err);
        setSubmissionError(responseSaved ? text.finalSaveError : text.saveError);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    await handleProfileAnswer(SKIPPED_VALUE);
  }

  return (
    <Layout language={language} setLanguage={setLanguage} bracesVariant="game">
      <section className="game-content">
        <button
          type="button"
          className="main-title game-title clickable-logo logo-button"
          onClick={() => navigate("/")}
          aria-label={translations[language].common.goHome}
        >
          {translations[language].common.brand}
        </button>

        {gameState.isAwaitingFinalSave ? (
          <section className="final-save-pending" aria-live="polite">
            <h2 className="game-question">{text.finalSavePending}</h2>
            <SmallNavButton onClick={retryFinalSave} disabled={isSubmitting}>
              {isSubmitting ? text.saving : text.retryFinalSave}
            </SmallNavButton>
          </section>
        ) : currentStep.type === "code" ? (
          <>
            <h2 className="game-question">{dynamicQuestion}</h2>

            <div className="code-grid">
              <button
                type="button"
                className="code-area clickable-code-area"
                onClick={() => handleCodeChoice("left")}
                aria-label={text.chooseLeft}
                disabled={isSubmitting}
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
                aria-label={text.chooseRight}
                disabled={isSubmitting}
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
                {text.progress(currentCodeQuestionNumber, CODE_QUESTIONS_PER_GAME)}
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
                disabled={isSubmitting}
              >
                {isSubmitting ? text.saving : text.skip}
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
                    type="button"
                    key={option.value}
                    className="option-button"
                    onClick={() => handleProfileAnswer(option)}
                    disabled={isSubmitting}
                  >
                    {option[language]}
                  </button>
                ))}
              </div>
            </article>

            <SmallNavButton
              className="skip-game-button"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              {isSubmitting ? text.saving : text.skip}
            </SmallNavButton>
          </>
        )}

        <p className="submission-error" role="alert" aria-live="assertive">
          {submissionError}
        </p>
        <p className="bottom-note game-note">{text.note}</p>
      </section>
    </Layout>
  );
}
