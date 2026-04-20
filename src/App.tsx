import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameSetupConfig, CrazyhousePieceType } from './core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from './core/blunziger/types';
import { getRandomChess960Index, chess960IndexToFen } from './core/blunziger/chess960';
import type { Square, Color } from './core/blunziger/types';
import type { GameRecord, SimulationRecord } from './core/gameRecord';
import { createGameRecord, createSimulationRecord } from './core/gameRecord';
import { isStaticMode, isConnectedMode } from './config/deployMode';
import { DeployModeProvider } from './config/DeployModeContext';
import { getActiveRoom } from './services/lobbyService';
import { Sidebar } from './components/Sidebar';
import type { NavSection } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
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
import { ReportIssue } from './components/ReportIssue';
import { OnlineScreen } from './components/OnlineScreen';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';
import { OnlineGameScreen } from './components/OnlineGameScreen';
import { ProfileSettingsScreen } from './components/ProfileSettingsScreen';
import { getAvatarDisplay } from './components/avatarPresets';
import { useGame } from './hooks/useGame';
import { useEvaluation } from './hooks/useEvaluation';
import { useReview } from './hooks/useReview';
import { useSimulation } from './hooks/useSimulation';
import { useAuth } from './hooks/useAuth';
import { useGameHistory } from './hooks/useGameHistory';
import { useUserProfile } from './hooks/useUserProfile';
import './App.css';

type AppScreen =
  | { type: 'welcome' }
  | { type: 'quick-start' }
  | { type: 'new-game' }
  | { type: 'online' }
  | { type: 'online-lobby'; config: GameSetupConfig }
  | { type: 'online-playing'; config: GameSetupConfig; roomCode: string; playerColor: Color; opponentName: string }
  | { type: 'analyse' }
  | { type: 'analyse-review'; config: GameSetupConfig }
  | { type: 'simulate' }
  | { type: 'simulation-running' }
  | { type: 'rules' }
  | { type: 'profile' }
  | { type: 'playing'; config: GameSetupConfig };

function App() {
  const auth = useAuth();
  // In static mode, skip welcome and start at quick-start.
  const [screen, setScreen] = useState<AppScreen>(
    isStaticMode ? { type: 'quick-start' } : { type: 'welcome' },
  );
  const [lastConfig, setLastConfig] = useState<GameSetupConfig>(DEFAULT_SETUP_CONFIG);
  const [showEvalBar, setShowEvalBar] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [simulationHistory, setSimulationHistory] = useState<SimulationRecord[]>([]);
  const [leftPanelExpanded, setLeftPanelExpanded] = useState(false);

  // Backend-connected hooks (no-ops in static mode).
  const gameHistoryBackend = useGameHistory();
  const {
    fetchPage: fetchRemotePage,
    saveGameToBackend,
    fetchGameForReview,
    removeGame: removeRemoteGame,
  } = gameHistoryBackend;
  const userProfile = useUserProfile(!!auth.user);

  // In connected mode, include remote game count in the sidebar badge.
  const remoteGameCount = isConnectedMode ? userProfile.profile?.gameCount ?? 0 : 0;

  // If the user is already authenticated (e.g. returning with a stored token),
  // skip the welcome screen automatically (connected mode only).
  // Also check for an active game to reconnect to.
  const skippedWelcomeRef = useRef(false);
  useEffect(() => {
    if (
      isConnectedMode &&
      !auth.loading && auth.user && screen.type === 'welcome' && !skippedWelcomeRef.current
    ) {
      skippedWelcomeRef.current = true;

      // Check for active game to reconnect to
      getActiveRoom().then((res) => {
        if (res.active && res.roomCode && res.playerColor && res.matchConfig) {
          try {
            const parsedConfig = JSON.parse(res.matchConfig) as GameSetupConfig;
            setScreen({
              type: 'online-playing',
              config: parsedConfig,
              roomCode: res.roomCode,
              playerColor: res.playerColor as Color,
              opponentName: res.opponentName ?? 'Opponent',
            });
          } catch {
            setScreen({ type: 'quick-start' });
          }
        } else {
          setScreen({ type: 'quick-start' });
        }
      }).catch(() => {
        setScreen({ type: 'quick-start' });
      });
    }
  }, [auth.loading, auth.user, screen.type]);

  const simulation = useSimulation();

  const activeConfig = (screen.type === 'playing' || screen.type === 'analyse-review') ? screen.config : lastConfig;
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
      // Also persist to backend in connected mode.
      if (isConnectedMode) {
        saveGameToBackend(record);
      }
      pendingRecordRef.current = null;
    }
  }, [saveGameToBackend]);

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

  const handleStartGame = (config: GameSetupConfig, isOnline?: boolean) => {
    setLastConfig(config);
    if (isOnline) {
      // Online game: pre-resolve the Chess960 position so both players
      // share the same starting placement. Without this, each client
      // would independently call getRandomChess960Index() and end up
      // with different starting positions.
      let onlineConfig = config;
      if (config.enableChess960 && config.chess960Index == null && !config.initialFen) {
        const idx = getRandomChess960Index();
        onlineConfig = { ...config, chess960Index: idx, initialFen: chess960IndexToFen(idx) };
      }
      setScreen({ type: 'online-lobby', config: onlineConfig });
      return;
    }
    setScreen({ type: 'playing', config });
    setLeftPanelExpanded(false);
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

  const handleRestartGame = () => {
    if (screen.type !== 'playing') return;
    if (!window.confirm('Are you sure you want to restart the game?')) return;
    flushPendingRecord();
    handleStartGame(screen.config);
  };

  // ── Online game handlers ──────────────────────────────────────────

  const handleOnlineGameReady = useCallback((roomCode: string, playerColor: Color, opponentName: string) => {
    if (screen.type !== 'online-lobby') return;
    setScreen({
      type: 'online-playing',
      config: screen.config,
      roomCode,
      playerColor,
      opponentName,
    });
  }, [screen]);

  const handleOnlineJoinGame = useCallback((config: GameSetupConfig, roomCode: string, playerColor: Color, opponentName: string) => {
    setLastConfig(config);
    setScreen({
      type: 'online-playing',
      config,
      roomCode,
      playerColor,
      opponentName,
    });
  }, []);

  const handleLeaveOnlineGame = useCallback(() => {
    setScreen({ type: 'online' });
  }, []);

  const handleCancelOnlineLobby = useCallback(() => {
    setScreen({ type: 'quick-start' });
  }, []);

  const handleMove = (from: Square, to: Square, promotion?: string): boolean => {
    // If a drop piece is selected but user clicks the board for a regular move, deselect
    if (selectedDropPiece) setSelectedDropPiece(null);
    return game.makeMove(from, to, promotion);
  };

  // ── Crazyhouse drop state ──
  const [selectedDropPiece, setSelectedDropPiece] = useState<CrazyhousePieceType | null>(null);
  const crazyhouseEnabled = (screen.type === 'playing' || screen.type === 'analyse-review') && screen.config.enableCrazyhouse;
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
    const isFromAnalyse = screen.type === 'analyse';
    setLastConfig(record.config);
    setScreen(isFromAnalyse
      ? { type: 'analyse-review', config: record.config }
      : { type: 'playing', config: record.config }
    );
    game.loadGameForReview(record);
    reviewLoadedRef.current = true;
    // Prevent saving a duplicate record for the loaded game.
    prevSavedRef.current = true;
  };

  // Ref keeps handleSelectGameForReview always up-to-date for async callbacks.
  const selectGameForReviewRef = useRef(handleSelectGameForReview);
  selectGameForReviewRef.current = handleSelectGameForReview;

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
    : screen.type === 'online-playing' ? 'playing'
    : screen.type === 'online-lobby' ? 'online'
    : screen.type === 'simulation-running' ? 'simulate'
    : screen.type === 'analyse-review' ? 'analyse'
    : screen.type === 'welcome' ? 'quick-start'
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

  const handleBackToAnalyse = useCallback(() => {
    setScreen({ type: 'analyse' });
  }, []);

  const handleLogout = useCallback(() => {
    flushPendingRecord();
    if (screen.type === 'simulation-running') {
      simulation.stop();
      flushSimulationRecords();
    }
    auth.logout();
    setScreen({ type: 'welcome' });
  }, [auth, flushPendingRecord, flushSimulationRecords, screen.type, simulation]);

  const handleContinueAsGuest = () => {
    auth.loginAsGuest();
    setScreen({ type: 'quick-start' });
  };

  const analyseCount = gameHistory.length + simulationHistory.length + remoteGameCount;

  // Fetch remote games when navigating to the Analyse tab (connected mode).
  useEffect(() => {
    if (screen.type === 'analyse' && isConnectedMode) {
      fetchRemotePage(1);
    }
  }, [screen.type, fetchRemotePage]);

  // Handle selecting a remote saved game for review.
  const handleSelectRemoteGame = useCallback(async (id: string) => {
    const record = await fetchGameForReview(id);
    if (record) {
      selectGameForReviewRef.current(record);
    }
  }, [fetchGameForReview]);

  // Handle deleting a remote saved game.
  const handleDeleteRemoteGame = useCallback(async (id: string) => {
    await removeRemoteGame(id);
  }, [removeRemoteGame]);

  // Render welcome / login screen before everything else (connected mode only).
  if (screen.type === 'welcome' && isConnectedMode) {
    return (
      <DeployModeProvider>
        <WelcomeScreen
          availableProviders={auth.availableProviders}
          loading={auth.loading}
          error={auth.error}
          onLoginWithProvider={auth.loginWithProvider}
          onContinueAsGuest={handleContinueAsGuest}
        />
      </DeployModeProvider>
    );
  }

  // Render setup screens (non-playing)
  if (screen.type !== 'playing' && screen.type !== 'online-playing' && screen.type !== 'analyse-review') {
    return (
      <DeployModeProvider>
        <div className="app-layout">
          <Sidebar
            activeSection={activeSection}
            onNavigate={handleNavigate}
            gameCount={analyseCount}
            isConnected={isConnectedMode}
            userName={userProfile.profile?.displayName ?? auth.user?.displayName}
            userAvatar={getAvatarDisplay(userProfile.profile?.avatarUrl)}
            onLogout={isConnectedMode ? handleLogout : undefined}
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
                onStartAnalysis={handleStartGame}
                remoteGames={isConnectedMode ? gameHistoryBackend.remoteGames : undefined}
                remoteTotal={isConnectedMode ? gameHistoryBackend.remoteTotal : undefined}
                remotePage={isConnectedMode ? gameHistoryBackend.page : undefined}
                remoteLoading={isConnectedMode ? gameHistoryBackend.loading : undefined}
                remoteError={isConnectedMode ? gameHistoryBackend.error : undefined}
                onFetchRemotePage={isConnectedMode ? fetchRemotePage : undefined}
                onSelectRemoteGame={isConnectedMode ? handleSelectRemoteGame : undefined}
                onDeleteRemoteGame={isConnectedMode ? handleDeleteRemoteGame : undefined}
              />
            )}
            {screen.type === 'online' && (
              <OnlineScreen
                authenticated={!!auth.user}
                onJoinGame={handleOnlineJoinGame}
              />
            )}
            {screen.type === 'online-lobby' && (
              <OnlineLobbyScreen
                config={screen.config}
                authenticated={!!auth.user}
                onGameReady={handleOnlineGameReady}
                onCancel={handleCancelOnlineLobby}
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
            {screen.type === 'profile' && (
              <ProfileSettingsScreen userProfile={userProfile} />
            )}
          </main>
        </div>
      </div>
      </DeployModeProvider>
    );
  }

  // Online playing screen
  if (screen.type === 'online-playing') {
    return (
      <DeployModeProvider>
        <div className="app-layout">
          <Sidebar
            activeSection={activeSection}
            onNavigate={handleNavigate}
            gameCount={analyseCount}
            isConnected={isConnectedMode}
            userName={userProfile.profile?.displayName ?? auth.user?.displayName}
            userAvatar={getAvatarDisplay(userProfile.profile?.avatarUrl)}
            onLogout={isConnectedMode ? handleLogout : undefined}
          />
          <div className="app-with-sidebar">
            <main className="app-main">
              <OnlineGameScreen
                config={screen.config}
                roomCode={screen.roomCode}
                playerColor={screen.playerColor}
                opponentName={screen.opponentName}
                onLeaveGame={handleLeaveOnlineGame}
              />
            </main>
          </div>
        </div>
      </DeployModeProvider>
    );
  }

  const showDetails = gameIsOver || review.isReviewing || leftPanelExpanded;

  // Playing screen
  return (
    <DeployModeProvider>
      <div className="app-layout">
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          gameCount={analyseCount}
          isConnected={isConnectedMode}
          userName={userProfile.profile?.displayName ?? auth.user?.displayName}
          userAvatar={getAvatarDisplay(userProfile.profile?.avatarUrl)}
          onLogout={isConnectedMode ? handleLogout : undefined}
        />
      <div className="app-with-sidebar">
        <main className="app-main">
          <aside className="left-panel">
            {screen.type === 'analyse-review' && (
              <button
                className="analyse-back-btn"
                onClick={handleBackToAnalyse}
              >
                ← Back to Analyse
              </button>
            )}
            {screen.type !== 'analyse-review' && !gameIsOver && !review.isReviewing && (
              <button
                className="panel-collapse-toggle"
                onClick={() => setLeftPanelExpanded(e => !e)}
              >
                {leftPanelExpanded ? '▴ Hide details' : '▾ Show details'}
              </button>
            )}
            {showDetails && (
              <>
                <GameSummaryPanel config={screen.config} />
                {screen.type !== 'analyse-review' && (
                  <GameControls
                    onNewGame={handleNewGame}
                    onRestart={handleRestartGame}
                    paused={game.paused}
                    onPauseToggle={game.setPaused}
                    moveDelay={game.moveDelay}
                    onMoveDelayChange={game.setMoveDelay}
                    isBotvBot={screen.config.mode === 'botvbot'}
                    showEvalBar={showEvalBar}
                    onShowEvalBarChange={setShowEvalBar}
                  />
                )}
                <RulesPanel variantMode={screen.config.variantMode} gameType={screen.config.gameType} />
                {screen.type !== 'analyse-review' && (
                  <ReportIssue config={screen.config} fen={displayFen} moveHistory={game.state.moveHistory} />
                )}
              </>
            )}
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
            {showDetails && <FenDisplay fen={displayFen} />}
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
              defaultCollapsed={!gameIsOver && !review.isReviewing}
            />
          </aside>
        </main>
      </div>
    </div>
    </DeployModeProvider>
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
