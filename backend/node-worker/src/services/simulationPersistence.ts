import type { GameRecord } from '../../../../src/core/gameRecord.js';
import type { GameSetupConfig } from '../../../../src/core/blunzinger/types.js';
import type { RestorableSimulationJob } from './simulation.js';

interface OpenSimulationRow {
  id: string;
  configJson: string;
  gameCount: number;
  gamesJson: string | null;
}

const OPEN_SIMULATIONS_QUERY = `
SELECT
  "Id" AS id,
  "ConfigJson" AS "configJson",
  "GameCount" AS "gameCount",
  "GamesJson" AS "gamesJson"
FROM "Simulations"
WHERE "CompletedAt" IS NULL
ORDER BY "CreatedAt" ASC
`;

type PgClient = {
  connect: () => Promise<void>;
  query: <T>(sql: string) => Promise<{ rows: T[] }>;
  end: () => Promise<void>;
};

type PgModule = {
  Client: new (config: { connectionString: string }) => PgClient;
};

const importPg = new Function('return import("pg")') as () => Promise<PgModule>;

function parseJsonOrNull<T>(json: string, fallbackValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallbackValue;
  }
}

function parseCompletedRecords(gamesJson: string | null, maxCount: number): GameRecord[] {
  if (!gamesJson) {
    return [];
  }

  const parsed = parseJsonOrNull<unknown>(gamesJson, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.slice(0, maxCount) as GameRecord[];
}

export function mapOpenSimulationRows(rows: readonly OpenSimulationRow[]): RestorableSimulationJob[] {
  const jobs: RestorableSimulationJob[] = [];

  for (const row of rows) {
    const simulationId = row.id?.trim();
    if (!simulationId) {
      continue;
    }

    const rawConfig = parseJsonOrNull<unknown>(row.configJson, null);
    if (!rawConfig || typeof rawConfig !== 'object') {
      continue;
    }

    const totalGames = Math.max(1, Math.min(row.gameCount, 200));
    const completedRecords = parseCompletedRecords(row.gamesJson, totalGames);

    if (completedRecords.length >= totalGames) {
      continue;
    }

    jobs.push({
      simulationId,
      config: rawConfig as GameSetupConfig,
      totalGames,
      completedRecords,
    });
  }

  return jobs;
}

export async function loadOpenSimulationJobs(
  connectionString = process.env.CONNECTION_STRING ?? '',
): Promise<RestorableSimulationJob[]> {
  if (!connectionString.trim()) {
    return [];
  }

  const { Client } = await importPg();
  const client = new Client({ connectionString });

  await client.connect();
  try {
    const result = await client.query<OpenSimulationRow>(OPEN_SIMULATIONS_QUERY);
    return mapOpenSimulationRows(result.rows);
  } finally {
    await client.end();
  }
}
