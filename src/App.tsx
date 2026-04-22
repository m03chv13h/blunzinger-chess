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
import { listSimulations, getSimulation } from './services/simulationService';
import type { SimulationListItem } from './services/simulationService';
import { useNavigation, getScreenFromHash } from './hooks/useNavigation';
import type { NavigableScreen } from './hooks/useNavigation';
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
import { PlayedGamesSection } from './components/PlayedGamesSection';
import type { ConnectionFilter } from './components/PlayedGamesSection';
import { SimulationSetupScreen } from './components/SimulationSetupScreen';
import { SimulationView } from './components/SimulationView';
import { SimulationsOverviewSection } from './components/SimulationsOverviewSection';
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
import { useGameHistory, gameListItemToRecord } from './hooks/useGameHistory';
import type { GameFilters } from './services/gamesService';
import { useUserProfile } from './hooks/useUserProfile';
import './App.css';

type AppScreen =
  | { type: 'welcome' }
  | { type: 'quick-start' }
  | { type: 'new-game' }
  | { type: 'online' }
  | { type: 'online-lobby'; config: GameSetupConfig }
  | { type: 'online-playing'; config: GameSetupConfig; roomCode: string; playerColor: Color; opponentName: string }
  | { type: 'games' }
  | { type: 'games-review'; config: GameSetupConfig }
  | { type: 'analyse' }
  | { type: 'analyse-review'; config: GameSetupConfig }
  | { type: 'simulate' }
  | { type: 'simulation-running' }
  | { type: 'rules' }
  | { type: 'profile' }
  | { type: 'playing'; config: GameSetupConfig };

function App() {
  const auth = useAuth();
  // Determine initial screen from URL hash, falling back to defaults.
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (isStaticMode) {
      // In static mode, use the URL hash or default to quick-start.
      return { type: getScreenFromHash() ?? 'quick-start' };
    }
    // In connected mode, start with the URL-derived screen if we have one,
    // but show 'welcome' if there's no hash (first visit).
    const hashScreen = getScreenFromHash();
    return hashScreen ? { type: hashScreen } : { type: 'welcome' };
  });
  const [lastConfig, setLastConfig] = useState<GameSetupConfig>(DEFAULT_SETUP_CONFIG);
  const [showEvalBar, setShowEvalBar] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>(() => {
    try {
      const stored = localStorage.getItem('blunziger-chess-game-history');
      if (stored) {
        const parsed: GameRecord[] = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore corrupted data
    }
    return [];
  });
  const [simulationHistory, setSimulationHistory] = useState<SimulationRecord[]>([]);
  const [remoteSimList, setRemoteSimList] = useState<SimulationListItem[]>([]);
  const [remoteSimTotal, setRemoteSimTotal] = useState(0);
  const [remoteSimPage, setRemoteSimPage] = useState(1);
  const [remoteSimLoading, setRemoteSimLoading] = useState(false);
  const [remoteSimError, setRemoteSimError] = useState<string | null>(null);
  const [leftPanelExpanded, setLeftPanelExpanded] = useState(false);

  // Persist game history to localStorage whenever it changes.
  useEffect(() => {
    try {
      // Cap at 200 most-recent games to prevent localStorage overflow.
      const toStore = gameHistory.length > 200 ? gameHistory.slice(0, 200) : gameHistory;
      localStorage.setItem('blunziger-chess-game-history', JSON.stringify(toStore));
    } catch {
      // Ignore quota-exceeded or other storage errors
    }
  }, [gameHistory]);

  // Backend-connected hooks (no-ops in static mode).
  const gameHistoryBackend = useGameHistory();
  const {
    remoteGames,
    remoteTotal,
    page: remotePage,
    loading: remoteLoading,
    error: remoteError,
    fetchPage: fetchRemotePage,
    saveGameToBackend,
    fetchGameForReview,
  } = gameHistoryBackend;
  const userProfile = useUserProfile(!!auth.user);

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

  // In connected mode, if started from a URL hash (not welcome), redirect to
  // welcome if the user turns out to be unauthenticated on initial auth check.
  const authCheckedRef = useRef(false);
  useEffect(() => {
    if (
      isConnectedMode &&
      !auth.loading && !authCheckedRef.current
    ) {
      authCheckedRef.current = true;
      if (!auth.user && screen.type !== 'welcome') {
        setScreen({ type: 'welcome' });
      }
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
    // Reset so subsequent games on the same 'playing' screen are also saved
    // (e.g. after restart).
    prevSavedRef.current = false;
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

  const handleOnlineGameComplete = useCallback((record: GameRecord) => {
    setGameHistory(prev => [record, ...prev]);
    if (isConnectedMode) {
      saveGameToBackend(record);
    }
  }, [saveGameToBackend]);

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
    if (isConnectedMode && simulation.savedSimulationRecord) {
      // In connected mode, the backend already saved the simulation — just add to local history
      setSimulationHistory((prev) => {
        // Avoid duplicates
        if (prev.some((s) => s.id === simulation.savedSimulationRecord!.id)) return prev;
        return [simulation.savedSimulationRecord!, ...prev];
      });
    } else if (simulation.completedRecords.length > 0 && simulation.config) {
      // Static mode: create a local simulation record
      const simRecord = createSimulationRecord(simulation.config, simulation.completedRecords);
      setSimulationHistory((prev) => [simRecord, ...prev]);
    }
  }, [simulation.completedRecords, simulation.config, simulation.savedSimulationRecord]);

  const handleSelectGameForReview = (record: GameRecord) => {
    // If reviewing a game from a running simulation, flush completed records first
    if (screen.type === 'simulation-running') {
      flushSimulationRecords();
    }
    const isFromAnalyse = screen.type === 'analyse';
    const isFromGames = screen.type === 'games';
    setLastConfig(record.config);
    setScreen(
      isFromAnalyse
        ? { type: 'analyse-review', config: record.config }
        : isFromGames
          ? { type: 'games-review', config: record.config }
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

  // In connected mode, fetch full game details from backend before loading for review.
  const handleSelectRemoteGameForReview = useCallback(async (record: GameRecord) => {
    if (isConnectedMode) {
      const fullRecord = await fetchGameForReview(record.id);
      if (fullRecord) {
        selectGameForReviewRef.current(fullRecord);
        return;
      }
    }
    // Fall back to the partial record (local game or fetch failed).
    selectGameForReviewRef.current(record);
  }, [fetchGameForReview]);

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
    : screen.type === 'games-review' ? 'games'
    : screen.type === 'welcome' ? 'quick-start'
    : screen.type;

  // Sync URL hash with screen state and handle browser back/forward.
  const handleHashNavigate = useCallback((section: NavigableScreen) => {
    flushPendingRecord();
    if (screen.type === 'simulation-running') {
      simulation.stop();
      flushSimulationRecords();
    }
    setScreen({ type: section });
  }, [flushPendingRecord, flushSimulationRecords, screen.type, simulation]);

  useNavigation({ screenType: screen.type, onNavigate: handleHashNavigate });

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

  const handleBackToGames = useCallback(() => {
    setScreen({ type: 'games' });
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

  const gamesCount = isConnectedMode ? (remoteTotal || gameHistory.length) : gameHistory.length;

  // ── Server-side filters for the Games section (connected mode) ──
  const GAMES_PAGE_SIZE = 20;
  const gamesFiltersRef = useRef<GameFilters>({});

  // Fetch remote games when navigating to the Analyse tab (connected mode).
  useEffect(() => {
    if (screen.type === 'analyse' && isConnectedMode) {
      fetchRemotePage(1);
    }
  }, [screen.type, fetchRemotePage]);

  // Fetch remote games when navigating to the Games section (connected mode).
  // Intentionally reset filters so the user starts with a clean slate each time.
  // The PlayedGamesSection component also resets its local filter state on mount.
  useEffect(() => {
    if (screen.type === 'games' && isConnectedMode) {
      gamesFiltersRef.current = {};
      fetchRemotePage(1, GAMES_PAGE_SIZE);
    }
  }, [screen.type, fetchRemotePage]);

  /** Convert UI filter state to API-level GameFilters. */
  const toGameFilters = useCallback((f: { connectionFilter: ConnectionFilter; includeSpectated: boolean }): GameFilters => {
    const filters: GameFilters = {};
    if (f.connectionFilter === 'online') filters.gameMode = 'multiplayer';
    else if (f.connectionFilter === 'offline') filters.gameMode = 'local';
    if (!f.includeSpectated) filters.includeSpectated = false;
    return filters;
  }, []);

  const handleGamesFilterChange = useCallback((f: { connectionFilter: ConnectionFilter; includeSpectated: boolean }) => {
    const filters = toGameFilters(f);
    gamesFiltersRef.current = filters;
    fetchRemotePage(1, GAMES_PAGE_SIZE, filters);
  }, [fetchRemotePage, toGameFilters]);

  const handleGamesPageChange = useCallback((p: number) => {
    fetchRemotePage(p, GAMES_PAGE_SIZE, gamesFiltersRef.current);
  }, [fetchRemotePage]);

  // In connected mode, use backend games for the Games section (ordered by latest first).
  // Falls back to local gameHistory in static mode or when backend has no results.
  const gamesForDisplay: GameRecord[] = (() => {
    if (isConnectedMode && remoteGames.length > 0) {
      return remoteGames.map(gameListItemToRecord);
    }
    return gameHistory;
  })();

  // Load saved simulations from the backend when viewing the Analyse tab (connected mode).
  const simulationsLoadedRef = useRef(false);
  useEffect(() => {
    if (screen.type === 'analyse' && isConnectedMode && !simulationsLoadedRef.current) {
      simulationsLoadedRef.current = true;
      listSimulations(1, 50).then(async (res) => {
        // Fetch full details for each simulation to get the game records
        const records: SimulationRecord[] = [];
        for (const item of res.simulations) {
          try {
            const full = await getSimulation(item.id);
            records.push(full);
          } catch {
            // Skip simulations that fail to load
          }
        }
        if (records.length > 0) {
          setSimulationHistory((prev) => {
            // Merge: add remote records that don't already exist locally
            const existingIds = new Set(prev.map((s) => s.id));
            const newRecords = records.filter((r) => !existingIds.has(r.id));
            return [...newRecords, ...prev];
          });
        }
      }).catch(() => {
        // Ignore errors fetching saved simulations
      });
    }
  }, [screen.type]);

  // Fetch simulation list for the overview in the Simulate section.
  const SIM_PAGE_SIZE = 20;

  const fetchSimulationPage = useCallback((page: number) => {
    setRemoteSimLoading(true);
    setRemoteSimError(null);
    listSimulations(page, SIM_PAGE_SIZE).then((res) => {
      setRemoteSimList(res.simulations);
      setRemoteSimTotal(res.total);
      setRemoteSimPage(res.page);
      setRemoteSimLoading(false);
    }).catch(() => {
      setRemoteSimError('Failed to load simulations');
      setRemoteSimLoading(false);
    });
  }, []);

  useEffect(() => {
    if (screen.type === 'simulate' && isConnectedMode) {
      fetchSimulationPage(1);
    }
  }, [screen.type, fetchSimulationPage]);

  const handleSimPageChange = useCallback((page: number) => {
    fetchSimulationPage(page);
  }, [fetchSimulationPage]);

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
  if (screen.type !== 'playing' && screen.type !== 'online-playing' && screen.type !== 'analyse-review' && screen.type !== 'games-review') {
    return (
      <DeployModeProvider>
        <div className="app-layout">
          <Sidebar
            activeSection={activeSection}
            onNavigate={handleNavigate}
            gameCount={gamesCount}
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
                games={[]}
                simulations={simulationHistory}
                onSelectGame={handleSelectGameForReview}
                onStartAnalysis={handleStartGame}
              />
            )}
            {screen.type === 'games' && (
              <PlayedGamesSection
                games={gamesForDisplay}
                onAnalyseGame={handleSelectRemoteGameForReview}
                remoteMode={isConnectedMode ? {
                  page: remotePage,
                  totalGames: remoteTotal,
                  pageSize: GAMES_PAGE_SIZE,
                  loading: remoteLoading,
                  error: remoteError,
                  onFilterChange: handleGamesFilterChange,
                  onPageChange: handleGamesPageChange,
                } : undefined}
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
              <SimulationSetupScreen onStart={handleStartSimulation}>
                <SimulationsOverviewSection
                  remoteSimulations={isConnectedMode ? remoteSimList : undefined}
                  localSimulations={isStaticMode ? simulationHistory : undefined}
                  loading={isConnectedMode ? remoteSimLoading : false}
                  error={isConnectedMode ? remoteSimError : null}
                  page={remoteSimPage}
                  total={remoteSimTotal}
                  pageSize={SIM_PAGE_SIZE}
                  onPageChange={isConnectedMode ? handleSimPageChange : undefined}
                />
              </SimulationSetupScreen>
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
            gameCount={gamesCount}
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
                onGameComplete={handleOnlineGameComplete}
              />
            </main>
          </div>
        </div>
      </DeployModeProvider>
    );
  }

  const isStandaloneReview = screen.type === 'analyse-review' || screen.type === 'games-review';
  const showDetails = isStandaloneReview
    ? leftPanelExpanded
    : gameIsOver || review.isReviewing || leftPanelExpanded;

  // Playing screen
  return (
    <DeployModeProvider>
      <div className="app-layout">
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          gameCount={gamesCount}
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
            {screen.type === 'games-review' && (
              <button
                className="analyse-back-btn"
                onClick={handleBackToGames}
              >
                ← Back to Games
              </button>
            )}
            {(isStandaloneReview || (!gameIsOver && !review.isReviewing)) && (
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
                {screen.type !== 'analyse-review' && screen.type !== 'games-review' && (
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
                {screen.type !== 'analyse-review' && screen.type !== 'games-review' && (
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
              defaultCollapsed={isStandaloneReview || (!gameIsOver && !review.isReviewing)}
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
