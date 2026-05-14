# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy proto files (needed for gRPC client generation)
COPY backend/proto/ backend/proto/

# Copy project files and restore
COPY backend/dotnet-api/BlunzingerChess.Api/BlunzingerChess.Api.csproj backend/dotnet-api/BlunzingerChess.Api/
COPY backend/aspire/BlunzingerChess.ServiceDefaults/BlunzingerChess.ServiceDefaults.csproj backend/aspire/BlunzingerChess.ServiceDefaults/
RUN dotnet restore backend/dotnet-api/BlunzingerChess.Api/BlunzingerChess.Api.csproj

# Copy source and build
COPY backend/dotnet-api/BlunzingerChess.Api/ backend/dotnet-api/BlunzingerChess.Api/
COPY backend/aspire/BlunzingerChess.ServiceDefaults/ backend/aspire/BlunzingerChess.ServiceDefaults/
RUN dotnet publish backend/dotnet-api/BlunzingerChess.Api/BlunzingerChess.Api.csproj -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0
RUN apt-get update && apt-get install -y --no-install-recommends libkrb5-3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
# CONNECTION_STRING: external PostgreSQL connection URI (postgres://user:pass@host:port/db)
# Supplied at runtime via secret; overrides appsettings ConnectionStrings:DefaultConnection
EXPOSE 8080

ENTRYPOINT ["dotnet", "BlunzingerChess.Api.dll"]
