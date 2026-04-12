# Live Suggestion — Plano de Implementação

Sugestão de entrada em tempo real gerada por LLM, combinando dados de momentum (PPM), estatísticas ao vivo e sinais de mercado. Exibida na página do jogo e nos cards do dashboard.

---

## Fluxo de dados

```
Frontend (página do jogo ou card)
    │
    │  GET /api/game/:id/suggestion
    ▼
Next.js proxy route
    │
    │  GET /games/:id/suggestion
    ▼
Express (src/api/routes/games.ts)
    │
    ├── GET /games/:id/live        → placar, minuto, eventos
    ├── GET /games/:id/live-stats  → posse, chutes, escanteios
    ├── GET /games/:id/graph       → PPM blocks (calcPpm)
    └── DB: getGameById()          → sinais de mercado, xG, forma
    │
    ▼
src/services/suggestion.ts
    │
    ├── buildSuggestionPrompt()    → monta prompt PT-BR
    ├── Cache em memória (5 min)   → evita chamadas repetidas
    └── generateReport()           → OpenAI → DeepSeek fallback
    │
    ▼
{ text, recommendation, side, score, cachedAt }
```

---

## Cache Strategy

- TTL padrão: **5 minutos**
- Cache por `gameId` — Map em memória no processo Express
- **Invalidação antecipada** se qualquer condição for verdadeira ao checar:
  - Novo gol detectado (homeScore ou awayScore mudou vs. cache anterior)
  - Virada de momentum: `|currentPpmScore - cachedPpmScore| > 25`
  - Jogo entrou no segundo tempo (minuto 45→46, não havia sido gerado no 2T)
- Se o jogo não está ao vivo (`status !== 'inprogress'`): retorna `null` sem chamar LLM

```typescript
interface SuggestionCache {
  text: string
  recommendation: 'strong' | 'moderate' | 'weak' | 'none'
  side: 'home' | 'away' | null
  score: number
  homeScore: number   // snapshot para detectar gol
  awayScore: number
  ppmScore: number    // snapshot para detectar virada
  cachedAt: number    // Date.now()
}

const suggestionCache = new Map<string, SuggestionCache>()
const CACHE_TTL = 5 * 60 * 1000
```

---

## Prompt Template

```
Você é um trader profissional de futebol na Betfair Exchange.
Analise o momento atual da partida e dê UMA sugestão de entrada objetiva.
Máximo 3 linhas. Seja direto. Mencione o mercado e o time. Não use bullet points.

## Partida
{homeTeam} x {awayTeam} — {minute}' — Placar: {homeScore}x{awayScore}
Liga: {league}

## Momentum (PPM por bloco de 15 min)
{blocks.map: "  {from}–{to}': {value>0?'+':''}{value.toFixed(1)} ({side})"}
Tendência atual: {trendDescription}
PPM Score: {score}/100 — {recommendation} · {side}

## Estatísticas ao vivo
  Posse:         {home}% · {away}%
  Chutes a gol:  {home} · {away}
  Chutes totais: {home} · {away}
  Escanteios:    {home} · {away}

## Sinais de mercado (pré-jogo)
  {signal.market}: {signal.probability}% confiança {signal.confidence}%
  xG médio: {homeXg} / {awayXg}
  Forma (últimos 5): {homeForm} / {awayForm}

Gere a sugestão agora.
```

### Exemplos de output esperado

**Exemplo 1 — Pressão forte, placar fechado, reta final:**
> Vasco dominando os últimos 30 minutos com 11 chutes e 62% de posse, placar ainda fechado no 67'. Pressão crescente com PPM 87 indica gol iminente do visitante. Sugestão: back Vasco ou lay Flamengo antes das odds caírem.

**Exemplo 2 — Pressão moderada, jogo em andamento:**
> Flamengo reagiu após o intervalo com pressão crescente — PPM 61, 4 chutes a gol no 2T. Sinal Over 2.5 ativo com 74% de confiança. Sugestão: back Over 2.5 enquanto odds ainda estão acima de 1.5.

**Exemplo 3 — Sem sinal claro:**
> Jogo equilibrado com momentum alternando, sem tendência definida no 55'. PPM abaixo de 50 para ambos os lados. Sugestão: aguardar pressão consistente por pelo menos 10 minutos antes de entrar.

---

## TypeScript Interfaces

```typescript
// src/services/suggestion.ts

export interface SuggestionInput {
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  minute: number
  homeScore: number
  awayScore: number
  // PPM
  blocks: PpmBlock[]
  ppmSignal: EntrySignal | null
  // Live stats
  stats: { name: string; home: string | number | null; away: string | number | null }[]
  // Pre-match signal
  topSignal: { market: string; probability: number; confidence: number } | null
  homeXg: number | null
  awayXg: number | null
  homeForm: string | null
  awayForm: string | null
}

export interface SuggestionResponse {
  text: string
  recommendation: 'strong' | 'moderate' | 'weak' | 'none'
  side: 'home' | 'away' | null
  score: number       // PPM score que gerou a sugestão
  cachedAt: number    // timestamp Unix ms
  fromCache: boolean
}
```

---

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---|---|---|
| `src/services/suggestion.ts` | Criar | Cache + buildPrompt + chamada LLM |
| `src/api/routes/games.ts` | Modificar | Adicionar `GET /games/:id/suggestion` |
| `frontend-next/app/api/game/[id]/suggestion/route.ts` | Criar | Proxy Next.js (mesmo padrão do `/live`) |
| `frontend-next/lib/api.ts` | Modificar | Adicionar `fetchSuggestion` + `SuggestionResponse` |
| `frontend-next/components/game/SuggestionCard.tsx` | Criar | UI da sugestão |
| `frontend-next/app/game/[id]/page.tsx` | Modificar | Integrar `SuggestionCard` na `LiveSection` |
| `frontend-next/components/signals/SignalCard.tsx` | Modificar | Linha de sugestão resumida no card (score ≥ 70 apenas) |

---

## UI — SuggestionCard

```
┌─────────────────────────────────────────────────┐
│  ⚡ FORTE  ↑ Vasco  PPM 87                      │  ← badge colorido (laranja)
│                                                  │
│  Vasco dominando os últimos 30 min com 11        │
│  chutes e placar fechado no 67'. Entrada:        │  ← texto LLM (2-3 linhas)
│  back Vasco antes das odds caírem.               │
│                                           5min   │  ← "há X min" ou "agora"
└─────────────────────────────────────────────────┘
```

- Fundo sutil: `bg-sky-400/5` (casa) ou `bg-orange-400/5` (visitante)
- Borda esquerda colorida: `border-l-2 border-sky-400/40`
- Badge: mesmo padrão visual do `PpmChart` (`FORTE` / `MODERADO` / `FRACO`)
- Timestamp: `"há 2 min"` usando `Date.now() - cachedAt`
- Quando `recommendation === 'none'` ou `text === ''`: não renderiza nada

**No dashboard card** (somente `score ≥ 70`):
```
↑ PPM 87  ·  "back Vasco antes das odds caírem."
           ^  apenas a última frase do texto LLM
```

---

## Endpoint Express

```
GET /games/:id/suggestion

Response 200:
{
  "text": "Vasco dominando...",
  "recommendation": "strong",
  "side": "away",
  "score": 87,
  "cachedAt": 1712345678000,
  "fromCache": true
}

Response 200 (sem sinal):
{
  "text": "",
  "recommendation": "none",
  "side": null,
  "score": 0,
  "cachedAt": 0,
  "fromCache": false
}
```

A rota coleta dados em paralelo (Promise.all), monta o input, verifica cache, chama LLM se necessário e responde. Nunca retorna erro 5xx — em caso de falha do LLM, retorna `recommendation: 'none'` silenciosamente.

---

## Ordem de execução

1. `src/services/suggestion.ts` — lógica pura: prompt + cache + LLM
2. `src/api/routes/games.ts` — adicionar a rota `GET /:id/suggestion`
3. `frontend-next/app/api/game/[id]/suggestion/route.ts` — proxy
4. `frontend-next/lib/api.ts` — `fetchSuggestion` + tipo
5. `frontend-next/components/game/SuggestionCard.tsx` — componente visual
6. `frontend-next/app/game/[id]/page.tsx` — inserir `SuggestionCard` na `LiveSection` após `PpmChart`
7. `frontend-next/components/signals/SignalCard.tsx` — linha resumida (score ≥ 70)

---

## Fase 2 — TensorFlow

Quando houver histórico suficiente (~500 jogos com snapshots de PPM + resultado), o `ppmSignal.score` passará a ser gerado pelo modelo LSTM em vez das regras manuais. O prompt e o `SuggestionCard` não mudam — apenas o número fica mais preciso.

O LLM continua sendo responsável pela **narração**, o TensorFlow pela **predição numérica**.
