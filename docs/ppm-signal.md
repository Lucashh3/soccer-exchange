# PPM Signal — Plano de Implementação

Sinal de entrada na exchange baseado em **Pressão Por Minuto** calculada a partir do gráfico de momentum.

---

## Conceito

O momentum já existe no sistema como uma série temporal `{ minute, value }` onde valores positivos indicam pressão da casa e negativos do visitante.

A PPM divide essa série em **blocos de 15 minutos** e calcula a pressão média de cada bloco. Com isso é possível detectar:

- **Virada de momentum** — quem estava dominando perdeu pressão
- **Pressão crescente** — um time aumentando intensidade bloco a bloco
- **Pressão acumulada sem gol** — odds infladas, boa oportunidade de entrada

---

## Fase 1 — Regras simples (implementar agora)

### 1.1 Cálculo de PPM

```typescript
interface PpmBlock {
  from: number      // minuto início do bloco
  to: number        // minuto fim do bloco
  value: number     // média dos pontos no bloco (-1 a +1)
  side: 'home' | 'away' | 'neutral'
  intensity: number // Math.abs(value), 0 a 1
}

function calcPpm(points: MomentumPoint[], blockSize = 15): PpmBlock[] {
  const blocks: PpmBlock[] = []
  for (let from = 0; from < 90; from += blockSize) {
    const to = from + blockSize
    const inBlock = points.filter(p => p.minute >= from && p.minute < to)
    if (!inBlock.length) continue
    const avg = inBlock.reduce((s, p) => s + p.value, 0) / inBlock.length
    blocks.push({
      from, to,
      value: avg,
      side: avg > 0.1 ? 'home' : avg < -0.1 ? 'away' : 'neutral',
      intensity: Math.abs(avg),
    })
  }
  return blocks
}
```

### 1.2 Detector de tendência

Compara o último bloco completo com o anterior para detectar mudanças:

```typescript
type TrendType = 'rising_home' | 'rising_away' | 'stable' | 'reversing'

function detectTrend(blocks: PpmBlock[]): {
  type: TrendType
  delta: number       // diferença de intensidade entre blocos
  currentSide: 'home' | 'away' | 'neutral'
} | null {
  if (blocks.length < 2) return null
  const prev = blocks[blocks.length - 2]
  const curr = blocks[blocks.length - 1]
  const delta = curr.value - prev.value

  if (Math.abs(delta) < 0.1) return { type: 'stable', delta, currentSide: curr.side }
  if (delta > 0 && curr.side === 'home') return { type: 'rising_home', delta, currentSide: 'home' }
  if (delta < 0 && curr.side === 'away') return { type: 'rising_away', delta, currentSide: 'away' }
  return { type: 'reversing', delta, currentSide: curr.side }
}
```

### 1.3 Score de entrada

Combina tendência + intensidade + contexto do jogo:

```typescript
interface EntrySignal {
  score: number           // 0–100
  recommendation: 'strong' | 'moderate' | 'weak' | 'none'
  side: 'home' | 'away'
  reason: string
}

function calcEntrySignal(
  blocks: PpmBlock[],
  minute: number,
  homeScore: number,
  awayScore: number,
): EntrySignal | null {
  const trend = detectTrend(blocks)
  if (!trend || trend.type === 'stable' || trend.currentSide === 'neutral') return null

  const lastBlock = blocks[blocks.length - 1]
  const isScoreless = homeScore === 0 && awayScore === 0
  const isLateGame = minute >= 60

  let score = 0
  score += lastBlock.intensity * 40          // intensidade atual (0–40)
  score += Math.abs(trend.delta) * 30        // força da mudança (0–30)
  if (isScoreless) score += 15              // odds mais altas = mais valor
  if (isLateGame) score += 15               // pressão no final pesa mais
  if (trend.type === 'reversing') score -= 20 // virada recente = incerteza

  const recommendation =
    score >= 70 ? 'strong' :
    score >= 50 ? 'moderate' :
    score >= 30 ? 'weak' : 'none'

  const side = trend.currentSide as 'home' | 'away'
  const reason = buildReason(trend, lastBlock, minute, isScoreless)

  return { score: Math.round(score), recommendation, side, reason }
}
```

### 1.4 Onde exibir

- **Página do jogo** (`/game/[id]`) — seção abaixo do gráfico de momentum com blocos coloridos + score de entrada
- **Dashboard card** — ícone de seta (↑↓) ao lado do indicador de pressão quando score ≥ 50
- **API** — endpoint `/api/game/[id]/ppm` retornando blocos + sinal calculado

---

## Fase 1 — Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---|---|---|
| `src/lib/ppm.ts` | Criar | Funções `calcPpm`, `detectTrend`, `calcEntrySignal` |
| `frontend-next/lib/ppm.ts` | Criar | Mesmo cálculo no lado cliente para uso em componentes |
| `frontend-next/app/api/game/[id]/ppm/route.ts` | Criar | Endpoint que busca momentum do DB e retorna PPM + sinal |
| `frontend-next/components/game/PpmChart.tsx` | Criar | Visualização dos blocos + score de entrada |
| `frontend-next/app/game/[id]/page.tsx` | Modificar | Adicionar `PpmChart` abaixo de `AttackMomentum` |
| `frontend-next/components/signals/SignalCard.tsx` | Modificar | Exibir seta de tendência quando score ≥ 50 |

---

## Fase 1 — Visualização dos blocos (PpmChart)

```
Casa  ████░░░░░░  Visitante

[  +0.2  ][  +0.1  ][  -0.5  ][  -0.6  ]   ← blocos 15 min
   0–15     15–30    30–45     45–60

Score de entrada: 74  →  FORTE ↑ Visitante
Motivo: Pressão crescente desde o min 30, placar ainda fechado
```

---

## Fase 2 — Coleta de dados históricos (próximo passo)

Para treinar um modelo futuro, salvar junto com cada snapshot de momentum:

```sql
-- Nova coluna ou tabela separada
ppm_snapshots (
  game_id     TEXT,
  minute      INT,
  blocks      JSONB,    -- array de PpmBlock
  entry_score INT,
  entry_side  TEXT,
  -- resultado real (preenchido ao final do jogo)
  next_goal_minute  INT,     -- null se não houve gol
  next_goal_side    TEXT,
  final_home_score  INT,
  final_away_score  INT,
)
```

Meta: acumular ~500 jogos com snapshots a cada 5 minutos → dataset para Fase 3.

---

## Fase 3 — Modelo TensorFlow (futuro, requer histórico)

**Entrada:** sequência de 6 blocos PPM consecutivos (90 min / 15 = 6 blocos)
**Saída:** probabilidade de gol nos próximos 15 minutos, por time

```
[+0.2, +0.1, -0.5, -0.6, ?, ?]  →  P(gol_visitante_15min) = 0.68
```

Arquitetura sugerida: **LSTM** com janela deslizante de blocos.

Substituiria o `calcEntrySignal` baseado em regras pela predição do modelo, mantendo a mesma interface de saída (`EntrySignal`).

---

## Ordem de execução

1. `src/lib/ppm.ts` — lógica pura, sem dependências de UI
2. `/api/game/[id]/ppm` — endpoint
3. `PpmChart.tsx` — visualização
4. Integrar na página do jogo
5. Indicador no card do dashboard
6. (Depois de dados suficientes) Fase 2 coleta → Fase 3 modelo
