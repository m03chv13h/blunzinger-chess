import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalyseSection } from '../../components/AnalyseSection';

describe('AnalyseSection', () => {
  it('shows analyse heading', () => {
    render(
      <AnalyseSection onStartAnalysis={() => {}} />,
    );
    expect(screen.getByText('📊 Analyse')).toBeInTheDocument();
  });

  it('shows analyse position form', () => {
    render(
      <AnalyseSection onStartAnalysis={() => {}} />,
    );
    expect(screen.getByText(/Analyse Position/)).toBeInTheDocument();
  });

  it('shows subtitle', () => {
    render(
      <AnalyseSection onStartAnalysis={() => {}} />,
    );
    expect(screen.getByText(/Analyse a specific position/)).toBeInTheDocument();
  });

  it('does not show simulations section', () => {
    render(
      <AnalyseSection onStartAnalysis={() => {}} />,
    );
    expect(screen.queryByText('🔬 Simulations')).not.toBeInTheDocument();
  });
});
