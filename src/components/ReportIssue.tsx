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

  sections.push(
    [
      '## Game Information',
      '',
      `- **Variant Mode:** ${variantDef.name}`,
      `- **Game Type:** ${config.gameType === 'report_incorrectness' ? 'Report Incorrectness' : 'Penalty on Miss'}`,
      `- **Player Mode:** ${config.mode === 'hvh' ? 'Human vs Human' : config.mode === 'hvbot' ? 'Human vs Bot' : 'Bot vs Bot'}`,
      ...(overlays.length > 0 ? [`- **Overlays:** ${overlays.join(', ')}`] : []),
    ].join('\n'),
  );

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
