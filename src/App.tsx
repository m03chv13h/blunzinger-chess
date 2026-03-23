import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameSetupConfig } from './core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from './core/blunziger/types';
import type { Square } from './core/blunziger/types';
import type { GameRecord } from './core/gameRecord';
import { createGameRecord } from './core/gameRecord';
import { Sidebar } from './components/Sidebar';
import type { NavSection } from './components/Sidebar';
import { QuickStartScreen } from './components/QuickStartScreen';
import { Chessboard } from './components/Chessboard';
import { MoveList } from './components/MoveList';
import { GameStatus } from './components/GameStatus';
import { GameControls } from './components/GameControls';
import { GameSummaryPanel } from './components/GameSummaryPanel';
import { NewGameSetupScreen } from './components/NewGameSetupScreen';
import { RulesPanel } from './components/RulesPanel';
import { RulesPage } from './components/RulesPage';
import { AnalyseSection } from './components/AnalyseSection';
import { EvaluationBar } from './components/EvaluationBar';
import { ReviewControls } from './components/ReviewControls';
import { useGame } from './hooks/useGame';
import { useEvaluation } from './hooks/useEvaluation';
import { useReview } from './hooks/useReview';
import './App.css';

type AppScreen =
  | { type: 'quick-start' }
  | { type: 'new-game' }
  | { type: 'analyse' }
  | { type: 'rules' }
  | { type: 'playing'; config: GameSetupConfig };

function App() {
  const [screen, setScreen] = useState<AppScreen>({ type: 'quick-start' });
  const [lastConfig, setLastConfig] = useState<GameSetupConfig>(DEFAULT_SETUP_CONFIG);
  const [showEvalBar, setShowEvalBar] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);

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

  // Save completed game to history.
  const prevSavedRef = useRef(false);
  const pendingRecordRef = useRef<GameRecord | null>(null);
  useEffect(() => {
    if (screen.type !== 'playing') {
      prevSavedRef.current = false;
      return;
    }
    if (gameIsOver && !prevSavedRef.current) {
      prevSavedRef.current = true;
      pendingRecordRef.current = createGameRecord(
        screen.config,
        game.state.result!,
        game.state.fen,
        game.state.moveHistory.length,
        game.state.scores,
        game.state.positionHistory,
        game.state.moveHistory,
        game.state.violationReports,
        game.state.missedChecks,
        game.state.pieceRemovals,
        game.state.timeReductions,
      );
    }
  }, [gameIsOver, screen, game.state]);

  // Flush any pending game record into history when navigating away from playing.
  const flushPendingRecord = useCallback(() => {
    if (pendingRecordRef.current) {
      setGameHistory(prev => [pendingRecordRef.current!, ...prev]);
      pendingRecordRef.current = null;
    }
  }, []);

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
    flushPendingRecord();
    setScreen({ type: 'new-game' });
  };

  const handleMove = (from: Square, to: Square, promotion?: string): boolean => {
    return game.makeMove(from, to, promotion);
  };

  const handleSelectGameForReview = (record: GameRecord) => {
    setLastConfig(record.config);
    setScreen({ type: 'playing', config: record.config });
    const mc = buildMatchConfig(record.config);
    game.resetGame(
      record.config.mode,
      mc,
      record.config.botDifficulty,
      record.config.botSide,
      record.config.engineIdWhite,
      record.config.engineIdBlack,
    );
  };

  const activeSection: NavSection | 'playing' =
    screen.type === 'playing' ? 'playing' : screen.type;

  const handleNavigate = (section: NavSection) => {
    flushPendingRecord();
    setScreen({ type: section });
  };

  // Render setup screens (non-playing)
  if (screen.type !== 'playing') {
    return (
      <div className="app-layout">
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          gameCount={gameHistory.length}
        />
        <div className="app-with-sidebar">
          <main className="app-main">
            {screen.type === 'quick-start' && (
              <QuickStartScreen onStartGame={handleStartGame} />
            )}
            {screen.type === 'new-game' && (
              <NewGameSetupScreen
                initialConfig={lastConfig}
                onStartGame={handleStartGame}
              />
            )}
            {screen.type === 'analyse' && (
              <AnalyseSection
                games={gameHistory}
                onSelectGame={handleSelectGameForReview}
              />
            )}
            {screen.type === 'rules' && <RulesPage />}
          </main>
        </div>
      </div>
    );
  }

  // Playing screen
  return (
    <div className="app-layout">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        gameCount={gameHistory.length}
      />
      <div className="app-with-sidebar">
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
              bestMoveHintFrom={review.isReviewing ? (evaluation?.bestMoveFrom ?? null) as Square | null : null}
              bestMoveHintTo={review.isReviewing ? (evaluation?.bestMoveTo ?? null) as Square | null : null}
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
