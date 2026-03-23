/**
 * Engine registry — discovers and manages available engine adapters.
 *
 * All engine registration happens eagerly at import time so that the UI
 * can enumerate available engines without side effects.
 */

import type { EngineId, EngineInfo, VariantEngineAdapter } from './types';
import { createHeuristicAdapter } from './adapters/heuristicAdapter';
import { createBlunznforönAdapter } from './adapters/blunznforönAdapter';

// ── Factory type ─────────────────────────────────────────────────────

type AdapterFactory = () => VariantEngineAdapter;

// ── Internal registry ────────────────────────────────────────────────

const factories = new Map<EngineId, AdapterFactory>();
const infoMap = new Map<EngineId, EngineInfo>();

function register(factory: AdapterFactory): void {
  const adapter = factory();
  factories.set(adapter.info.id, factory);
  infoMap.set(adapter.info.id, adapter.info);
  adapter.dispose(); // we only wanted the info; release immediately
}

// ── Register built-in engines ────────────────────────────────────────

register(createHeuristicAdapter);
register(createBlunznforönAdapter);

// Blunznfish — placeholder, not yet implemented.
infoMap.set('blunznfish', {
  id: 'blunznfish',
  name: 'Blunznfish',
  description: 'Custom Blunziger-native engine (coming soon)',
  availability: 'coming_soon',
  supportsEvaluation: false,
  supportsBotPlay: false,
  supportsVariantAwareness: false,
});

// ── Public API ───────────────────────────────────────────────────────

/** Return metadata for all registered engines (available, unavailable, and coming_soon). */
export function getAllEngineInfos(): EngineInfo[] {
  return Array.from(infoMap.values());
}

/** Return metadata for a specific engine. */
export function getEngineInfo(id: EngineId): EngineInfo | undefined {
  return infoMap.get(id);
}

/** Return only engines that are currently available for use. */
export function getAvailableEngineInfos(): EngineInfo[] {
  return getAllEngineInfos().filter((e) => e.availability === 'available');
}

/** Create a fresh adapter instance for the given engine id. */
export function createEngineAdapter(id: EngineId): VariantEngineAdapter {
  const factory = factories.get(id);
  if (!factory) {
    throw new Error(`Engine "${id}" is not registered or not available.`);
  }
  return factory();
}

/** The default engine used when no explicit selection is made. */
export const DEFAULT_ENGINE_ID: EngineId = 'heuristic';
