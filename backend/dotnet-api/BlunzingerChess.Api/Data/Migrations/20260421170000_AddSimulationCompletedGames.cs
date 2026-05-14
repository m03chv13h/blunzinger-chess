using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlunzingerChess.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSimulationCompletedGames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CompletedGames",
                table: "Simulations",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedGames",
                table: "Simulations");
        }
    }
}
