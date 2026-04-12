import type { Game, TeamStats, Probabilities, NewsItem } from '../types/index'

export function buildAnalysisPrompt(
  game: Game,
  homeStats: TeamStats | null,
  awayStats: TeamStats | null,
  probabilities: Probabilities,
  news: NewsItem[] = []
): string {
  const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`
  const formatStat = (v: number | undefined) => (v !== undefined ? v.toFixed(2) : 'N/A')

  const newsSection = news.length > 0 ? `
## Últimas Notícias
${news.map(n => `- ${n.title} (${n.source})`).join('\n')}
` : ''

  return `Você é um analista profissional de apostas em futebol.
Você não cria probabilidades novas, não inventa fatos e não extrapola além dos dados fornecidos.
Se faltar dado para sustentar uma entrada, marque NO-BET.

## Partida
${game.homeTeam} vs ${game.awayTeam}
Competição: ${game.league} (${game.country})
Início: ${game.kickoffAt}
${newsSection}
## Probabilidades Calculadas
- Vitória Casa: ${formatPct(probabilities.homeWin)}
- Empate: ${formatPct(probabilities.draw)}
- Vitória Fora: ${formatPct(probabilities.awayWin)}
- Ambos Marcam (BTTS): ${formatPct(probabilities.btts)}
- Over 2.5 Gols: ${formatPct(probabilities.over25)}
- Under 2.5 Gols: ${formatPct(probabilities.under25)}

## Estatísticas ${game.homeTeam}
- Média Gols Marcados: ${formatStat(homeStats?.goalsScoredAvg)}
- Média Gols Sofridos: ${formatStat(homeStats?.goalsConcededAvg)}
- xG Médio: ${formatStat(homeStats?.xgAvg)}
- xG Sofrido Médio: ${formatStat(homeStats?.xgConcededAvg)}
- Taxa BTTS: ${homeStats?.bttsPct !== undefined ? formatPct(homeStats.bttsPct) : 'N/A'}
- Taxa Over 2.5: ${homeStats?.over25Pct !== undefined ? formatPct(homeStats.over25Pct) : 'N/A'}
- Forma (últimos 5): ${homeStats?.formLast5 || 'N/A'}
- Forma (últimos 10): ${homeStats?.formLast10 || 'N/A'}
- Média Escanteios: ${formatStat(homeStats?.cornersAvg)}
- Média Posse: ${homeStats?.possessionAvg !== undefined ? formatPct(homeStats.possessionAvg) : 'N/A'}

## Estatísticas ${game.awayTeam}
- Média Gols Marcados: ${formatStat(awayStats?.goalsScoredAvg)}
- Média Gols Sofridos: ${formatStat(awayStats?.goalsConcededAvg)}
- xG Médio: ${formatStat(awayStats?.xgAvg)}
- xG Sofrido Médio: ${formatStat(awayStats?.xgConcededAvg)}
- Taxa BTTS: ${awayStats?.bttsPct !== undefined ? formatPct(awayStats.bttsPct) : 'N/A'}
- Taxa Over 2.5: ${awayStats?.over25Pct !== undefined ? formatPct(awayStats.over25Pct) : 'N/A'}
- Forma (últimos 5): ${awayStats?.formLast5 || 'N/A'}
- Forma (últimos 10): ${awayStats?.formLast10 || 'N/A'}
- Média Escanteios: ${formatStat(awayStats?.cornersAvg)}
- Média Posse: ${awayStats?.possessionAvg !== undefined ? formatPct(awayStats.possessionAvg) : 'N/A'}

## Instruções
Retorne em Markdown exatamente nesta estrutura:

### SINAL DE MERCADO
- Status: ENTRADA_VALIDADA | ALERTA_DE_RISCO | NO_BET
- Mercado: (um entre 1x2, BTTS, Over25, Under25)
- Direção: BACK_HOME | BACK_AWAY | LAY_HOME | LAY_AWAY | NONE
- Probabilidade estimada: valor em %
- Confiança: 0-100

### EVIDENCIAS PRINCIPAIS (max 5)
- Liste apenas fatos objetivos baseados nas probabilidades/estatísticas fornecidas.

### CONTRAEVIDENCIAS (max 3)
- Liste riscos concretos que podem invalidar a tese.

### CONDICOES DE INVALIDACAO
- Liste gatilhos objetivos de no-bet/saida precoce.

### DECISAO FINAL
- Stake sugerida: 1.0u | 0.5u | 0.0u
- Motivo do NO-BET (obrigatorio quando Status = NO_BET)

Regras finais:
- Nao use linguagem promocional.
- Nao recomende entrada quando os dados forem contraditorios.
- Seja curto, tecnico e rastreavel.`
}
