import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RulesPage } from '../../components/RulesPage';

describe('RulesPage', () => {
  it('renders the Bot Engines & Difficulty section heading', () => {
    render(<RulesPage />);
    expect(screen.getByRole('heading', { name: /Bot Engines & Difficulty/i })).toBeInTheDocument();
  });

  it('shows Blunznforön engine heading', () => {
    render(<RulesPage />);
    expect(screen.getByRole('heading', { name: /Blunznforön/i })).toBeInTheDocument();
  });

  it('shows Blunznfish engine heading', () => {
    render(<RulesPage />);
    expect(screen.getByRole('heading', { name: /Blunznfish/i })).toBeInTheDocument();
  });

  it('shows Heuristic engine heading', () => {
    render(<RulesPage />);
    expect(screen.getByRole('heading', { name: /Heuristic/i })).toBeInTheDocument();
  });

  it('shows Violation Reporting heading', () => {
    render(<RulesPage />);
    expect(screen.getByRole('heading', { name: /Violation Reporting/i })).toBeInTheDocument();
  });

  it('shows difficulty table with search depth values', () => {
    render(<RulesPage />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Search Depth')).toBeInTheDocument();
    expect(screen.getByText('Quiescence')).toBeInTheDocument();
    expect(screen.getByText('Randomisation')).toBeInTheDocument();
  });
});
