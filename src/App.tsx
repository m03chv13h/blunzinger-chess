import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameSetupConfig } from './core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from './core/blunziger/types';
import type { Square } from './core/blunziger/types';
import { Chessboard } from './components/Chessboard';
import { MoveList } from './components/MoveList';
import { GameStatus } from './components/GameStatus';
import { GameControls } from './components/GameControls';
import { GameSummaryPanel } from './components/GameSummaryPanel';
import { NewGameSetupScreen } from './components/NewGameSetupScreen';
import { RulesPanel } from './components/RulesPanel';
import { EvaluationBar } from './components/EvaluationBar';
import { ReviewControls } from './components/ReviewControls';
import { useGame } from './hooks/useGame';
import { useEvaluation } from './hooks/useEvaluation';
import { useReview } from './hooks/useReview';
import './App.css';

type AppScreen =
  | { type: 'setup' }
  | { type: 'playing'; config: GameSetupConfig };

function App() {
  const [screen, setScreen] = useState<AppScreen>({ type: 'setup' });
  const [lastConfig, setLastConfig] = useState<GameSetupConfig>(DEFAULT_SETUP_CONFIG);
  const [showEvalBar, setShowEvalBar] = useState(false);

  const activeConfig = screen.type === 'playing' ? screen.config : lastConfig;
  const matchConfig = buildMatchConfig(activeConfig);

  const game = useGame(
    activeConfig.mode,
    matchConfig,
    activeConfig.botDifficulty,
    activeConfig.botSide,
    activeConfig.engineIdWhite,
    activeConfig.engineIdBlack,
  );

  const review = useReview(game.state);

  // Auto-enter review mode when the game ends.
  const gameIsOver = game.state.result !== null;
  const prevGameOverRef = usePrevious(gameIsOver);
  const { enterReview } = review;
  useEffect(() => {
    if (gameIsOver && !prevGameOverRef) {
      enterReview();
    }
  }, [gameIsOver, prevGameOverRef, enterReview]);

  // The state used for evaluation: reviewed state when reviewing, otherwise live state.
  const stateForEval = review.reviewedGameState ?? game.state;
  const clockWhiteForEval = review.isReviewing ? 0 : game.clockWhiteMs;
  const clockBlackForEval = review.isReviewing ? 0 : game.clockBlackMs;

  const evaluation = useEvaluation(stateForEval, showEvalBar, clockWhiteForEval, clockBlackForEval);

  // The FEN shown on the board: reviewed position or live position.
  const displayFen = review.reviewedFen ?? game.state.fen;

  // Map move list click → review step navigation.
  const handleMoveListClick = useCallback((moveIndex: number) => {
    if (!review.isReviewing) return;
    // Find the review step that corresponds to this move index.
    const step = review.steps.find(s => s.moveIndex === moveIndex);
    if (step) {
      review.goToStep(step.index);
    }
  }, [review]);

  const handleStartGame = (config: GameSetupConfig) => {
    setLastConfig(config);
    setScreen({ type: 'playing', config });
    const mc = buildMatchConfig(config);
    game.resetGame(
      config.mode,
      mc,
      config.botDifficulty,
      config.botSide,
      config.engineIdWhite,
      config.engineIdBlack,
    );
  };

  const handleNewGame = () => {
    setScreen({ type: 'setup' });
  };

  const handleMove = (from: Square, to: Square, promotion?: string): boolean => {
    return game.makeMove(from, to, promotion);
  };

  if (screen.type === 'setup') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>♟ Blunziger Chess</h1>
          <p className="subtitle">Standard chess + forced check rule</p>
        </header>
        <main className="app-main">
          <NewGameSetupScreen
            initialConfig={lastConfig}
            onStartGame={handleStartGame}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟ Blunziger Chess</h1>
        <p className="subtitle">Standard chess + forced check rule</p>
      </header>

      <main className="app-main">
        <aside className="left-panel">
          <GameSummaryPanel config={screen.config} />
          <GameControls
            onNewGame={handleNewGame}
            paused={game.paused}
            onPauseToggle={game.setPaused}
            moveDelay={game.moveDelay}
            onMoveDelayChange={game.setMoveDelay}
            isBotvBot={screen.config.mode === 'botvbot'}
            showEvalBar={showEvalBar}
            onShowEvalBarChange={setShowEvalBar}
          />
          <RulesPanel variantMode={screen.config.variantMode} gameType={screen.config.gameType} />
        </aside>

        <section className="board-section">
          {showEvalBar && evaluation && <EvaluationBar evaluation={evaluation} />}
          <Chessboard
            fen={displayFen}
            onMove={handleMove}
            legalMovesFrom={game.legalMovesFrom}
            interactive={game.isPlayerTurn && !review.isReviewing}
            flipped={screen.config.mode === 'hvbot' && screen.config.botSide === 'w'}
            pendingPieceRemoval={game.pendingPieceRemoval && !review.isReviewing}
            removableSquares={review.isReviewing ? [] : game.removableSquares}
            onPieceRemoval={game.selectPieceForRemoval}
            bestMoveHintFrom={(evaluation?.bestMoveFrom ?? null) as Square | null}
            bestMoveHintTo={(evaluation?.bestMoveTo ?? null) as Square | null}
          />
        </section>

        <aside className="right-panel">
          <GameStatus
            state={game.state}
            onReport={game.report}
            botThinking={game.botThinking}
            clockWhiteMs={game.clockWhiteMs}
            clockBlackMs={game.clockBlackMs}
          />
          {review.isReviewing && review.reviewIndex !== null && (
            <ReviewControls
              reviewIndex={review.reviewIndex}
              totalSteps={review.totalSteps}
              onGoFirst={review.goToFirst}
              onGoPrev={review.goToPrev}
              onGoNext={review.goToNext}
              onGoLast={review.goToLast}
            />
          )}
          <MoveList
            moves={game.state.moveHistory}
            highlightedMoveIndex={review.isReviewing ? review.highlightedMoveIndex : -1}
            onMoveClick={review.isReviewing ? handleMoveListClick : undefined}
            violationReports={game.state.violationReports}
            missedChecks={game.state.missedChecks}
            gameOver={game.state.result !== null}
            pieceRemovals={game.state.pieceRemovals}
            timeReductions={game.state.timeReductions}
          />
        </aside>
      </main>
    </div>
  );
}

/** Simple hook to track the previous value of a variable. */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const prev = ref.current;
  ref.current = value;
  return prev;
}

export default App
