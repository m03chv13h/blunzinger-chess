import { useState } from 'react';
import type { GameSetupConfig, GameMode, BotLevel, Color } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import { TimeInput } from './TimeInput';
import './QuickStartScreen.css';

interface QuickStartScreenProps {
  onStartGame: (config: GameSetupConfig) => void;
}

const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  hvh: 'Two players take turns on the same device.',
  hvbot: 'Play against a computer opponent.',
  botvbot: 'Watch two bots play against each other.',
};

/** Quick Start always uses Classic Blunzinger with clock enabled. */
export function QuickStartScreen({ onStartGame }: QuickStartScreenProps) {
  const [mode, setMode] = useState<GameMode>('hvh');
  const [botDifficulty, setBotDifficulty] = useState<BotLevel>('easy');
  const [playAs, setPlayAs] = useState<Color>('w');
  const [enableClock, setEnableClock] = useState(true);
  const [initialTimeMs, setInitialTimeMs] = useState(5 * 60 * 1000);
  const [incrementMs, setIncrementMs] = useState(0);

  const handleStart = () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_blunzinger',
      gameType: 'report_incorrectness',
      mode,
      botDifficulty,
      botSide: (playAs === 'w' ? 'b' : 'w') as Color,
      enableClock,
      initialTimeMs: enableClock ? initialTimeMs : 0,
      incrementMs: enableClock ? incrementMs : 0,
    };
    onStartGame(config);
  };

  return (
    <div className="quick-start-screen">
      <div className="quick-start-card">
        <h2>⚡ Quick Start</h2>
        <p className="quick-start-subtitle">
          Classic Blunzinger — jump straight in!
        </p>

        {/* Player Mode */}
        <div className="qs-group">
          <label htmlFor="qs-mode-select">Player Mode</label>
          <select
            id="qs-mode-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as GameMode)}
          >
            <option value="hvh">Human vs Human</option>
            <option value="hvbot">Human vs Bot</option>
            <option value="botvbot">Bot vs Bot</option>
          </select>
          <p className="qs-description">{MODE_DESCRIPTIONS[mode]}</p>
        </div>

        {/* Bot Difficulty */}
        {(mode === 'hvbot' || mode === 'botvbot') && (
          <div className="qs-group">
            <label htmlFor="qs-bot-level-select">Bot Difficulty</label>
            <select
              id="qs-bot-level-select"
              value={botDifficulty}
              onChange={(e) => setBotDifficulty(e.target.value as BotLevel)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        )}

        {/* Play As (color) */}
        {mode === 'hvbot' && (
          <div className="qs-group">
            <label htmlFor="qs-play-as-select">Play As</label>
            <select
              id="qs-play-as-select"
              value={playAs}
              onChange={(e) => setPlayAs(e.target.value as Color)}
            >
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </div>
        )}

        {/* Clock Settings */}
        <fieldset className="qs-group qs-clock-group">
          <legend>Clock</legend>
          <label className="qs-checkbox-label">
            <input
              type="checkbox"
              checked={enableClock}
              onChange={(e) => setEnableClock(e.target.checked)}
            />
            Enable clock
          </label>
          {enableClock && (
            <>
              <div className="qs-sub-group">
                <label htmlFor="qs-time-input">Initial time (MM:SS)</label>
                <TimeInput
                  id="qs-time-input"
                  valueMs={initialTimeMs}
                  onChange={setInitialTimeMs}
                  minSeconds={10}
                  maxSeconds={3600}
                  fallbackMs={5 * 60 * 1000}
                />
              </div>
              <div className="qs-sub-group">
                <label htmlFor="qs-increment-input">Increment per move (MM:SS)</label>
                <TimeInput
                  id="qs-increment-input"
                  valueMs={incrementMs}
                  onChange={setIncrementMs}
                  minSeconds={0}
                  maxSeconds={600}
                  fallbackMs={0}
                />
              </div>
            </>
          )}
        </fieldset>

        <button className="qs-start-btn" onClick={handleStart}>
          ▶ Start Game
        </button>
      </div>
    </div>
  );
}
