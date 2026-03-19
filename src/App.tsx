import type { Square, Color, GameMode, BotLevel, BlunzigerConfig } from './core/blunziger/types';
import { Chessboard } from './components/Chessboard';
import { MoveList } from './components/MoveList';
import { GameStatus } from './components/GameStatus';
import { GameControls } from './components/GameControls';
import { RulesPanel } from './components/RulesPanel';
import { useGame } from './hooks/useGame';
import './App.css';

function App() {
  const game = useGame();

  const handleMove = (from: Square, to: Square, promotion?: string): boolean => {
    return game.makeMove(from, to, promotion);
  };

  const handleNewGame = (mode: GameMode, config: BlunzigerConfig, botLevel: BotLevel, botColor: Color) => {
    game.resetGame(mode, config, botLevel, botColor);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟ Blunziger Chess</h1>
        <p className="subtitle">Standard chess + forced check rule</p>
      </header>

      <main className="app-main">
        <aside className="left-panel">
          <GameControls
            currentMode={game.state.mode}
            currentConfig={game.state.config}
            currentBotLevel={game.state.botLevel}
            currentBotColor={game.state.botColor}
            onNewGame={handleNewGame}
            paused={game.paused}
            onPauseToggle={game.setPaused}
            moveDelay={game.moveDelay}
            onMoveDelayChange={game.setMoveDelay}
            isBotvBot={game.state.mode === 'botvbot'}
          />
          <RulesPanel />
        </aside>

        <section className="board-section">
          <Chessboard
            fen={game.state.fen}
            onMove={handleMove}
            legalMovesFrom={game.legalMovesFrom}
            interactive={game.isPlayerTurn}
            flipped={game.state.mode === 'hvbot' && game.state.botColor === 'w'}
          />
        </section>

        <aside className="right-panel">
          <GameStatus
            state={game.state}
            onReport={game.report}
            botThinking={game.botThinking}
          />
          <MoveList moves={game.state.moveHistory} />
        </aside>
      </main>
    </div>
  );
}

export default App
