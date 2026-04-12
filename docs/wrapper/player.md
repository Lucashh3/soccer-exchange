# Player — Dados Coletáveis

Classes: `sofascore_wrapper.player.Player` e `sofascore_wrapper.player.PlayerSearch`

---

## PlayerSearch

### `search_player(query)`
Busca jogador por nome.

```python
PlayerSearch(api, query="cole palmer").search_player()
# Endpoint: /search/players/{query}
{
    "players": [
        {
            "name": "Cole Palmer",
            "slug": "cole-palmer",
            "shortName": "C. Palmer",
            "position": "M",
            "jerseyNumber": "20",
            "id": 982780,
            "dateOfBirthTimestamp": 1020643200,
            "team": { "name": "Chelsea", "id": 38 }
        }
    ]
}
```

---

## Player

Instância: `Player(api, player_id=<int>)`

---

### 1. `get_player()`
Informações completas do jogador.

```python
# Endpoint: /player/{player_id}
{
    "player": {
        "name": "Bukayo Saka",
        "firstName": "Bukayo",
        "lastName": "Saka",
        "slug": "bukayo-saka",
        "shortName": "B. Saka",
        "position": "F",
        "jerseyNumber": "7",
        "height": 178,
        "weight": 70,
        "dateOfBirthTimestamp": 994982400,
        "id": 934235,
        "country": { "name": "England", "alpha2": "EN" },
        "nationality": { "name": "England" },
        "team": { "name": "Arsenal", "id": 42 },
        "marketValueCurrency": "EUR",
        "proposedMarketValueRaw": { "value": 150000000, "currency": "EUR" },
        "contract": { "contractUntilTimestamp": 1814140800 }
    }
}
```

---

### 2. `attributes()`
Atributos físicos/técnicos do jogador (escala 0–100).

```python
# Endpoint: /player/{player_id}/attribute-overviews
{
    "averageAttributeOverviews": [
        {
            "attacking": 62,
            "technical": 54,
            "tactical": 44,
            "defending": 32,
            "creativity": 47,
            "position": "F",
            "yearShift": 0
        }
    ],
    "playerAttributeOverviews": [
        {
            "attacking": 85,
            "technical": 77,
            "tactical": 58,
            "defending": 35,
            "creativity": 80,
            "position": "F",
            "yearShift": 0
        }
    ]
}
```

---

### 3. `league_stats(league_id, season)`
Estatísticas do jogador em uma liga/temporada. **Dados individuais mais completos disponíveis.**

```python
# Endpoint: /player/{player_id}/unique-tournament/{league_id}/season/{season}/statistics/overall
{
    "statistics": {
        "rating": 6.9,
        "goals": 0,
        "assists": 0,
        "expectedAssists": 0.145,
        "minutesPlayed": 327,
        "matchesStarted": 4,
        "totalPasses": 143,
        "accuratePasses": 127,
        "accuratePassesPercentage": 88.8,
        "keyPasses": 2,
        "accurateCrosses": 1,
        "totalShots": 4,
        "shotsOnTarget": 1,
        "successfulDribbles": 2,
        "successfulDribblesPercentage": 50,
        "tackles": 10,
        "interceptions": 3,
        "yellowCards": 1,
        "redCards": 0,
        "groundDuelsWon": 15,
        "groundDuelsWonPercentage": 46.9,
        "aerialDuelsWon": 3,
        "aerialDuelsWonPercentage": 50,
        "totalDuelsWon": 18,
        "totalDuelsWonPercentage": 47.4,
        "goalsFromInsideTheBox": 0,
        "goalsFromOutsideTheBox": 0,
        "headedGoals": 0,
        "penaltyGoals": 0,
        "penaltiesTaken": 0,
        "freeKickGoal": 0,
        "bigChancesCreated": 0,
        "bigChancesMissed": 0,
        "clearances": 7,
        "saves": 0,
        "cleanSheet": 1,
        "errorLeadToGoal": 0,
        "touches": 211,
        "wasFouled": 3,
        "fouls": 5,
        "offsides": 1,
        "dispossessed": 4,
        "possessionLost": 30,
        "hitWoodwork": 0,
        "accurateLongBalls": 1,
        "totalChippedPasses": 3,
        "goalConversionPercentage": 0,
        "passToAssist": 0,
        "dribbledPast": 6,
        "blockedShots": 0,
        "totalAttemptAssist": 2,
        "penaltyFaced": 0,
        "penaltySave": 0
    }
}
```

---

### 4. `last_fixtures()`
Últimas partidas do jogador com placar e detalhes.

```python
# Endpoint: /player/{player_id}/events/last/0
# Lista de eventos: mesma estrutura de games_by_date mas filtrado pelo jogador
```

---

### 5. `transfer_history()`
Histórico de transferências do jogador ao longo da carreira.

```python
# Endpoint: /player/{player_id}/transfer-history
{
    "transferHistory": [
        {
            "transferFrom": { "name": "Manchester City", "id": 17 },
            "transferTo": { "name": "Arsenal", "id": 42 },
            "transferFeeRaw": { "value": 45000000, "currency": "EUR" },
            "transferDateTimestamp": 1691366400,
            "type": 1
        }
    ]
}
```

---

### 6. `national_stats()`
Estatísticas do jogador pela seleção nacional.

```python
# Endpoint: /player/{player_id}/national-team-statistics
```

---

### 7. `player_seasons(player_id)`
Todas as temporadas em que o jogador atuou, com IDs de liga e temporada.

```python
# Endpoint: /player/{player_id}/statistics/seasons
```

---

### 8. `player_leagues(player_id)`
Todas as ligas em que o jogador atuou.

```python
# Endpoint: /player/{player_id}/statistics/seasons
```

---

### 9. `image()`
URL da foto do jogador.

```python
# Retorna: "https://img.sofascore.com/api/v1/player/{player_id}/image"
```
