import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameSetupConfig, Square, CrazyhousePieceType, Color } from '../core/blunziger/types';
import { buildMatchConfig } from '../core/blunziger/types';
import { useGame } from '../hooks/useGame';
import { useGameHub } from '../hooks/useGameHub';
import type {
  OpponentMovedEvent,
  OpponentDropMoveEvent,
  OpponentPieceRemovalEvent,
  PlayerJoinedEvent,
} from '../hooks/useGameHub';
import { useEvaluation } from '../hooks/useEvaluation';
import { useReview } from '../hooks/useReview';
import { Chessboard } from './Chessboard';
import { MoveList } from './MoveList';
import { GameStatus } from './GameStatus';
import { GameSummaryPanel } from './GameSummaryPanel';
import { RulesPanel } from './RulesPanel';
import { EvaluationBar } from './EvaluationBar';
import { ReviewControls } from './ReviewControls';
import { CrazyhouseReserves } from './CrazyhouseReserve';
import { FenDisplay } from './FenDisplay';
import './OnlineGameScreen.css';

interface OnlineGameScreenProps {
  config: GameSetupConfig;
  roomCode: string;
  playerColor: Color;
  opponentName: string;
  onLeaveGame: () => void;
}

export function OnlineGameScreen({
  config,
  roomCode,
  playerColor,
  opponentName,
  onLeaveGame,
}: OnlineGameScreenProps) {
  const [showEvalBar, setShowEvalBar] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(true);
  const [hubError, setHubError] = useState<string | null>(null);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawPending, setDrawPending] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);

  const matchConfig = buildMatchConfig(config);

  const game = useGame(
    'hvh', // Both sides are "human" — restriction is at the UI/relay level
    matchConfig,
  );

  const review = useReview(game.state);

  // Auto-enter review when game ends
  const gameIsOver = game.state.result !== null;
  const prevGameOverRef = useRef(false);
  const { enterReview } = review;
  useEffect(() => {
    if (gameIsOver && !prevGameOverRef.current) {
      prevGameOverRef.current = true;
      enterReview();
    }
  }, [gameIsOver, enterReview]);

  // Hub callbacks
  const handleOpponentMoved = useCallback((event: OpponentMovedEvent) => {
    game.makeMove(event.from as Square, event.to as Square, event.promotion);
  }, [game]);

  const handleOpponentDropMove = useCallback((event: OpponentDropMoveEvent) => {
    game.makeDropMove(event.pieceType as CrazyhousePieceType, event.square as Square);
  }, [game]);

  const handleOpponentReported = useCallback(() => {
    game.report();
  }, [game]);

  const handleOpponentPieceRemoval = useCallback((event: OpponentPieceRemovalEvent) => {
    game.selectPieceForRemoval(event.square as Square);
  }, [game]);

  const setOpponentOnlineTrue = useCallback(() => {
    setOpponentOnline(true);
  }, []);

  const setOpponentOnlineFalse = useCallback(() => {
    setOpponentOnline(false);
  }, []);

  const handleGameOver = useCallback(() => {
    // Game over from server (resignation, draw agreement)
    // The local game engine handles checkmate/stalemate already
  }, []);

  const handleDrawOffered = useCallback(() => {
    setDrawOffered(true);
  }, []);

  const handleError = useCallback((msg: string) => {
    setHubError(msg);
  }, []);

  const hub = useGameHub({
    onOpponentMoved: handleOpponentMoved,
    onOpponentDropMove: handleOpponentDropMove,
    onOpponentReported: handleOpponentReported,
    onOpponentPieceRemoval: handleOpponentPieceRemoval,
    onPlayerJoined: setOpponentOnlineTrue as (event: PlayerJoinedEvent) => void,
    onOpponentDisconnected: setOpponentOnlineFalse as () => void,
    onOpponentReconnected: setOpponentOnlineTrue as (event: PlayerJoinedEvent) => void,
    onGameOver: handleGameOver as () => void,
    onDrawOffered: handleDrawOffered,
    onError: handleError,
  });

  // Connect to hub and join room on mount
  const joinedRef = useRef(false);
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    (async () => {
      try {
        if (!hub.connected) {
          await hub.connect();
        }
        await hub.joinRoom(roomCode);
      } catch {
        setHubError('Failed to connect to game server');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset game with the match config on mount
  const resetRef = useRef(false);
  useEffect(() => {
    if (resetRef.current) return;
    resetRef.current = true;
    game.resetGame('hvh', matchConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Move handling ──────────────────────────────────────────────────

  const isMyTurn = game.state.sideToMove === playerColor && !gameIsOver;
  const canInteract = isMyTurn && !review.isReviewing;

  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (!isMyTurn || review.isReviewing) return false;
    if (selectedDropPieceRef.current) {
      selectedDropPieceRef.current = null;
      setSelectedDropPiece(null);
    }
    const success = game.makeMove(from, to, promotion);
    if (success) {
      hub.sendMove(roomCode, from, to, promotion).catch(() => {
        setHubError('Failed to send move');
      });
    }
    return success;
  }, [isMyTurn, review.isReviewing, game, hub, roomCode]);

  const handleReport = useCallback(() => {
    if (!isMyTurn || review.isReviewing) return;
    game.report();
    hub.sendReport(roomCode).catch(() => {
      setHubError('Failed to send report');
    });
  }, [isMyTurn, review.isReviewing, game, hub, roomCode]);

  const handlePieceRemoval = useCallback((square: Square): boolean => {
    if (!canInteract) return false;
    const success = game.selectPieceForRemoval(square);
    if (success) {
      hub.sendPieceRemoval(roomCode, square).catch(() => {
        setHubError('Failed to send piece removal');
      });
    }
    return success;
  }, [canInteract, game, hub, roomCode]);

  // ── Crazyhouse drop state ──────────────────────────────────────────
  const [selectedDropPiece, setSelectedDropPiece] = useState<CrazyhousePieceType | null>(null);
  const selectedDropPieceRef = useRef<CrazyhousePieceType | null>(null);
  const crazyhouseEnabled = config.enableCrazyhouse;
  const crazyhouse = game.state.crazyhouse;

  const handleDropSquareClick = useCallback((square: Square): boolean => {
    if (!selectedDropPieceRef.current || !isMyTurn) return false;
    const piece = selectedDropPieceRef.current;
    const success = game.makeDropMove(piece, square);
    if (success) {
      setSelectedDropPiece(null);
      selectedDropPieceRef.current = null;
      hub.sendDropMove(roomCode, piece, square).catch(() => {
        setHubError('Failed to send drop move');
      });
    }
    return success;
  }, [isMyTurn, game, hub, roomCode]);

  const handleReserveDrop = useCallback((piece: CrazyhousePieceType, square: Square): boolean => {
    if (!isMyTurn) return false;
    const success = game.makeDropMove(piece, square);
    if (success) {
      setSelectedDropPiece(null);
      selectedDropPieceRef.current = null;
      hub.sendDropMove(roomCode, piece, square).catch(() => {
        setHubError('Failed to send drop move');
      });
    }
    return success;
  }, [isMyTurn, game, hub, roomCode]);

  const handleReserveDragStart = useCallback((piece: CrazyhousePieceType) => {
    selectedDropPieceRef.current = piece;
    setSelectedDropPiece(piece);
  }, []);

  const handleReserveDragEnd = useCallback(() => {
    // Selection preserved after cancelled drag
  }, []);

  const dropSquares = selectedDropPiece
    ? game.getDropSquares(selectedDropPiece)
    : [];

  // ── Resign / Draw ──────────────────────────────────────────────────

  const handleResign = useCallback(() => {
    if (!resignConfirm) {
      setResignConfirm(true);
      return;
    }
    setResignConfirm(false);
    hub.resignGame(roomCode).catch(() => {
      setHubError('Failed to resign');
    });
  }, [resignConfirm, hub, roomCode]);

  const handleOfferDraw = useCallback(() => {
    setDrawPending(true);
    hub.offerDraw(roomCode).catch(() => {
      setHubError('Failed to offer draw');
    });
  }, [hub, roomCode]);

  const handleAcceptDraw = useCallback(() => {
    setDrawOffered(false);
    hub.acceptDraw(roomCode).catch(() => {
      setHubError('Failed to accept draw');
    });
  }, [hub, roomCode]);

  const handleDeclineDraw = useCallback(() => {
    setDrawOffered(false);
  }, []);

  // ── Review ─────────────────────────────────────────────────────────

  const stateForEval = review.reviewedGameState ?? game.state;
  const clockWhiteForEval = review.isReviewing ? (review.reviewedClockWhiteMs ?? 0) : game.clockWhiteMs;
  const clockBlackForEval = review.isReviewing ? (review.reviewedClockBlackMs ?? 0) : game.clockBlackMs;
  const evaluation = useEvaluation(stateForEval, showEvalBar, clockWhiteForEval, clockBlackForEval);
  const displayFen = review.reviewedFen ?? game.state.fen;

  const handleMoveListClick = useCallback((moveIndex: number) => {
    if (!review.isReviewing) return;
    const step = review.steps.find(s => s.moveIndex === moveIndex);
    if (step) review.goToStep(step.index);
  }, [review]);

  // ── Perspective-aware result ───────────────────────────────────────

  const resultPerspective = game.state.result
    ? game.state.result.winner === 'draw'
      ? 'Draw'
      : game.state.result.winner === playerColor
        ? 'You won!'
        : 'You lost!'
    : null;

  const flipped = playerColor === 'b';

  return (
    <div className="online-game-layout">
      {/* ── Opponent Info Bar ── */}
      <div className="online-game-info-bar">
        <div className="online-game-opponent">
          <span className={`online-game-status-dot ${opponentOnline ? 'online-game-status-dot--online' : 'online-game-status-dot--offline'}`} />
          <span className="online-game-opponent-name">{opponentName}</span>
          <span className="online-game-opponent-status">
            {opponentOnline ? 'Online' : 'Disconnected'}
          </span>
        </div>
        <div className="online-game-room-info">
          <span className="online-game-room-label">Room:</span>
          <span className="online-game-room-code">{roomCode}</span>
          <span className="online-game-color-label">
            You play as {playerColor === 'w' ? '♔ White' : '♚ Black'}
          </span>
        </div>
      </div>

      {hubError && (
        <div className="online-game-error">⚠ {hubError}</div>
      )}

      <div className="online-game-main">
        {/* ── Left Panel ── */}
        <aside className="left-panel">
          <GameSummaryPanel config={config} />
          <RulesPanel variantMode={config.variantMode} gameType={config.gameType} />

          {/* Online game controls */}
          {!gameIsOver && (
            <div className="online-game-controls">
              <label className="online-game-eval-toggle">
                <input
                  type="checkbox"
                  checked={showEvalBar}
                  onChange={(e) => setShowEvalBar(e.target.checked)}
                />
                Show evaluation bar
              </label>

              <button
                className="online-game-resign-btn"
                onClick={handleResign}
              >
                {resignConfirm ? 'Confirm resign?' : '🏳 Resign'}
              </button>
              {resignConfirm && (
                <button
                  className="online-game-cancel-btn"
                  onClick={() => setResignConfirm(false)}
                >
                  Cancel
                </button>
              )}

              {!drawPending && !drawOffered && (
                <button
                  className="online-game-draw-btn"
                  onClick={handleOfferDraw}
                >
                  🤝 Offer Draw
                </button>
              )}
              {drawPending && (
                <p className="online-game-draw-pending">Draw offer sent…</p>
              )}
            </div>
          )}

          {/* Draw offer received */}
          {drawOffered && !gameIsOver && (
            <div className="online-game-draw-offer">
              <p>Your opponent offers a draw.</p>
              <button className="online-game-accept-btn" onClick={handleAcceptDraw}>
                ✅ Accept
              </button>
              <button className="online-game-decline-btn" onClick={handleDeclineDraw}>
                ❌ Decline
              </button>
            </div>
          )}
        </aside>

        {/* ── Board Section ── */}
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
                interactive={canInteract}
                activeSide={game.state.sideToMove}
                selectedDropPiece={selectedDropPiece}
                onSelectDropPiece={(p) => { selectedDropPieceRef.current = p; setSelectedDropPiece(p); }}
                flipped={flipped}
                onDragStartPiece={handleReserveDragStart}
                onDragEndPiece={handleReserveDragEnd}
              />
            )}
            <Chessboard
              fen={displayFen}
              onMove={handleMove}
              legalMovesFrom={game.legalMovesFrom}
              interactive={canInteract}
              flipped={flipped}
              pendingPieceRemoval={game.pendingPieceRemoval && canInteract}
              removableSquares={canInteract ? game.removableSquares : []}
              onPieceRemoval={handlePieceRemoval}
              bestMoveHintFrom={review.isReviewing ? (evaluation?.bestMoveFrom ?? null) as Square | null : null}
              bestMoveHintTo={review.isReviewing ? (evaluation?.bestMoveTo ?? null) as Square | null : null}
              dropSquares={canInteract ? dropSquares : undefined}
              onDropSquareClick={canInteract ? handleDropSquareClick : undefined}
              onReserveDrop={canInteract ? handleReserveDrop : undefined}
            />
          </div>
          <FenDisplay fen={displayFen} />
        </section>

        {/* ── Right Panel ── */}
        <aside className="right-panel">
          {/* Perspective-aware result */}
          {gameIsOver && resultPerspective && (
            <div className={`online-game-result ${
              game.state.result?.winner === 'draw' ? 'online-game-result--draw'
              : game.state.result?.winner === playerColor ? 'online-game-result--win'
              : 'online-game-result--loss'
            }`}>
              <h2>{resultPerspective}</h2>
              {game.state.result?.reason && (
                <p className="online-game-result-reason">
                  {formatResultReason(game.state.result.reason)}
                </p>
              )}
              {game.state.result?.detail && (
                <p className="online-game-result-detail">{game.state.result.detail}</p>
              )}
              <button className="online-game-leave-btn" onClick={onLeaveGame}>
                ← Back to Lobby
              </button>
            </div>
          )}

          <GameStatus
            state={game.state}
            onReport={handleReport}
            botThinking={false}
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
            gameOver={gameIsOver}
            pieceRemovals={game.state.pieceRemovals}
            timeReductions={game.state.timeReductions}
          />
        </aside>
      </div>
    </div>
  );
}

function formatResultReason(reason: string): string {
  switch (reason) {
    case 'checkmate': return 'Checkmate';
    case 'stalemate': return 'Stalemate';
    case 'valid-report': return 'Valid report (violation detected)';
    case 'invalid-report-threshold': return 'Too many invalid reports';
    case 'draw': return 'Draw';
    case 'insufficient-material': return 'Insufficient material';
    case 'threefold-repetition': return 'Threefold repetition';
    case 'fifty-move-rule': return 'Fifty-move rule';
    case 'king_of_the_hill': return 'King of the Hill';
    case 'timeout': return 'Timeout';
    case 'resignation': return 'Resignation';
    case 'atomic_king_explosion': return 'King exploded (Atomic)';
    default: return reason;
  }
}
