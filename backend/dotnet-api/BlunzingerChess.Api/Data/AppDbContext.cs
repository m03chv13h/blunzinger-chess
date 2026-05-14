using Microsoft.EntityFrameworkCore;
using BlunzingerChess.Api.Models;

namespace BlunzingerChess.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Simulation> Simulations => Set<Simulation>();
    public DbSet<MultiplayerRoom> MultiplayerRooms => Set<MultiplayerRoom>();
    public DbSet<MatchmakingEntry> MatchmakingQueue => Set<MatchmakingEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.Provider, e.ProviderId })
                  .IsUnique()
                  .HasFilter("\"ProviderId\" IS NOT NULL");
        });

        // Game
        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Games)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Simulation
        modelBuilder.Entity<Simulation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // MultiplayerRoom
        modelBuilder.Entity<MultiplayerRoom>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.HasOne(e => e.Host)
                  .WithMany()
                  .HasForeignKey(e => e.HostUserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Guest)
                  .WithMany()
                  .HasForeignKey(e => e.GuestUserId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.Game)
                  .WithMany()
                  .HasForeignKey(e => e.GameId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // MatchmakingEntry
        modelBuilder.Entity<MatchmakingEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.JoinedAt);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Room)
                  .WithMany()
                  .HasForeignKey(e => e.RoomId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
