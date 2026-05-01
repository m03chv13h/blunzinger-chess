using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlunzigerChess.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    AvatarUrl = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    CustomDisplayName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    CustomAvatarUrl = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    Provider = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    ProviderId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    IsGuest = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Games",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    MatchConfig = table.Column<string>(type: "TEXT", nullable: false),
                    GameStateJson = table.Column<string>(type: "TEXT", nullable: true),
                    Result = table.Column<string>(type: "TEXT", nullable: true),
                    Scores = table.Column<string>(type: "TEXT", nullable: true),
                    PositionHistory = table.Column<string>(type: "TEXT", nullable: true),
                    MoveHistory = table.Column<string>(type: "TEXT", nullable: true),
                    FinalFen = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    MoveCount = table.Column<int>(type: "INTEGER", nullable: false),
                    GameMode = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Games", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Games_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Simulations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ConfigJson = table.Column<string>(type: "TEXT", nullable: false),
                    GameCount = table.Column<int>(type: "INTEGER", nullable: false),
                    WhiteWins = table.Column<int>(type: "INTEGER", nullable: false),
                    BlackWins = table.Column<int>(type: "INTEGER", nullable: false),
                    Draws = table.Column<int>(type: "INTEGER", nullable: false),
                    CompletedGames = table.Column<int>(type: "INTEGER", nullable: false),
                    GamesJson = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Simulations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Simulations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MultiplayerRooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    HostUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GuestUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    MatchConfig = table.Column<string>(type: "TEXT", nullable: false),
                    CurrentGameState = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastActivityAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    GameId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MultiplayerRooms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MultiplayerRooms_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MultiplayerRooms_Users_GuestUserId",
                        column: x => x.GuestUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MultiplayerRooms_Users_HostUserId",
                        column: x => x.HostUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MatchmakingQueue",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PreferredConfig = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RoomId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchmakingQueue", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchmakingQueue_MultiplayerRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "MultiplayerRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MatchmakingQueue_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Games_CreatedAt",
                table: "Games",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Games_UserId",
                table: "Games",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchmakingQueue_JoinedAt",
                table: "MatchmakingQueue",
                column: "JoinedAt");

            migrationBuilder.CreateIndex(
                name: "IX_MatchmakingQueue_RoomId",
                table: "MatchmakingQueue",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchmakingQueue_Status",
                table: "MatchmakingQueue",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MatchmakingQueue_UserId",
                table: "MatchmakingQueue",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MultiplayerRooms_Code",
                table: "MultiplayerRooms",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MultiplayerRooms_GameId",
                table: "MultiplayerRooms",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_MultiplayerRooms_GuestUserId",
                table: "MultiplayerRooms",
                column: "GuestUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MultiplayerRooms_HostUserId",
                table: "MultiplayerRooms",
                column: "HostUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MultiplayerRooms_Status",
                table: "MultiplayerRooms",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Simulations_CreatedAt",
                table: "Simulations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Simulations_UserId",
                table: "Simulations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Provider_ProviderId",
                table: "Users",
                columns: new[] { "Provider", "ProviderId" },
                unique: true,
                filter: "ProviderId IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MatchmakingQueue");

            migrationBuilder.DropTable(
                name: "Simulations");

            migrationBuilder.DropTable(
                name: "MultiplayerRooms");

            migrationBuilder.DropTable(
                name: "Games");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
