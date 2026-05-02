/** Cloudflare Worker environment bindings */
export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  SCHEDULER: DurableObjectNamespace;

  // Secrets (set via `wrangler secret put`)
  JWT_SECRET: string;
  OAUTH_GOOGLE_CLIENT_ID?: string;
  OAUTH_GOOGLE_CLIENT_SECRET?: string;
  OAUTH_GITHUB_CLIENT_ID?: string;
  OAUTH_GITHUB_CLIENT_SECRET?: string;
  OAUTH_DISCORD_CLIENT_ID?: string;
  OAUTH_DISCORD_CLIENT_SECRET?: string;
  OAUTH_MICROSOFT_CLIENT_ID?: string;
  OAUTH_MICROSOFT_CLIENT_SECRET?: string;

  // Vars
  FRONTEND_URL: string;
}

/** Room status enum matching the D1 schema */
export enum RoomStatus {
  Waiting = 0,
  Playing = 1,
  Finished = 2,
  Cancelled = 3,
}

/** Matchmaking status enum */
export enum MatchmakingStatus {
  Queued = 0,
  Matched = 1,
  Cancelled = 2,
  Expired = 3,
}

/** User row from D1 */
export interface UserRow {
  Id: string;
  DisplayName: string;
  Email: string | null;
  AvatarUrl: string | null;
  CustomDisplayName: string | null;
  CustomAvatarUrl: string | null;
  Provider: string;
  ProviderId: string | null;
  IsGuest: number;
  CreatedAt: string;
}

/** Game row from D1 */
export interface GameRow {
  Id: string;
  UserId: string | null;
  MatchConfig: string;
  GameStateJson: string | null;
  Result: string | null;
  Scores: string | null;
  PositionHistory: string | null;
  MoveHistory: string | null;
  FinalFen: string | null;
  MoveCount: number;
  GameMode: string;
  CreatedAt: string;
  CompletedAt: string | null;
}

/** Simulation row from D1 */
export interface SimulationRow {
  Id: string;
  UserId: string | null;
  ConfigJson: string;
  GameCount: number;
  WhiteWins: number;
  BlackWins: number;
  Draws: number;
  CompletedGames: number;
  GamesJson: string;
  CreatedAt: string;
  CompletedAt: string | null;
}

/** Multiplayer room row from D1 */
export interface RoomRow {
  Id: string;
  Code: string;
  HostUserId: string;
  GuestUserId: string | null;
  MatchConfig: string;
  CurrentGameState: string | null;
  Status: number;
  CreatedAt: string;
  LastActivityAt: string | null;
  GameId: string | null;
}

/** JWT payload structure */
export interface JwtPayload {
  sub: string; // user ID
  name: string;
  is_guest: string;
  provider: string;
  email?: string;
  exp: number;
  iss: string;
  aud: string;
}
