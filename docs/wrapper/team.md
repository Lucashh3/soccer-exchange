# Team — Dados Coletáveis

Classe: `sofascore_wrapper.team.Team`
Instância: `Team(api, team_id=<int>)`

---

## Métodos disponíveis

### 1. `get_team()`
Informações completas do time: nome, liga, técnico, estádio, país, cor, data de fundação.

```python
# Endpoint: /team/{team_id}
{
    "team": {
        "name": "Arsenal",
        "slug": "arsenal",
        "shortName": "Arsenal",
        "nameCode": "ARS",
        "gender": "M",
        "national": false,
        "class": 4,
        "country": { "name": "England", "alpha2": "EN" },
        "venue": {
            "name": "Emirates Stadium",
            "city": { "name": "London" },
            "capacity": 60260,
            "venueCoordinates": { "latitude": 51.55504, "longitude": -0.1084 }
        },
        "manager": { "name": "Mikel Arteta", "id": 794075 },
        "tournament": { "name": "Premier League", "id": 17 },
        "primaryUniqueTournament": { "name": "Premier League", "id": 17 },
        "foundationDateTimestamp": -2627164800,
        "teamColors": { "primary": "#cc0000", "secondary": "#ffffff" },
        "pregameForm": {
            "avgRating": "7.04",
            "position": 2,
            "value": "47",
            "form": ["W", "D", "W", "D", "W"]
        }
    }
}
```

---

### 2. `image()`
URL da imagem/escudo do time.

```python
# Retorna: "https://img.sofascore.com/api/v1/team/{team_id}/image"
```

---

### 3. `performance()`
Lista de partidas recentes com resultados, placar por período e detalhes de torneio.

```python
# Endpoint: /team/{team_id}/performance
{
    "events": [
        {
            "tournament": { "name": "Premier League", "id": 1 },
            "season": { "name": "Premier League 24/25", "id": 61627 },
            "roundInfo": { "round": 18 },
            "homeTeam": { "name": "Arsenal", "id": 42 },
            "awayTeam": { "name": "Liverpool", "id": 44 },
            "homeScore": { "current": 2, "period1": 1, "period2": 1 },
            "awayScore": { "current": 1 },
            "status": { "type": "finished" },
            "winnerCode": 1
        }
    ]
}
```

---

### 4. `last_fixtures()`
Últimas partidas do time (usada internamente para calcular TeamStats). Retorna lista de eventos com placar e xG por partida.

```python
# Endpoint: /team/{team_id}/events/last/0
# Cada evento tem: homeTeam.id, awayTeam.id, homeScore, awayScore, homeAwayStats (com expectedGoals)
```
**Campos disponíveis em `homeAwayStats`:** `expectedGoals` por lado

---

### 5. `next_fixtures()`
Próximas partidas agendadas do time.

```python
# Endpoint: /team/{team_id}/events/next/0
# Mesma estrutura de eventos com startTimestamp, torneio, times adversários
```

---

### 6. `squad()`
Elenco completo do time com informações detalhadas de cada jogador.

```python
# Endpoint: /team/{team_id}/players
{
    "players": [
        {
            "player": {
                "name": "Bukayo Saka",
                "slug": "bukayo-saka",
                "shortName": "B. Saka",
                "position": "F",
                "jerseyNumber": "7",
                "height": 178,
                "dateOfBirthTimestamp": 994982400,
                "id": 934235,
                "country": { "name": "England" },
                "marketValueCurrency": "EUR",
                "proposedMarketValueRaw": { "value": 150000000, "currency": "EUR" }
            },
            "substitute": false
        }
    ]
}
```

---

### 7. `seasons()`
Todas as temporadas em que o time participou, por torneio.

```python
# Endpoint: /team/{team_id}/team-statistics/seasons
{
    "uniqueTournamentSeasons": [
        {
            "uniqueTournament": { "name": "Premier League", "id": 17 },
            "seasons": [
                { "name": "Premier League 24/25", "year": "24/25", "id": 61627 }
            ]
        },
        {
            "uniqueTournament": { "name": "UEFA Champions League", "id": 7 },
            "seasons": [ { "name": "UEFA Champions League 24/25", "id": 61644 } ]
        }
    ]
}
```
**Uso:** obter os IDs de temporada para chamar `league_stats()` e `top_players()`

---

### 8. `league_stats(league_id, season)`
Estatísticas COMPLETAS do time em uma liga/temporada específica. **Melhor fonte de dados agregados.**

```python
# Endpoint: /team/{team_id}/unique-tournament/{league_id}/season/{season}/statistics/overall
{
    "statistics": {
        "matches": 8,
        "goalsScored": 16,
        "goalsConceded": 3,
        "ownGoals": 0,
        "assists": 9,
        "shots": 107,
        "shotsOnTarget": 43,
        "shotsOffTarget": 35,
        "blockedScoringAttempt": 29,
        "bigChances": 27,
        "bigChancesCreated": 17,
        "bigChancesMissed": 15,
        "penaltyGoals": 2,
        "penaltiesTaken": 4,
        "freeKickGoals": 1,
        "headedGoals": 4,
        "goalsFromInsideTheBox": 13,
        "goalsFromOutsideTheBox": 2,
        "averageBallPossession": 53.375,
        "totalPasses": 3885,
        "accuratePasses": 3384,
        "accuratePassesPercentage": 87.1,
        "totalLongBalls": 154,
        "accurateLongBalls": 82,
        "totalCrosses": 140,
        "accurateCrosses": 42,
        "cleanSheets": 5,
        "tackles": 136,
        "interceptions": 57,
        "saves": 17,
        "clearances": 100,
        "fouls": 88,
        "yellowCards": 12,
        "redCards": 0,
        "offsides": 13,
        "corners": 51,
        "successfulDribbles": 79,
        "totalDuels": 735,
        "duelsWon": 380,
        "aerialDuelsWon": 102,
        "avgRating": 7.07,
        "errorsLeadingToGoal": 1,
        "hitWoodwork": 2,
        "fastBreaks": 3,
        "ballRecovery": 339,
        "throwIns": 119,
        "goalKicks": 41,
        "freeKicks": 65,
        // ... + métricas "Against" (o que o adversário fez contra esse time)
        "shotsAgainst": 72,
        "bigChancesAgainst": 5,
        "cornersAgainst": 27
    }
}
```
**Nota:** Inclui tanto métricas ofensivas quanto defensivas (sufixo `Against`).

---

### 9. `top_players(league_id, season)`
Melhores jogadores do time por categoria (rating, gols, assistências, etc).

```python
# Endpoint: /team/{team_id}/unique-tournament/{league_id}/season/{season}/top-players/overall
{
    "topPlayers": {
        "rating": [
            {
                "statistics": { "rating": 7.8, "appearances": 5 },
                "player": { "name": "Bukayo Saka", "id": 934235 }
            }
        ],
        "goals": [...],
        "assists": [...]
    }
}
```

---

### 10. `transfers_in()`
Histórico de transferências recebidas.

```python
# Endpoint: /team/{team_id}/transfers → transfersIn
[
    {
        "player": { "name": "Charles Sagoe Jr.", "id": 1119436, "position": "F" },
        "transferFrom": { "name": "Shrewsbury Town", "id": 82 },
        "transferTo": { "name": "Arsenal", "id": 42 },
        "transferFee": 0,
        "transferFeeDescription": "-",
        "transferFeeRaw": { "value": 0, "currency": "EUR" },
        "transferDateTimestamp": 1736121600,
        "type": 2   # 1=permanente, 2=empréstimo
    }
]
```

---

### 11. `transfers_out()`
Histórico de transferências enviadas (mesmo formato de `transfers_in`).

---

### 12. `latest_highlights()`
Vídeos de destaque mais recentes envolvendo o time.

```python
# Endpoint: /team/{team_id}/media
{
    "media": [
        {
            "title": "Wolves 0 - 1 Arsenal",
            "url": "https://youtu.be/...",
            "thumbnailUrl": "...",
            "keyHighlight": true
        }
    ]
}
```

---

### 13. `performance_graph(league_id, season)`
Gráfico de desempenho do time ao longo da temporada.

```python
# Endpoint: /team/{team_id}/unique-tournament/{league_id}/season/{season}/performance
```

---

### 14. `near_events()`
Partidas próximas (passadas e futuras) do time.

```python
# Endpoint: /team/{team_id}/near-events
```
