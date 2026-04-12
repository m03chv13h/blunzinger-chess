import { useState, useCallback } from 'react';
import type { GameSetupConfig } from '../core/blunziger/types';
import { getVariantModeDefinition } from '../core/blunziger/types';
import type { Move } from 'chess.js';
import './ReportIssue.css';

const REPO_URL = 'https://github.com/m03chv13h/blunzinger-chess';

interface ReportIssueProps {
  config: GameSetupConfig;
  fen: string;
  moveHistory: Move[];
}

function buildIssueBody(
  config: GameSetupConfig,
  fen: string,
  moveHistory: Move[],
  description: string,
): string {
  const variantDef = getVariantModeDefinition(config.variantMode);

  const overlays: string[] = [];
  if (config.enableKingOfTheHill) overlays.push('King of the Hill');
  if (config.enableClock) overlays.push('Clock');
  if (config.enableDoubleCheckPressure) overlays.push('Double Check Pressure');
  if (config.enableCrazyhouse) overlays.push('Crazyhouse');
  if (config.enableChess960) overlays.push('Chess960');
  if (config.enableAtomic) overlays.push('Atomic Chess');

  const moveSanList = moveHistory.map((m) => m.san);
  const moveLines: string[] = [];
  for (let i = 0; i < moveSanList.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const white = moveSanList[i];
    const black = moveSanList[i + 1];
    moveLines.push(black ? `${moveNum}. ${white} ${black}` : `${moveNum}. ${white}`);
  }

  const sections: string[] = [];

  if (description.trim()) {
    sections.push(`## Description\n\n${description.trim()}`);
  }

  const gameInfoLines: string[] = [
    '## Game Information',
    '',
    `- **Variant Mode:** ${variantDef.name}`,
    `- **Game Type:** ${config.gameType === 'report_incorrectness' ? 'Report Incorrectness' : 'Penalty on Miss'}`,
    `- **Player Mode:** ${config.mode === 'hvh' ? 'Human vs Human' : config.mode === 'hvbot' ? 'Human vs Bot' : 'Bot vs Bot'}`,
  ];

  if (overlays.length > 0) {
    gameInfoLines.push(`- **Overlays:** ${overlays.join(', ')}`);
  }

  // Bot settings
  if (config.mode === 'hvbot') {
    gameInfoLines.push(`- **Playing As:** ${config.botSide === 'b' ? 'White' : 'Black'}`);
    gameInfoLines.push(`- **Bot Difficulty:** ${config.botDifficulty}`);
    gameInfoLines.push(`- **Engine:** ${config.engineId}`);
  } else if (config.mode === 'botvbot') {
    gameInfoLines.push(`- **Bot Difficulty (White):** ${config.botDifficultyWhite}`);
    gameInfoLines.push(`- **Bot Difficulty (Black):** ${config.botDifficultyBlack}`);
    gameInfoLines.push(`- **Engine (White):** ${config.engineIdWhite}`);
    gameInfoLines.push(`- **Engine (Black):** ${config.engineIdBlack}`);
  }

  // Clock settings
  if (config.enableClock) {
    const timeSec = Math.round(config.initialTimeMs / 1000);
    const incSec = Math.round(config.incrementMs / 1000);
    const decSec = Math.round(config.decrementMs / 1000);
    gameInfoLines.push(`- **Clock:** ${timeSec}s + ${incSec}s inc / -${decSec}s dec`);
  }

  // Game-type-specific settings
  if (config.gameType === 'report_incorrectness') {
    gameInfoLines.push(`- **Invalid Report Loss Threshold:** ${config.invalidReportLossThreshold}`);
  } else {
    const penalties: string[] = [];
    if (config.enableAdditionalMovePenalty) penalties.push(`Additional Move (${config.additionalMoveCount})`);
    if (config.enablePieceRemovalPenalty) penalties.push(`Piece Removal (${config.pieceRemovalCount})`);
    if (config.enableTimeReductionPenalty) penalties.push(`Time Reduction (${config.timeReductionSeconds}s)`);
    if (penalties.length > 0) {
      gameInfoLines.push(`- **Penalties:** ${penalties.join(', ')}`);
    }
  }

  // Variant-specific settings
  if (config.variantMode === 'classic_king_hunt_move_limit') {
    gameInfoLines.push(`- **Ply Limit:** ${config.kingHuntPlyLimit}`);
  } else if (config.variantMode === 'classic_king_hunt_given_check_limit') {
    gameInfoLines.push(`- **Given Check Target:** ${config.kingHuntGivenCheckTarget}`);
  }

  // Custom initial FEN
  if (config.initialFen) {
    gameInfoLines.push(`- **Initial FEN:** ${config.initialFen}`);
  }

  sections.push(gameInfoLines.join('\n'));

  sections.push(
    [
      '## Position',
      '',
      '```',
      fen,
      '```',
    ].join('\n'),
  );

  if (moveLines.length > 0) {
    sections.push(
      [
        '## Move History',
        '',
        '```',
        moveLines.join('\n'),
        '```',
      ].join('\n'),
    );
  }

  return sections.join('\n\n');
}

export function ReportIssue({ config, fen, moveHistory }: ReportIssueProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleOpen = useCallback(() => {
    setTitle('Bug: ');
    setDescription('');
    setOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSubmit = useCallback(() => {
    const body = buildIssueBody(config, fen, moveHistory, description);
    const params = new URLSearchParams({ title, body });
    window.open(`${REPO_URL}/issues/new?${params.toString()}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }, [config, fen, moveHistory, title, description]);

  return (
    <div className="report-issue">
      {!open && (
        <button className="report-issue-btn" onClick={handleOpen}>
          🐛 Report Issue
        </button>
      )}
      {open && (
        <div className="report-issue-form">
          <label htmlFor="report-title">Title</label>
          <input
            id="report-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue"
          />
          <label htmlFor="report-description">Additional Details</label>
          <textarea
            id="report-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened and what you expected..."
          />
          <div className="report-issue-actions">
            <button className="report-issue-submit" onClick={handleSubmit}>
              Open on GitHub
            </button>
            <button className="report-issue-cancel" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
