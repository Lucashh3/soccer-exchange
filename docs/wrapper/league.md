# League — Dados Coletáveis

Classe: `sofascore_wrapper.league.League`
Instância: `League(api, league_id=<int>)`

---

## Métodos disponíveis

### 1. `get_league()`
Informações básicas da liga.

```python
# Endpoint: /unique-tournament/{league_id}
{
    "uniqueTournament": {
        "name": "Premier League",
        "slug": "premier-league",
        "id": 17,
        "primaryColorHex": "#3c1c5a",
        "category": { "name": "England", "id": 1 },
        "userCount": 1361165,
        "hasPerformanceGraphFeature": true,
        "hasEventPlayerStatistics": true
    }
}
```

---

### 2. `get_seasons()`
Todas as temporadas disponíveis da liga.

```python
# Endpoint: /unique-tournament/{league_id}/seasons
[
    { "name": "Premier League 24/25", "year": "24/25", "id": 61627 },
    { "name": "Premier League 23/24", "year": "23/24", "id": 52186 }
]
```
**Uso:** Obter os `season_id` para usar nos outros métodos.

---

### 3. `current_season()`
Temporada atual da liga.

```python
# Endpoint: /unique-tournament/{league_id}/seasons → primeiro item
{ "name": "Premier League 24/25", "year": "24/25", "id": 61627 }
```

---

### 4. `get_info(season)`
Informações gerais da liga em uma temporada específica.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/info
```

---

### 5. `standings(season)`
Tabela de classificação completa.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/standings/total
{
    "standings": [
        {
            "rows": [
                {
                    "team": { "name": "Arsenal", "id": 42 },
                    "position": 1,
                    "matches": 20,
                    "wins": 15,
                    "draws": 3,
                    "losses": 2,
                    "scoresFor": 42,
                    "scoresAgainst": 18,
                    "points": 48,
                    "id": 12345
                }
            ]
        }
    ]
}
```

---

### 6. `standings_home(season)`
Tabela de classificação apenas por jogos em casa.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/standings/home
# Mesma estrutura de standings()
```

---

### 7. `standings_away(season)`
Tabela de classificação apenas por jogos fora de casa.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/standings/away
```

---

### 8. `top_players(season)`
Melhores jogadores da liga na temporada (por rating, gols, assistências).

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/top-players/overall
{
    "topPlayers": {
        "rating": [...],
        "goals": [...],
        "assists": [...],
        "cleanSheets": [...]
    }
}
```

---

### 9. `top_teams(season)`
Melhores times da liga na temporada (por gols, posse, etc).

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/top-teams/overall
```

---

### 10. `top_players_per_game(season)`
Melhores jogadores por partida na temporada.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/top-players-per-game/overall
```

---

### 11. `rounds(season)`
Rodadas disponíveis da temporada.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/rounds
```

---

### 12. `current_round(season)`
Rodada atual da temporada (retorna int).

---

### 13. `fixtures(season, round)`
Partidas de uma rodada específica.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/events/round/{round}
{
    "events": [...]  # lista de eventos com times, placar, status, kickoff
}
```

---

### 14. `next_fixtures()`
Próximas partidas da liga (rodada seguinte).

```python
# Endpoint: /unique-tournament/{league_id}/events/next/0
```

---

### 15. `last_fixtures()`
Últimas partidas já realizadas da liga.

```python
# Endpoint: /unique-tournament/{league_id}/events/last/0
```

---

### 16. `featured_games()`
Partidas em destaque da liga (escolhidas pelo Sofascore).

```python
# Endpoint: /unique-tournament/{league_id}/featured-events
```

---

### 17. `totw_rounds(season)` / `totw(season, round)`
Time da semana (Team of the Week) por rodada.

```python
# Endpoints:
#   /unique-tournament/{league_id}/season/{season}/team-of-the-week/rounds
#   /unique-tournament/{league_id}/season/{season}/team-of-the-week/{round}
{
    "teamOfTheWeek": {
        "players": [
            { "player": { "name": "...", "id": 123 }, "position": "G", "rating": 8.5 }
        ]
    }
}
```

---

### 18. `player_of_the_season(season)`
Jogador da temporada eleito pelo Sofascore.

```python
# Endpoint: /unique-tournament/{league_id}/season/{season}/best-players
```

---

### 19. `get_latest_highlights()`
Vídeos de destaque mais recentes da liga.

```python
# Endpoint: /unique-tournament/{league_id}/media
```

---

### 20. `cup_tree(season_id)`
Chaveamento de torneios eliminatórios (copa).

```python
# Endpoint: /unique-tournament/{league_id}/season/{season_id}/cup-trees/0
```

---

### 21. `cup_fixtures_per_round(season_id, round_id)`
Partidas de uma fase específica de um torneio eliminatório.

---

### 22. `league_fixtures_per_round(season_id, round_id)`
Partidas de uma rodada em formato de liga.

---

## IDs das ligas monitoradas no projeto

| Liga | ID |
|------|----|
| Premier League | 17 |
| La Liga | 8 |
| Serie A | 23 |
| Bundesliga | 35 |
| Ligue 1 | 34 |
| Champions League | 7 |
| Brasileirao | 325 |

> Ver lista completa em `scraper-service/league_ids.py`
