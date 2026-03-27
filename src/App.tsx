import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameSetupConfig, CrazyhousePieceType } from './core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from './core/blunziger/types';
import type { Square } from './core/blunziger/types';
import type { GameRecord, SimulationRecord } from './core/gameRecord';
import { createGameRecord, createSimulationRecord } from './core/gameRecord';
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
import { SimulationSetupScreen } from './components/SimulationSetupScreen';
import { SimulationView } from './components/SimulationView';
import { EvaluationBar } from './components/EvaluationBar';
import { ReviewControls } from './components/ReviewControls';
import { CrazyhouseReserves } from './components/CrazyhouseReserve';
import { FenDisplay } from './components/FenDisplay';
import { useGame } from './hooks/useGame';
import { useEvaluation } from './hooks/useEvaluation';
import { useReview } from './hooks/useReview';
import { useSimulation } from './hooks/useSimulation';
import './App.css';

type AppScreen =
  | { type: 'quick-start' }
  | { type: 'new-game' }
  | { type: 'analyse' }
  | { type: 'simulate' }
  | { type: 'simulation-running' }
  | { type: 'rules' }
  | { type: 'playing'; config: GameSetupConfig };

function App() {
  const [screen, setScreen] = useState<AppScreen>({ type: 'quick-start' });
  const [lastConfig, setLastConfig] = useState<GameSetupConfig>(DEFAULT_SETUP_CONFIG);
  const [showEvalBar, setShowEvalBar] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [simulationHistory, setSimulationHistory] = useState<SimulationRecord[]>([]);

  const simulation = useSimulation();

  const activeConfig = screen.type === 'playing' ? screen.config : lastConfig;
  const matchConfig = buildMatchConfig(activeConfig);

  const game = useGame(
    activeConfig.mode,
    matchConfig,
    activeConfig.botDifficulty,
    activeConfig.botSide,
    activeConfig.engineIdWhite,
    activeConfig.engineIdBlack,
    activeConfig.botDifficultyWhite,
    activeConfig.botDifficultyBlack,
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

  // Enter review after loading a game from the Analyse section.
  const reviewLoadedRef = useRef(false);
  useEffect(() => {
    if (reviewLoadedRef.current && gameIsOver) {
      reviewLoadedRef.current = false;
      enterReview();
    }
  }, [gameIsOver, enterReview]);

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
    const record = pendingRecordRef.current;
    if (record) {
      setGameHistory(prev => [record, ...prev]);
      pendingRecordRef.current = null;
    }
  }, []);

  // The state used for evaluation: reviewed state when reviewing, otherwise live state.
  const stateForEval = review.reviewedGameState ?? game.state;
  const clockWhiteForEval = review.isReviewing ? (review.reviewedClockWhiteMs ?? 0) : game.clockWhiteMs;
  const clockBlackForEval = review.isReviewing ? (review.reviewedClockBlackMs ?? 0) : game.clockBlackMs;

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
      config.botDifficultyWhite,
      config.botDifficultyBlack,
    );
  };

  const handleNewGame = () => {
    flushPendingRecord();
    setScreen({ type: 'new-game' });
  };

  const handleMove = (from: Square, to: Square, promotion?: string): boolean => {
    // If a drop piece is selected but user clicks the board for a regular move, deselect
    if (selectedDropPiece) setSelectedDropPiece(null);
    return game.makeMove(from, to, promotion);
  };

  // ── Crazyhouse drop state ──
  const [selectedDropPiece, setSelectedDropPiece] = useState<CrazyhousePieceType | null>(null);
  const crazyhouseEnabled = screen.type === 'playing' && screen.config.enableCrazyhouse;
  const crazyhouse = game.state.crazyhouse;

  const handleDropSquareClick = useCallback((square: Square): boolean => {
    if (!selectedDropPiece) return false;
    const success = game.makeDropMove(selectedDropPiece, square);
    if (success) setSelectedDropPiece(null);
    return success;
  }, [selectedDropPiece, game]);

  const handleReserveDrop = useCallback((piece: CrazyhousePieceType, square: Square): boolean => {
    const success = game.makeDropMove(piece, square);
    if (success) setSelectedDropPiece(null);
    return success;
  }, [game]);

  const handleReserveDragStart = useCallback((piece: CrazyhousePieceType) => {
    setSelectedDropPiece(piece);
  }, []);

  const handleReserveDragEnd = useCallback(() => {
    // Selection is intentionally preserved after a cancelled drag, matching
    // the click-to-select flow where the piece remains selected after an
    // invalid placement attempt. Successful drops clear selection via
    // handleReserveDrop.
  }, []);

  const dropSquares = selectedDropPiece
    ? game.getDropSquares(selectedDropPiece)
    : [];

  const flushSimulationRecords = useCallback(() => {
    if (simulation.completedRecords.length > 0 && simulation.config) {
      const simRecord = createSimulationRecord(simulation.config, simulation.completedRecords);
      setSimulationHistory((prev) => [simRecord, ...prev]);
    }
  }, [simulation.completedRecords, simulation.config]);

  const handleSelectGameForReview = (record: GameRecord) => {
    // If reviewing a game from a running simulation, flush completed records first
    if (screen.type === 'simulation-running') {
      flushSimulationRecords();
    }
    setLastConfig(record.config);
    setScreen({ type: 'playing', config: record.config });
    game.loadGameForReview(record);
    reviewLoadedRef.current = true;
    // Prevent saving a duplicate record for the loaded game.
    prevSavedRef.current = true;
  };

  const handleStartSimulation = (config: GameSetupConfig, count: number) => {
    simulation.start(config, count);
    setScreen({ type: 'simulation-running' });
  };

  const handleSimulationBackToSetup = () => {
    // Flush completed simulation records into simulation history for analysis
    flushSimulationRecords();
    setScreen({ type: 'simulate' });
  };

  const activeSection: NavSection | 'playing' =
    screen.type === 'playing' ? 'playing'
    : screen.type === 'simulation-running' ? 'simulate'
    : screen.type;

  const handleNavigate = (section: NavSection) => {
    flushPendingRecord();
    // If leaving a running simulation, stop it and flush records
    if (screen.type === 'simulation-running') {
      simulation.stop();
      flushSimulationRecords();
    }
    setScreen({ type: section });
  };

  const analyseCount = gameHistory.length + simulationHistory.length;

  // Render setup screens (non-playing)
  if (screen.type !== 'playing') {
    return (
      <div className="app-layout">
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          gameCount={analyseCount}
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
                simulations={simulationHistory}
                onSelectGame={handleSelectGameForReview}
              />
            )}
            {screen.type === 'simulate' && (
              <SimulationSetupScreen onStart={handleStartSimulation} />
            )}
            {screen.type === 'simulation-running' && simulation.config && (
              <SimulationView
                config={simulation.config}
                games={simulation.games}
                standing={simulation.standing}
                running={simulation.running}
                onStop={simulation.stop}
                onAnalyseGame={handleSelectGameForReview}
                onBackToSetup={handleSimulationBackToSetup}
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
        gameCount={analyseCount}
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
            <div className="board-row">
              {showEvalBar && evaluation && <EvaluationBar evaluation={evaluation} />}
              {crazyhouseEnabled && crazyhouse && (
                <CrazyhouseReserves
                  whiteReserve={review.isReviewing && review.reviewedGameState?.crazyhouse
                    ? review.reviewedGameState.crazyhouse.whiteReserve
                    : crazyhouse.whiteReserve}
                  blackReserve={review.isReviewing && review.reviewedGameState?.crazyhouse
                    ? review.reviewedGameState.crazyhouse.blackReserve
                    : crazyhouse.blackReserve}
                  interactive={game.isPlayerTurn && !review.isReviewing}
                  activeSide={game.state.sideToMove}
                  selectedDropPiece={selectedDropPiece}
                  onSelectDropPiece={setSelectedDropPiece}
                  flipped={screen.config.mode === 'hvbot' && screen.config.botSide === 'w'}
                  onDragStartPiece={handleReserveDragStart}
                  onDragEndPiece={handleReserveDragEnd}
                />
              )}
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
                dropSquares={!review.isReviewing ? dropSquares : undefined}
                onDropSquareClick={!review.isReviewing ? handleDropSquareClick : undefined}
                onReserveDrop={!review.isReviewing ? handleReserveDrop : undefined}
              />
            </div>
            <FenDisplay fen={displayFen} />
          </section>

          <aside className="right-panel">
            <GameStatus
              state={game.state}
              onReport={game.report}
              botThinking={game.botThinking}
              clockWhiteMs={review.isReviewing ? review.reviewedClockWhiteMs : game.clockWhiteMs}
              clockBlackMs={review.isReviewing ? review.reviewedClockBlackMs : game.clockBlackMs}
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
