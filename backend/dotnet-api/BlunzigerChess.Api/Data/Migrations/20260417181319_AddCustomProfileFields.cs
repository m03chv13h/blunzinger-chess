using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlunzigerChess.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomAvatarUrl",
                table: "Users",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomDisplayName",
                table: "Users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomAvatarUrl",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CustomDisplayName",
                table: "Users");
        }
    }
}
