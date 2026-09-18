import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import SmallNavButton from "../components/SmallNavButton.jsx";
import translations from "../i18n/translations.js";
import {
  buildInitialFlow,
  GAME_STATE_VERSION,
  countPlannedCodeQuestions,
  readStoredGame,
  resolveCumulativeChoice,
  SKIPPED_VALUE,
} from "../game/gameUtils.js";

import {
  createSession,
  saveChoice,
  saveFinalResult,
  saveProfileAnswer,
} from "../api.js";

const CATEGORY_ORDER = ["variables", "loops", "conditionals"];

let pendingGameInitialization = null;

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
          pendingGameInitialization = createSession(language);
        }

        const initialization = pendingGameInitialization;
        const session = await initialization;
        const { comparisons: comparisonsFromApi, profileQuestions: questionsFromApi } = session;
        if (pendingGameInitialization === initialization) {
          pendingGameInitialization = null;
        }

        const initialState = {
          stateVersion: GAME_STATE_VERSION,
          flow: buildInitialFlow(comparisonsFromApi, questionsFromApi, CATEGORY_ORDER),
          comparisons: comparisonsFromApi,
          selectedStyles: {},
          categoryWinners: [],
          plannedProfileQuestions: questionsFromApi.length,
          plannedCodeQuestions: countPlannedCodeQuestions(
            comparisonsFromApi,
            CATEGORY_ORDER
          ),
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
          <SmallNavButton onClick={() => window.location.reload()}>{text.retryFinalSave}</SmallNavButton>
        </section>
      </Layout>
    );
  }

  const currentStep = gameState.flow[gameState.currentIndex];

  const progress =
    ((gameState.currentIndex + 1) / (gameState.plannedCodeQuestions + gameState.plannedProfileQuestions)) * 100;

  const questionList = text.questions;

  const dynamicQuestion =
    currentStep.type === "code"
      ? questionList[0]
      : language === "pt"
      ? currentStep.question_pt
      : currentStep.question_en;

  const currentCodeQuestionNumber =
    currentStep.type === "code"
      ? countPreviousCodeQuestions(gameState.flow, gameState.currentIndex)
      : null;
  const totalCodeQuestions = gameState.plannedCodeQuestions;

  function updateGameState(newState) {
    setGameState(newState);
    sessionStorage.setItem("gameState", JSON.stringify(newState));
  }

  async function finishGame(finalState) {
    const { result } = await saveFinalResult({ sessionId });
    const finalWinner = result.winner;

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
    let responseSaved = false;

    try {
      const skipped = choice === SKIPPED_VALUE;
      const selectedSnippet =
        choice === "right" ? currentStep.rightSnippet : currentStep.leftSnippet;
      const answer = {
        comparisonId: currentStep.id,
        category: currentStep.category,
        leftSnippetId: currentStep.leftSnippet.id,
        rightSnippetId: currentStep.rightSnippet.id,
        selectedSide: choice,
        selectedSnippetId: skipped ? SKIPPED_VALUE : selectedSnippet.id,
        selectedLanguage: skipped ? SKIPPED_VALUE : selectedSnippet.language,
        selectedStyle: skipped ? null : selectedSnippet.style,
        selectedCode: skipped ? "" : selectedSnippet.code,
        timestamp: new Date().toISOString(),
      };
      const resolution = resolveCumulativeChoice({
        flow: gameState.flow,
        currentIndex: gameState.currentIndex,
        selectedSnippet,
        comparisons: gameState.comparisons,
        categoryOrder: CATEGORY_ORDER,
        selectedStyles: gameState.selectedStyles,
        nextRoundNumber: gameState.answers.length + 2,
      });
      const answers = [...gameState.answers, answer];
      const categoryHasSkips = answers.some(
        (item) => item.category === currentStep.category && item.selectedSide === SKIPPED_VALUE
      );
      const updatedState = {
        ...gameState,
        flow: resolution.flow,
        // This is the composition context; confirmed preferences come from the API.
        selectedStyles: resolution.selectedStyles,
        answers,
        categoryWinners: resolution.categoryFinished && !categoryHasSkips
          ? [...gameState.categoryWinners, selectedSnippet]
          : gameState.categoryWinners,
        dreamCode: resolution.categoryFinished ? [selectedSnippet] : gameState.dreamCode,
      };
      await saveChoice({
        sessionId,
        comparisonId: currentStep.id,
        roundNumber: currentStep.comparisonNumber,
        category: currentStep.category,
        leftSnippetId: currentStep.leftSnippet.id,
        rightSnippetId: currentStep.rightSnippet.id,
        selectedSnippetId: answer.selectedSnippetId,
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
    if (currentStep.type === "code") {
      await handleCodeChoice(SKIPPED_VALUE);
    } else {
      await handleProfileAnswer(SKIPPED_VALUE);
    }
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
            <p className="game-context">
              {currentStep.leftSnippet[`intention_${language}`]} {text.contextNote}
            </p>

            <div className="code-grid">
              <button
                type="button"
                className="code-area clickable-code-area"
                onClick={() => handleCodeChoice("left")}
                aria-label={text.chooseLeft}
                disabled={isSubmitting}
              >
                <pre className="comparison-code"><code>{currentStep.leftSnippet.code}</code></pre>
              </button>

              <button
                type="button"
                className="code-area clickable-code-area"
                onClick={() => handleCodeChoice("right")}
                aria-label={text.chooseRight}
                disabled={isSubmitting}
              >
                <pre className="comparison-code"><code>{currentStep.rightSnippet.code}</code></pre>
              </button>
            </div>

            <div className="game-bottom-area">
              <p className="game-progress">
                {text.progress(currentCodeQuestionNumber, totalCodeQuestions)}
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
              <p className="game-skip-note">{text.skipNote}</p>
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
