/**
 * Blunznforön bot — difficulty level configurations.
 *
 * Each level tunes search depth, randomization, and tactical extensions
 * to produce distinctly different playing strengths.
 */

import type { BlunznforonConfig, BlunznforonLevel } from './types';

const CONFIGS: Record<BlunznforonLevel, BlunznforonConfig> = {
  easy: {
    searchDepth: 1,
    quiescenceDepth: 0,
    randomMarginCp: 200,
    violationProbability: 0.25,
    useTacticalExtensions: false,
  },
  medium: {
    searchDepth: 2,
    quiescenceDepth: 1,
    randomMarginCp: 50,
    violationProbability: 0,
    useTacticalExtensions: false,
  },
  hard: {
    searchDepth: 3,
    quiescenceDepth: 2,
    randomMarginCp: 10,
    violationProbability: 0,
    useTacticalExtensions: true,
  },
};

export function getBlunznforonConfig(level: BlunznforonLevel): BlunznforonConfig {
  return CONFIGS[level];
}
