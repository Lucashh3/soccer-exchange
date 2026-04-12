# Match — Dados Coletáveis

Classe: `sofascore_wrapper.match.Match`
Instância: `Match(api, match_id=<int>)`

---

## Métodos disponíveis

### 1. `total_games()`
Contagem de jogos de futebol hoje.

```python
# Endpoint: /sport/0/event-count
{
    "live": 21,
    "total": 270
}
```
**Útil para:** saber quantos jogos estão ao vivo agora.

---

### 2. `live_games()`
Todos os jogos de futebol atualmente ao vivo.

```python
# Endpoint: /sport/football/events/live
{
    "events": [
        {
            "tournament": { "name": "...", "id": 10066 },
            "season": { "name": "...", "year": "2025", "id": 68914 },
            "homeTeam": { "name": "Ecuador U20", "id": 33758 },
            "awayTeam": { "name": "Brazil U20", "id": 22672 },
            "homeScore": { "current": 0, "period1": 0 },
            "awayScore": { "current": 0, "period1": 0 },
            "status": { "code": 6, "description": "1st half", "type": "inprogress" },
            "time": { "currentPeriodStartTimestamp": 1738279810 },
            "startTimestamp": 1738279800,
            "id": 13123315
        }
    ]
}
```

---

### 3. `games_by_date(sport, date=None)`
Jogos agendados para uma data específica (default: hoje).

```python
# Endpoint: /sport/football/scheduled-events/YYYY-MM-DD
{
    "events": [
        {
            "tournament": { "name": "Premier League", "id": 1 },
            "homeTeam": { "name": "Arsenal", "id": 42 },
            "awayTeam": { "name": "Liverpool", "id": 44 },
            "homeScore": { "current": 0, "period1": 0, "period2": 0 },
            "awayScore": { "current": 0, "period1": 0, "period2": 0 },
            "status": { "type": "notstarted" },
            "startTimestamp": 1735330500,
            "id": 12436472,
            "slug": "arsenal-liverpool",
            "hasXg": false,
            "hasEventPlayerStatistics": false
        }
    ]
}
```
**Campos chave:** `id` (sofascoreId), `startTimestamp`, `status.type`, `hasXg`

---

### 4. `get_match()`
Informações completas da partida (inclui tudo: times, torneio, placar, status, etc).

```python
# Endpoint: /event/{match_id}
{
    "event": {
        "tournament": { ... },
        "season": { "name": "...", "year": "24/25", "id": 61627 },
        "roundInfo": { "round": 18 },
        "homeTeam": { "name": "Arsenal", "id": 42 },
        "awayTeam": { "name": "Liverpool", "id": 44 },
        "homeScore": { "current": 2, "period1": 1, "period2": 1 },
        "awayScore": { "current": 1, "period1": 0, "period2": 1 },
        "status": { "type": "finished", "code": 100 },
        "startTimestamp": 1735330500,
        "hasXg": true,
        "hasEventPlayerStatistics": true
    }
}
```

---

### 5. `pre_match_form()`
Forma recente dos dois times antes da partida.

```python
# Endpoint: /event/{match_id}/pregame-form
{
    "homeTeam": {
        "avgRating": "6.81",
        "position": 31,      # posição na tabela
        "value": "3",        # pontos
        "form": ["W", "L", "L", "L", "L"]
    },
    "awayTeam": {
        "avgRating": "7.08",
        "position": 3,
        "value": "16",
        "form": ["W", "L", "W", "W", "W"]
    },
    "label": "Pts"
}
```
**Campos chave:** `form` (últimas 5 partidas), `position` (posição na liga), `avgRating`

---

### 6. `h2h()`
Histórico head-to-head entre os dois times.

```python
# Endpoint: /event/{match_id}/h2h
{
    "teamDuel": {
        "homeWins": 5,
        "awayWins": 3,
        "draws": 2
    },
    "managerDuel": {
        "homeWins": 1,
        "awayWins": 1,
        "draws": 0
    }
}
```

---

### 7. `h2h_results(match_code)`
H2H detalhado com lista de partidas. Usar o `customId` (ex: `"xNbsDNb"`), não o ID numérico.

```python
# Endpoint: /event/{match_code}/h2h/events
# Retorna lista de eventos com placar completo
```

---

### 8. `incidents()`
Todos os incidentes da partida: gols, cartões, pênaltis, substituições, etc.

```python
# Endpoint: /event/{match_id}/incidents
{
    "incidents": [
        {
            "incidentType": "goal",     # ou "card", "substitution", "period", "inGamePenalty"
            "time": 45,
            "addedTime": 2,
            "timeSeconds": 2760,
            "homeScore": 1,
            "awayScore": 0,
            "isHome": true,
            "player": {
                "name": "Bukayo Saka",
                "id": 934235,
                "position": "M",
                "jerseyNumber": "7",
                "marketValueCurrency": "EUR",
                "proposedMarketValueRaw": { "value": 150000000, "currency": "EUR" }
            },
            "incidentClass": "regular",  # ou "ownGoal", "penalty", "missed"
            "reason": null               # para pênaltis: "goalkeeperSave", "missed"
        }
    ]
}
```
**Tipos de incidente:** `goal`, `card`, `substitution`, `period`, `inGamePenalty`, `varDecision`

---

### 9. `stats()`
Estatísticas completas da partida (por período).

```python
# Endpoint: /event/{match_id}/statistics
{
    "statistics": [
        {
            "period": "ALL",   # ou "1ST", "2ND"
            "groups": [
                {
                    "groupName": "Match overview",
                    "statisticsItems": [
                        { "name": "Ball possession", "home": "39%", "away": "61%", "homeValue": 39, "awayValue": 61 },
                        { "name": "Total shots", "home": "8", "away": "15", "homeValue": 8, "awayValue": 15 },
                        { "name": "Shots on target", "home": "3", "away": "7" },
                        { "name": "Corner kicks", "home": "4", "away": "7" },
                        { "name": "Offsides", "home": "2", "away": "1" },
                        { "name": "Fouls", "home": "11", "away": "9" },
                        { "name": "Yellow cards", "home": "2", "away": "1" },
                        { "name": "Red cards", "home": "0", "away": "0" },
                        { "name": "Expected goals", "home": "0.8", "away": "2.1" }
                    ]
                }
            ]
        }
    ]
}
```
**Grupos disponíveis:** Match overview, Shots, Passes, Duels, Goalkeeping

---

### 10. `shotmap(team_id=None)`
Mapa de finalizações da partida com coordenadas e xG.

```python
# Endpoint: /event/{match_id}/shotmap  ou  /event/{match_id}/shotmap/{team_id}
{
    "shotmap": [
        {
            "player": { "name": "Mikel Merino", "id": 592010 },
            "isHome": false,
            "shotType": "block",      # "goal", "save", "miss", "block"
            "situation": "assisted",  # "regular", "assisted", "set-piece", "counter"
            "bodyPart": "left-foot",  # "right-foot", "head"
            "playerCoordinates": { "x": 15.8, "y": 33.6, "z": 0 },
            "goalMouthLocation": "low-centre",
            "goalMouthCoordinates": { "x": 0, "y": 50.3, "z": 19 },
            "xg": 0.073,
            "xgot": 0,
            "time": 90,
            "addedTime": 4
        }
    ]
}
```

---

### 11. `heatmap(team_id)`
Mapa de calor de um time na partida (coordenadas x,y de atividade).

```python
# Endpoint: /event/{match_id}/heatmap/{team_id}
{
    "playerPoints": [
        { "x": 55.3, "y": 10.3 },
        { "x": 40.5, "y": 30.2 }
    ]
}
```

---

### 12. `lineups_home()` / `lineups_away()`
Escalações confirmadas de cada time.

```python
# Endpoint: /event/{match_id}/lineups
{
    "confirmed": true,
    "formation": "4-3-3",
    "player_colour": { "primary": "#cc0000", "number": "#ffffff", "outline": "#cc0000" },
    "goalkeeper_colour": { ... },
    "missing_players": [...],
    "starters": [
        {
            "player": {
                "name": "Pau López", "id": 548848,
                "position": "G", "jerseyNumber": "25",
                "height": 189,
                "country": { "name": "Spain", "alpha2": "ES" },
                "marketValueCurrency": "EUR",
                "proposedMarketValueRaw": { "value": 3700000, "currency": "EUR" },
                "dateOfBirthTimestamp": 787276800
            },
            "position": "G",
            "jerseyNumber": "25",
            "substitute": false
        }
    ],
    "substitutes": [...]
}
```

---

### 13. `managers()`
Técnicos dos dois times.

```python
# Endpoint: /event/{match_id}/managers
{
    "homeManager": { "name": "Michel", "slug": "michel", "id": 788163 },
    "awayManager": { "name": "Mikel Arteta", "slug": "mikel-arteta", "id": 794075 }
}
```

---

### 14. `match_odds()`
Odds completas de todos os mercados disponíveis.

```python
# Endpoint: /event/{match_id}/odds/1/all
{
    "markets": [
        {
            "marketId": 1,
            "marketName": "Full time",
            "isLive": false,
            "suspended": false,
            "choices": [
                { "name": "1", "fractionalValue": "9/2", "initialFractionalValue": "17/4", "winning": false, "change": 1 },
                { "name": "X", "fractionalValue": "31/10", "winning": false, "change": -1 },
                { "name": "2", "fractionalValue": "57/100", "winning": true, "change": 1 }
            ]
        }
    ]
}
```

---

### 15. `featured_odds()`
Odds destacadas: 1X2, Asian Handicap e Over/Under.

```python
# Endpoint: /event/{match_id}/odds/1/featured
{
    "featured": {
        "default":  { "marketName": "Full time", "choices": [...] },
        "asian":    { "marketName": "Asian handicap", "choices": [...] },
        "fullTime": { "marketName": "Full time", "choices": [...] }
    },
    "hasMoreOdds": true
}
```

---

### 16. `votes()`
Votos dos usuários do Sofascore sobre o resultado.

```python
# Endpoint: /event/{match_id}/votes
{
    "vote": { "vote1": 8779, "vote2": 98254, "voteX": 11223 },
    "bothTeamsToScoreVote": { "voteYes": 16294, "voteNo": 8891 },
    "firstTeamToScoreVote": { "voteHome": 2429, "voteNoGoal": 404, "voteAway": 20338 },
    "whoShouldHaveWonVote": { "vote1": 0, "vote2": 0 }
}
```

---

### 17. `win_probability()`
Probabilidade de vitória ao longo da partida (gráfico).

```python
# Endpoint: /event/{match_id}/graph/win-probability
# Retorna série temporal com probabilidades homeWin / draw / awayWin
```

---

### 18. `best_home_players()` / `best_away_players()`
Melhores jogadores avaliados na partida por time.

```python
# Endpoint: /event/{match_id}/best-players/summary
[
    {
        "value": "7.8",
        "label": "rating",
        "player": { "name": "Pau López", "id": 548848, "position": "G" }
    }
]
```

---

### 19. `motm()`
Man of the Match (jogador da partida).

```python
# Endpoint: /event/{match_id}/best-players/summary → campo "playerOfTheMatch"
{ "value": "8.5", "label": "rating", "player": { "name": "...", "id": 123 } }
```

---

### 20. `commentary()`
Comentários texto ao vivo da partida.

```python
# Endpoint: /event/{match_id}/comments
{
    "comments": [
        { "text": "Foul by Cristhian Stuani (Girona).", "type": "freeKickLost", "time": 96, "periodName": "2ND", "player": {...} },
        { "text": "Match ends, Girona 1, Arsenal 2.", "type": "matchEnded", "time": 0 }
    ]
}
```

---

### 21. `highlight()`
Links de vídeo de destaques (YouTube, etc).

```python
# Endpoint: /event/{match_id}/highlights
{
    "highlights": [
        {
            "title": "Girona FC 1-2 Arsenal",
            "subtitle": "Full Highlights",
            "url": "https://youtu.be/3C0wBjYhqLE",
            "thumbnailUrl": "https://i.ytimg.com/vi/.../hqdefault.jpg",
            "keyHighlight": true,
            "createdAtTimestamp": 1738195753
        }
    ]
}
```

---

### 22. `team_streaks()`
Sequências dos times na partida selecionada.

```python
# Endpoint: /event/{match_id}/team-streaks
```

---

### 23. `top_team_streaks()`
Melhores sequências de vitórias de times no geral.

```python
# Endpoint: /odds/top-team-streaks/wins/all
```

---

### 24. `match_channels()`
Canais de TV disponíveis por país para a partida.

```python
# Endpoint: /tv/event/{match_id}/country-channels
{
    "countryChannels": {
        "BR": [2781, 3025, 644],
        "EN": [1234, 5678]
    }
}
```
Usar `get_channel(channel_id)` para obter o nome de cada canal.
