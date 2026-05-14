using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlunzingerChess.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLastActivityAtToRoom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastActivityAt",
                table: "MultiplayerRooms",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastActivityAt",
                table: "MultiplayerRooms");
        }
    }
}
