# O que já usamos vs. O que ainda podemos usar

## Endpoints ativos no `scraper-service/main.py`

| Endpoint FastAPI | Método wrapper | Status |
|-----------------|----------------|--------|
| `GET /health` | — | ✅ Ativo |
| `GET /matches/today` | `Match.games_by_date()` | ✅ Ativo |
| `GET /match/{id}/form` | `Match.pre_match_form()` | ✅ Ativo |
| `GET /team/{id}/stats` | `Team.last_fixtures()` | ✅ Ativo |
| `GET /match/{id}/lineups` | `Match.lineups_home()` + `Match.lineups_away()` | ✅ Ativo |
| `GET /match/{id}/h2h` | `Match.h2h()` | ✅ Ativo |
| `GET /match/{id}/odds` | `Match.featured_odds()` | ✅ Ativo |
| `GET /match/{id}/live` | `Match.get_match()` + `Match.incidents()` | ✅ Ativo |
| `GET /match/{id}/stats` | `Match.stats()` | ✅ Ativo |

---

## Dados sendo aproveitados em `parse_fixtures_stats()`

A função calcula os seguintes campos a partir de `last_fixtures()`:

| Campo | Cálculo |
|-------|---------|
| `goalsScoredAvg` | média de gols marcados nos últimos 10 jogos |
| `goalsConcededAvg` | média de gols sofridos |
| `bttsPct` | % jogos com ambas as equipes marcando |
| `over25Pct` | % jogos com mais de 2.5 gols |
| `under25Pct` | % jogos com 1.5 gols ou menos |
| `xgAvg` | média de xG marcado (se disponível) |
| `xgConcededAvg` | média de xG sofrido |
| `formLast5` | string W/D/L dos últimos 5 jogos |
| `formLast10` | string W/D/L dos últimos 10 jogos |

---

## Dados disponíveis mas NÃO usados ainda

### Alta prioridade (impacto direto em análise)

| Dado | Método | O que traz |
|------|--------|------------|
| Estatísticas da liga por time | `Team.league_stats(league_id, season)` | 50+ métricas agregadas: posse, passes, finalizações, duelos, erros, xG, cartões |
| Escalações com valores de mercado | `Match.lineups_home/away()` | Valor de mercado de cada jogador, idade, país (já lemos lineups mas não processamos valor) |
| Mapa de finalizações | `Match.shotmap()` | xG por chute, coordenadas, parte do corpo, tipo de situação |
| Mapa de calor | `Match.heatmap(team_id)` | Posicionamento médio do time no campo |
| Probabilidade de vitória (gráfico) | `Match.win_probability()` | Série temporal de probabilidades ao longo da partida |
| Votos dos usuários | `Match.votes()` | Probabilidade implícita dos torcedores (crowdsourced) |
| Odds completas | `Match.match_odds()` | Todos os mercados (já temos 1X2, mas há Over/Under, BTTS, etc) |
| Elenco completo | `Team.squad()` | Todos jogadores com valor de mercado e contrato |
| Transferências | `Team.transfers_in()` / `transfers_out()` | Histórico de reforços e saídas |
| Temporadas disponíveis | `Team.seasons()` | IDs necessários para chamar `league_stats` |

### Média prioridade

| Dado | Método | O que traz |
|------|--------|------------|
| Atributos do jogador | `Player.attributes()` | Notas de attacking, technical, tactical, defending, creativity |
| Stats individuais na liga | `Player.league_stats(league_id, season)` | 60+ métricas individuais por jogador |
| Histórico de transferências (jogador) | `Player.transfer_history()` | Trajetória do jogador |
| Tabela classificação | `League.standings(season)` | Posição, pontos, saldo de gols de cada time |
| Tabela casa/fora | `League.standings_home()` / `standings_away()` | Separação por mandante/visitante |
| H2H detalhado | `Match.h2h_results(match_code)` | Lista das partidas anteriores entre os times (não só contagem) |
| Sequências dos times | `Match.team_streaks()` | Quantas partidas sem perder, sem marcar, etc |
| Comentários texto | `Match.commentary()` | Narração completa de todos os eventos |
| Man of the Match | `Match.motm()` | Jogador da partida com rating |
| Melhores jogadores da partida | `Match.best_home_players()` / `best_away_players()` | Top 3 por time com rating |
| Técnicos | `Match.managers()` | Nome e ID dos técnicos |
| Canais de TV | `Match.match_channels()` | Onde assistir por país |
| Highlights (vídeo) | `Match.highlight()` | Link YouTube para highlights |

### Baixa prioridade

| Dado | Método | O que traz |
|------|--------|------------|
| TOTW | `League.totw(season, round)` | Time da semana por rodada |
| Performance graph | `Team.performance_graph()` | Evolução dos pontos ao longo da temporada |
| Near events | `Team.near_events()` | Próximas e últimas partidas do time |
| Stats nacionais (jogador) | `Player.national_stats()` | Estatísticas pela seleção |

---

## Oportunidades imediatas

### 1. Melhorar análise de times
Substituir ou complementar `parse_fixtures_stats()` com `Team.league_stats()`:
- Inclui xG diretamente, sem precisar calcular da lista de fixtures
- Tem 50+ métricas que hoje não capturamos (posse, pressão, duelos, etc)
- Mais estável (dados oficiais da liga, não calculados no client)

### 2. Adicionar odds de mercados secundários
`Match.match_odds()` expõe todos os mercados disponíveis:
- Over/Under 1.5, 2.5, 3.5
- Both Teams to Score (BTTS)
- Resultado intervalo/final
- Asian Handicap

### 3. Usar o shotmap para qualidade de chances
`Match.shotmap()` com `xg` por chute é mais granular que a estatística agregada de xG.

### 4. Tabela de classificação para contexto de forma
`League.standings()` permite saber a posição atual de cada time sem precisar calcular manualmente.

---

## Como obter o season_id

Para usar `league_stats`, `top_players`, etc, é necessário o `season_id`:

```python
team = Team(api, team_id=42)
seasons = await team.seasons()
# seasons["uniqueTournamentSeasons"][0]["seasons"][0]["id"] → season_id atual
```

Ou via `League`:
```python
league = League(api, league_id=17)
season = await league.current_season()
season_id = season["id"]
```
