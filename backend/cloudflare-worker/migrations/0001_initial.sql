-- Blunziger Chess D1 Schema
-- Cloudflare D1 (SQLite-compatible)

CREATE TABLE IF NOT EXISTS Users (
  Id TEXT PRIMARY KEY,
  DisplayName TEXT NOT NULL DEFAULT '',
  Email TEXT,
  AvatarUrl TEXT,
  CustomDisplayName TEXT,
  CustomAvatarUrl TEXT,
  Provider TEXT NOT NULL DEFAULT 'guest',
  ProviderId TEXT,
  IsGuest INTEGER NOT NULL DEFAULT 1,
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_Provider_ProviderId
  ON Users (Provider, ProviderId) WHERE ProviderId IS NOT NULL;

CREATE TABLE IF NOT EXISTS Games (
  Id TEXT PRIMARY KEY,
  UserId TEXT,
  MatchConfig TEXT NOT NULL DEFAULT '{}',
  GameStateJson TEXT,
  Result TEXT,
  Scores TEXT,
  PositionHistory TEXT,
  MoveHistory TEXT,
  FinalFen TEXT,
  MoveCount INTEGER NOT NULL DEFAULT 0,
  GameMode TEXT NOT NULL DEFAULT 'local',
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  CompletedAt TEXT,
  FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS IX_Games_UserId ON Games (UserId);
CREATE INDEX IF NOT EXISTS IX_Games_CreatedAt ON Games (CreatedAt);

CREATE TABLE IF NOT EXISTS Simulations (
  Id TEXT PRIMARY KEY,
  UserId TEXT,
  ConfigJson TEXT NOT NULL DEFAULT '{}',
  GameCount INTEGER NOT NULL DEFAULT 0,
  WhiteWins INTEGER NOT NULL DEFAULT 0,
  BlackWins INTEGER NOT NULL DEFAULT 0,
  Draws INTEGER NOT NULL DEFAULT 0,
  CompletedGames INTEGER NOT NULL DEFAULT 0,
  GamesJson TEXT NOT NULL DEFAULT '[]',
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  CompletedAt TEXT,
  FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS IX_Simulations_UserId ON Simulations (UserId);
CREATE INDEX IF NOT EXISTS IX_Simulations_CreatedAt ON Simulations (CreatedAt);

CREATE TABLE IF NOT EXISTS MultiplayerRooms (
  Id TEXT PRIMARY KEY,
  Code TEXT NOT NULL UNIQUE,
  HostUserId TEXT NOT NULL,
  GuestUserId TEXT,
  MatchConfig TEXT NOT NULL DEFAULT '{}',
  CurrentGameState TEXT,
  Status INTEGER NOT NULL DEFAULT 0,
  CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  LastActivityAt TEXT,
  GameId TEXT,
  FOREIGN KEY (HostUserId) REFERENCES Users(Id) ON DELETE CASCADE,
  FOREIGN KEY (GuestUserId) REFERENCES Users(Id) ON DELETE SET NULL,
  FOREIGN KEY (GameId) REFERENCES Games(Id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS IX_MultiplayerRooms_Code ON MultiplayerRooms (Code);
CREATE INDEX IF NOT EXISTS IX_MultiplayerRooms_Status ON MultiplayerRooms (Status);

CREATE TABLE IF NOT EXISTS MatchmakingQueue (
  Id TEXT PRIMARY KEY,
  UserId TEXT NOT NULL,
  PreferredConfig TEXT NOT NULL DEFAULT '{}',
  Status INTEGER NOT NULL DEFAULT 0,
  JoinedAt TEXT NOT NULL DEFAULT (datetime('now')),
  RoomId TEXT,
  FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
  FOREIGN KEY (RoomId) REFERENCES MultiplayerRooms(Id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS IX_MatchmakingQueue_Status ON MatchmakingQueue (Status);
CREATE INDEX IF NOT EXISTS IX_MatchmakingQueue_JoinedAt ON MatchmakingQueue (JoinedAt);
