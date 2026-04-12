# Sofascore Wrapper — Investigação Completa

Documentação de todos os dados coletáveis via `sofascore-wrapper` (Python).
O wrapper usa Playwright/Chromium para acessar a API interna do Sofascore.

## Arquitetura

```
SofascoreAPI (singleton Chromium)
    ├── Match       → dados de partidas
    ├── Team        → dados de times
    ├── Player      → dados de jogadores
    ├── League      → dados de ligas e torneios
    └── PlayerSearch → busca de jogadores
```

## Arquivos de documentação

| Arquivo | Conteúdo |
|---------|----------|
| [match.md](./match.md) | Todos os métodos da classe `Match` |
| [team.md](./team.md) | Todos os métodos da classe `Team` |
| [player.md](./player.md) | Todos os métodos da classe `Player` |
| [league.md](./league.md) | Todos os métodos da classe `League` |
| [what-we-use.md](./what-we-use.md) | O que já está sendo usado no projeto e o que ainda pode ser aproveitado |

## Como instanciar

```python
from sofascore_wrapper.api import SofascoreAPI
from sofascore_wrapper.match import Match
from sofascore_wrapper.team import Team
from sofascore_wrapper.player import Player
from sofascore_wrapper.league import League

api = SofascoreAPI()  # inicia Chromium

match = Match(api, match_id=12345678)
team  = Team(api, team_id=42)
player = Player(api, player_id=982780)
league = League(api, league_id=17)
```

> **Atenção:** O wrapper usa um semáforo interno — apenas 1 requisição Playwright por vez.
