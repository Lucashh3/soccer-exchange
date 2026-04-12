# SofaScore API — Guia de Integração

> Como buscar dados de partidas via `sofascore-wrapper` (Playwright/Chromium).
> Este guia cobre **apenas as 3 chamadas necessárias por partida** para um modelo de análise de jogo.

---

## Como funciona

A SofaScore não tem uma API pública oficial. O acesso é feito via scraping com Playwright:

```
sofascore_wrapper → Chromium headless → sofascore.com
```

Cada partida é identificada por um **`match_id` numérico** (ex: `15235513`).
Para encontrar o match_id de uma partida, use o endpoint `/matches/today` ou a URL da SofaScore:
`https://www.sofascore.com/pt/chapecoense-vitoria/Tsb#id:15235513` → o número no final é o `match_id`.

---

## Setup

```bash
pip install sofascore-wrapper playwright
python -m playwright install chromium
```

```python
from sofascore_wrapper.api import SofascoreAPI
from sofascore_wrapper.match import Match

api = SofascoreAPI()
match = Match(api, match_id=15235513)
```

---

## As 3 chamadas por partida

### 1. INCIDENTS — Linha do tempo

```python
data = await match.incidents()
incidents = data.get("incidents", [])
```

**O que retorna:**

```json
{
  "incidents": [
    {
      "incidentType": "goal",
      "incidentClass": "regular",
      "time": 23,
      "isHome": true,
      "homeScore": 1,
      "awayScore": 0,
      "player": { "name": "João Silva", "shortName": "J. Silva" },
      "assist1": { "name": "Pedro Rocha", "shortName": "P. Rocha" }
    },
    {
      "incidentType": "card",
      "incidentClass": "yellow",
      "time": 37,
      "isHome": false,
      "player": { "name": "Carlos Lima", "shortName": "C. Lima" }
    },
    {
      "incidentType": "card",
      "incidentClass": "red",
      "time": 38,
      "isHome": false,
      "player": { "name": "Edínilson", "shortName": "Edínilson" }
    }
  ]
}
```

**Campos úteis:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `incidentType` | string | `"goal"`, `"card"`, `"substitution"`, `"varDecision"`, `"period"` |
| `incidentClass` | string | Para cards: `"yellow"`, `"red"`, `"yellowRed"`. Para gols: `"regular"`, `"ownGoal"`, `"penalty"` |
| `time` | int | Minuto do evento |
| `isHome` | bool | `true` = mandante, `false` = visitante |
| `homeScore` / `awayScore` | int | Placar **após** o evento (só em gols) |
| `player.shortName` | string | Nome curto do jogador |
| `assist1.shortName` | string | Nome do assistente (só em gols) |

**Filtro recomendado** — só o que o modelo usa:

```python
RELEVANT = {"goal", "card"}

for ev in incidents:
    if ev.get("incidentType") not in RELEVANT:
        continue
    # processar gols e cartões
```

**`incidentType` completo** (para referência):

```
goal         → gol marcado
card         → cartão (amarelo / vermelho / amarelo+vermelho)
substitution → substituição
varDecision  → decisão do VAR
period       → início/fim de período (kickoff, HT, FT)
injuryTime   → acréscimos
```

---

### 2. SHOTMAP — Mapa de chutes

```python
data = await match.shotmap()
shots = data.get("shotmap", [])
```

**O que retorna:**

```json
{
  "shotmap": [
    {
      "player": { "name": "João Silva", "shortName": "J. Silva" },
      "shotType": "save",
      "situation": "openPlay",
      "playerCoordinates": { "x": 88.5, "y": 42.3 },
      "blockCoordinates": null,
      "goalMouthCoordinates": { "x": 32.1, "y": 48.7 },
      "xg": 0.14,
      "xgot": 0.09,
      "time": 23,
      "addedTime": 0,
      "isHome": true,
      "bodyPart": "rightFoot",
      "id": 8821
    }
  ]
}
```

**Campos úteis:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `shotType` | string | Ver tabela abaixo |
| `xg` | float | Expected Goals do chute (0.0–1.0) |
| `xgot` | float | xG On Target — xG considerando que foi no gol |
| `time` | int | Minuto do chute |
| `isHome` | bool | `true` = mandante |
| `situation` | string | `"openPlay"`, `"setpiece"`, `"corner"`, `"penalty"`, `"fastBreak"` |
| `bodyPart` | string | `"rightFoot"`, `"leftFoot"`, `"head"` |
| `playerCoordinates` | object | Posição do jogador no campo (x/y em %) |

**`shotType` — valores e significado:**

| shotType | Significado | isOnTarget |
|----------|-------------|------------|
| `"goal"` | Gol marcado | ✅ sim |
| `"save"` | Defesa do goleiro | ✅ sim |
| `"miss"` | Chute para fora | ❌ não |
| `"block"` | Chute bloqueado por defensor | ❌ não |
| `"post"` | Chute na trave | ❌ não (convenção SofaScore) |

> **Atenção**: chutes com `shotType == "goal"` já aparecem nos Incidents como `incidentType == "goal"`.
> Evite contar o gol duas vezes: remova `shotType == "goal"` do shotmap se já processar incidents.

**Como derivar `isOnTarget`:**

```python
def is_on_target(shot: dict) -> bool:
    return shot.get("shotType") in ("save", "goal")
```

**Como calcular xG acumulado por time:**

```python
home_xg = sum(s["xg"] for s in shots if s.get("isHome") and s.get("xg"))
away_xg = sum(s["xg"] for s in shots if not s.get("isHome") and s.get("xg"))
```

---

### 3. STATISTICS — Stats agregadas

```python
data = await match.stats()
statistics = data.get("statistics", [])
```

**Estrutura da resposta:**

```json
{
  "statistics": [
    {
      "period": "ALL",
      "groups": [
        {
          "groupName": "Match overview",
          "statisticsItems": [
            { "name": "Ball possession", "home": "58%", "away": "42%" },
            { "name": "Total shots",     "home": "12",  "away": "7"  },
            { "name": "Shots on target", "home": "4",   "away": "2"  },
            { "name": "Corner kicks",    "home": "6",   "away": "3"  },
            { "name": "Fouls",           "home": "11",  "away": "14" }
          ]
        },
        {
          "groupName": "Shots",
          "statisticsItems": [
            { "name": "Big chances",         "home": "3", "away": "1" },
            { "name": "Big chances missed",  "home": "2", "away": "1" },
            { "name": "Shots off target",    "home": "5", "away": "3" },
            { "name": "Blocked shots",       "home": "3", "away": "2" }
          ]
        }
      ]
    },
    {
      "period": "1ST",
      "groups": [ ... ]
    },
    {
      "period": "2ND",
      "groups": [ ... ]
    }
  ]
}
```

**Como extrair os valores que interessam:**

```python
def extract_stats(data: dict) -> dict:
    statistics = data.get("statistics", [])

    # Preferir período "ALL"; fallback para o primeiro
    all_period = next(
        (p for p in statistics if p.get("period") == "ALL"),
        statistics[0] if statistics else None
    )
    if not all_period:
        return {}

    result = {}
    for group in all_period.get("groups", []):
        for item in group.get("statisticsItems", []):
            result[item["name"]] = {
                "home": item.get("home"),
                "away": item.get("away"),
            }
    return result

stats = extract_stats(data)

possession_home = stats.get("Ball possession", {}).get("home")  # "58%"
shots_on_target_home = stats.get("Shots on target", {}).get("home")  # "4"
big_chances_home = stats.get("Big chances", {}).get("home")  # "3"
```

**Stats disponíveis relevantes** (nomes exatos da API):

| Nome | Exemplo home | Exemplo away |
|------|-------------|-------------|
| `"Ball possession"` | `"58%"` | `"42%"` |
| `"Total shots"` | `"12"` | `"7"` |
| `"Shots on target"` | `"4"` | `"2"` |
| `"Shots off target"` | `"5"` | `"3"` |
| `"Blocked shots"` | `"3"` | `"2"` |
| `"Corner kicks"` | `"6"` | `"3"` |
| `"Fouls"` | `"11"` | `"14"` |
| `"Yellow cards"` | `"1"` | `"2"` |
| `"Red cards"` | `"0"` | `"1"` |
| `"Big chances"` | `"3"` | `"1"` |
| `"Big chances missed"` | `"2"` | `"1"` |
| `"xG"` | `"1.24"` | `"0.61"` |

> **Nota:** `"xG"` aparece no stats mas só está disponível em jogos que a SofaScore escolhe calcular (não é universal). Use o `shotmap` como fonte primária de xG.

---

## Quando usar cada fonte

| Dado | Fonte primária | Fallback |
|------|---------------|---------|
| Gols + cartões + minutos | `incidents` | — |
| xG por chute | `shotmap[].xg` | — |
| isOnTarget por chute | `shotmap[].shotType` | `statistics["Shots on target"]` |
| xG total da partida | soma do `shotmap` | `statistics["xG"]` |
| Posse de bola | `statistics["Ball possession"]` | — |
| Chutes totais | `statistics["Total shots"]` | len(shotmap) |

---

## Padrão de uso (as 3 chamadas juntas)

```python
async def fetch_match_data(match_id: int) -> dict:
    api = SofascoreAPI()
    match = Match(api, match_id=match_id)

    incidents_raw, shotmap_raw, stats_raw = await asyncio.gather(
        match.incidents(),
        match.shotmap(),
        match.stats(),
    )

    # 1. Incidents — gols e cartões
    incidents = incidents_raw.get("incidents", [])
    goals = [e for e in incidents if e.get("incidentType") == "goal"]
    cards = [e for e in incidents if e.get("incidentType") == "card"]

    # 2. Shotmap — chutes com xG
    shots = shotmap_raw.get("shotmap", [])
    home_xg = sum(s.get("xg", 0) for s in shots if s.get("isHome"))
    away_xg = sum(s.get("xg", 0) for s in shots if not s.get("isHome"))

    # 3. Statistics — posse + fallback shots on target
    stats = extract_stats(stats_raw)
    possession_home = stats.get("Ball possession", {}).get("home", "50%")

    return {
        "goals": goals,
        "cards": cards,
        "home_xg": home_xg,
        "away_xg": away_xg,
        "possession_home": possession_home,
        "shots_on_target": {
            "home": stats.get("Shots on target", {}).get("home"),
            "away": stats.get("Shots on target", {}).get("away"),
        }
    }
```

---

## O que você não precisa

- **Pressão / passes / tackles / duelos** — não estão no modelo
- **Odds pré-jogo** — não está no v1 (`match.odds()` existe mas não é necessário)
- **Escalação / formação** — não está no modelo (`match.lineups()` existe)
- **Heatmaps** — `match.heatmap(team_id)` existe mas não é necessário
- **Probabilidade de vitória ao vivo** — `match.win_probability()` existe (grafo temporal)

---

## Tratamento de erros comuns

```python
# Shotmap nem sempre está disponível (jogo não iniciado, dados atrasados)
try:
    shotmap_raw = await match.shotmap()
except Exception:
    shotmap_raw = {"shotmap": []}

# Stats podem ter estrutura diferente em jogos mais antigos
statistics = data.get("statistics", [])
if not isinstance(statistics, list):
    statistics = []

# xG pode ser None em chutes de datasets incompletos
xg = shot.get("xg") or 0.0
```

---

## Referência rápida

```
match.incidents()  → gols, cartões, substituições, períodos
match.shotmap()    → todos os chutes com xG, xGOT, coordenadas
match.stats()      → estatísticas agregadas por período (ALL, 1ST, 2ND)
match.get_match()  → placar atual, status, minuto, informações do jogo
```
