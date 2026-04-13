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

  const homeStatsBlock = `
## Estatísticas ${game.homeTeam}
- Média Gols Marcados: ${formatStat(homeStats?.goalsScoredAvg)}
- Média Gols Sofridos: ${formatStat(homeStats?.goalsConcededAvg)}
- xG Médio: ${formatStat(homeStats?.xgAvg)}
- xG Sofrido Médio: ${formatStat(homeStats?.xgConcededAvg)}
- Desvio Padrão xG: ${formatStat(homeStats?.xgStd)}
- Desvio Padrão Gols: ${formatStat(homeStats?.goalsScoredStd)}
- Chutes por jogo: ${formatStat(homeStats?.shotsAvg)}
- Chutes no gol por jogo: ${formatStat(homeStats?.shotsOnTargetAvg)}
- Grandes chances criadas: ${formatStat(homeStats?.bigChancesCreatedAvg)}
- Grandes chances sofridas: ${formatStat(homeStats?.bigChancesConcededAvg)}
- Taxa BTTS: ${homeStats?.bttsPct !== undefined ? formatPct(homeStats.bttsPct) : 'N/A'}
- Taxa Over 2.5: ${homeStats?.over25Pct !== undefined ? formatPct(homeStats.over25Pct) : 'N/A'}
- Média Escanteios: ${formatStat(homeStats?.cornersAvg)}
- Média Cartões: ${formatStat(homeStats?.cardsAvg)}
- Média Posse: ${homeStats?.possessionAvg !== undefined ? formatPct(homeStats.possessionAvg) : 'N/A'}
- Forma (últimos 5): ${homeStats?.formLast5 || 'N/A'}
- Forma (últimos 10): ${homeStats?.formLast10 || 'N/A'}`

  const awayStatsBlock = `
## Estatísticas ${game.awayTeam}
- Média Gols Marcados: ${formatStat(awayStats?.goalsScoredAvg)}
- Média Gols Sofridos: ${formatStat(awayStats?.goalsConcededAvg)}
- xG Médio: ${formatStat(awayStats?.xgAvg)}
- xG Sofrido Médio: ${formatStat(awayStats?.xgConcededAvg)}
- Desvio Padrão xG: ${formatStat(awayStats?.xgStd)}
- Desvio Padrão Gols: ${formatStat(awayStats?.goalsScoredStd)}
- Chutes por jogo: ${formatStat(awayStats?.shotsAvg)}
- Chutes no gol por jogo: ${formatStat(awayStats?.shotsOnTargetAvg)}
- Grandes chances criadas: ${formatStat(awayStats?.bigChancesCreatedAvg)}
- Grandes chances sofridas: ${formatStat(awayStats?.bigChancesConcededAvg)}
- Taxa BTTS: ${awayStats?.bttsPct !== undefined ? formatPct(awayStats.bttsPct) : 'N/A'}
- Taxa Over 2.5: ${awayStats?.over25Pct !== undefined ? formatPct(awayStats.over25Pct) : 'N/A'}
- Média Escanteios: ${formatStat(awayStats?.cornersAvg)}
- Média Cartões: ${formatStat(awayStats?.cardsAvg)}
- Média Posse: ${awayStats?.possessionAvg !== undefined ? formatPct(awayStats.possessionAvg) : 'N/A'}
- Forma (últimos 5): ${awayStats?.formLast5 || 'N/A'}
- Forma (últimos 10): ${awayStats?.formLast10 || 'N/A'}`

  return `Você é um analista profissional de apostas em futebol.
Você não cria probabilidades novas, não inventa fatos e não extrapola além dos dados fornecidos.
Se faltar dado para sustentar uma entrada, marque NO-BET.
Responda SOMENTE com JSON válido, sem markdown, sem texto extra.

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
${homeStatsBlock}
${awayStatsBlock}

## Formato de saída obrigatório
{
  "signal": {
    "status": "ENTRADA_VALIDADA" | "ALERTA_DE_RISCO" | "NO_BET",
    "market": "1x2" | "BTTS" | "Over2.5" | "Under2.5",
    "direction": "BACK_HOME" | "BACK_AWAY" | "LAY_HOME" | "LAY_AWAY" | "NONE",
    "probability": <número 0-100>,
    "confidence": <número 0-100>
  },
  "evidences": ["fato objetivo 1", "fato objetivo 2"],
  "counterEvidences": ["risco concreto 1"],
  "invalidationConditions": ["gatilho de saída 1"],
  "decision": {
    "stake": "1.0u" | "0.5u" | "0.0u",
    "noBetReason": "motivo" | null
  }
}

Regras:
- evidences: máximo 5 fatos objetivos baseados exclusivamente nos dados fornecidos.
- counterEvidences: máximo 3 riscos concretos que podem invalidar a tese.
- invalidationConditions: máximo 3 gatilhos objetivos de no-bet ou saída precoce.
- Não use linguagem promocional. Seja curto, técnico e rastreável.
- Não recomende entrada quando os dados forem contraditórios.`
}
