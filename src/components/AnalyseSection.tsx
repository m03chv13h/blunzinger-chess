import type { GameSetupConfig } from '../core/blunzinger/types';
import { AnalysePositionForm } from './AnalysePositionForm';
import './AnalyseSection.css';

interface AnalyseSectionProps {
  onStartAnalysis: (config: GameSetupConfig) => void;
}

export function AnalyseSection({
  onStartAnalysis,
}: AnalyseSectionProps) {
  return (
    <div className="analyse-section">
      <div className="analyse-card">
        <h2>📊 Analyse</h2>
        <p className="analyse-subtitle">
          Analyse a specific position using the form below.
        </p>
        <AnalysePositionForm onStartAnalysis={onStartAnalysis} />
      </div>
    </div>
  );
}
