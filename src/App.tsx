import { useState } from 'react';
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
import { useGame } from './hooks/useGame';
import './App.css';

type AppScreen =
  | { type: 'setup' }
  | { type: 'playing'; config: GameSetupConfig };

function App() {
  const [screen, setScreen] = useState<AppScreen>({ type: 'setup' });
  const [lastConfig, setLastConfig] = useState<GameSetupConfig>(DEFAULT_SETUP_CONFIG);

  const activeConfig = screen.type === 'playing' ? screen.config : lastConfig;
  const matchConfig = buildMatchConfig(activeConfig);

  const game = useGame(
    activeConfig.mode,
    matchConfig,
    activeConfig.botDifficulty,
    activeConfig.botSide,
  );

  const handleStartGame = (config: GameSetupConfig) => {
    setLastConfig(config);
    setScreen({ type: 'playing', config });
    const mc = buildMatchConfig(config);
    game.resetGame(
      config.mode,
      mc,
      config.botDifficulty,
      config.botSide,
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
          />
          <RulesPanel variantMode={screen.config.variantMode} gameType={screen.config.gameType} />
        </aside>

        <section className="board-section">
          <Chessboard
            fen={game.state.fen}
            onMove={handleMove}
            legalMovesFrom={game.legalMovesFrom}
            interactive={game.isPlayerTurn}
            flipped={screen.config.mode === 'hvbot' && screen.config.botSide === 'w'}
            pendingPieceRemoval={game.pendingPieceRemoval}
            removableSquares={game.removableSquares}
            onPieceRemoval={game.selectPieceForRemoval}
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
          <MoveList moves={game.state.moveHistory} />
        </aside>
      </main>
    </div>
  );
}

export default App
