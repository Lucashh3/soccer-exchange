# Relatório: Contribuições do Notebook "A Revolução dos Dados" para o Soccer Exchange

> **Fonte:** NotebookLM — *A Revolução dos Dados: Estatísticas, Gestão e Probabilidades no Futebol*
> **Gerado em:** 05/04/2026
> **Objetivo:** Mapear insights do notebook que podem melhorar a plataforma de sinais Soccer Exchange

---

## Sumário

1. [xG e Qualidade de Finalização — Big Chances](#1-xg-e-qualidade-de-finalização--big-chances)
2. [Desvio Padrão como Medida de Consistência e Risco](#2-desvio-padrão-como-medida-de-consistência-e-risco)
3. [Regressão à Média e o Efeito Troca de Treinador](#3-regressão-à-média-e-o-efeito-troca-de-treinador)
4. [Quantificação de Impacto Individual (Desfalques)](#4-quantificação-de-impacto-individual-desfalques)
5. [Modelo Moneyball — Vitórias Acima da Expectativa](#5-modelo-moneyball--vitórias-acima-da-expectativa)
6. [Vieses Psicológicos e Como os Dados os Contornam](#6-vieses-psicológicos-e-como-os-dados-os-contornam)
7. [Plano de Implementação Priorizado](#7-plano-de-implementação-priorizado)

---

## 1. xG e Qualidade de Finalização — Big Chances

### O que o notebook diz

A métrica de Expected Goals (xG) não deve ser usada apenas como valor agregado total. A **distribuição da qualidade das finalizações** importa mais do que a soma bruta. A Opta define "Grandes Chances" (*Big Chances*) como finalizações de curtíssima distância ou situações 1v1 com o goleiro, onde se espera razoavelmente que o gol seja marcado.

**Simulação com 20.000 partidas (ambos os times com xG = 1.2):**

| Equipe | Finalizações | Prob/chute | Vitórias simuladas |
|--------|-------------|------------|-------------------|
| A (qualidade) | 2 "Big Chances" | 60% cada | **37,4%** |
| B (volume) | 12 chutes ruins | 10% cada | 32,1% |

Uma simulação de 100.000 iterações confirmou: criar **ao menos uma chance com 30%+ de probabilidade** oferece vantagem concreta sobre acumular volume de chutes de baixa qualidade.

### Estado atual do Soccer Exchange

O proxy de xG atual é:
```
xg_proxy = (shots_on_target / shots) × avg_goals × 1.1
```

Esse cálculo trata todas as finalizações igualmente, sem diferenciar Big Chances. A métrica `shotsOnTargetAvg` existe mas não é ponderada por qualidade de oportunidade.

### Melhoria proposta

**Adicionar `bigChancesAvg` ao TeamStats** — quantidade média de "Grandes Chances" criadas e cedidas por partida. Fonte: SofaScore já expõe essa métrica na API de estatísticas.

```typescript
// Novo campo em TeamStats
bigChancesCreatedAvg: number;   // médias criadas
bigChancesConcededAvg: number;  // médias cedidas

// Novo fator no xG proxy
xg_proxy = (bigChancesCreated × 0.6) + (otherShots × 0.10)
```

**Impacto no signal generator:**
- Sinal BTTS deve priorizar jogos onde AMBOS os times têm `bigChancesCreatedAvg > 1.5`
- Sinal Over 2.5 deve ter confidence boost quando a soma de Big Chances dos dois times > 3.0

---

## 2. Desvio Padrão como Medida de Consistência e Risco

### O que o notebook diz

O desvio padrão (σ) mede a dispersão do desempenho em relação à média esperada:

- **σ baixo** → equipe consistente e previsível → sinais de menor risco
- **σ alto** → equipe imprevisível → pode ter ataque letal num dia e defesa vulnerável no outro → maior risco

> *"Tentar prever resultados analisando o desvio padrão de estatísticas variadas permite cruzar os pontos fortes de um time diretamente com os pontos fracos de outro para identificar quem realmente tem vantagem."*

Nos mercados financeiros, maior σ = maior risco de perdas fora do esperado. O mesmo princípio se aplica ao futebol.

### Estado atual do Soccer Exchange

O sistema usa `formLast5` e `formLast10` como indicadores de consistência. Não há cálculo de desvio padrão nas métricas de desempenho.

### Melhoria proposta

**Calcular σ das últimas 10 partidas para métricas-chave:**

```typescript
// Novos campos em TeamStats
goalsScoredStd: number;    // desvio padrão de gols marcados
goalsConcededStd: number;  // desvio padrão de gols sofridos
xgStd: number;             // desvio padrão do xG

// Classificação de risco
function getRiskProfile(std: number): 'low' | 'medium' | 'high' {
  if (std < 0.8) return 'low';
  if (std < 1.4) return 'medium';
  return 'high';
}
```

**Uso no confidence scoring:**
```typescript
// Reduzir confidence quando ambos os times têm alta variância
if (homeRisk === 'high' && awayRisk === 'high') {
  confidence *= 0.85; // penalidade de 15%
}

// Boost para jogos de equipes consistentes
if (homeRisk === 'low' && awayRisk === 'low') {
  confidence *= 1.10; // bônus de 10%
}
```

---

## 3. Regressão à Média e o Efeito Troca de Treinador

### O que o notebook diz

Estudos econômicos em diversas ligas europeias provam que a melhora após demitir um treinador é, quase sempre, **apenas regressão à média**. O Aston Villa (manteve o técnico) e o Sunderland (demitiu e contratou Paolo Di Canio) tiveram a mesma taxa de recuperação no mesmo período.

Isso implica que equipes em queda atípica tendem a retornar ao seu nível normal **independentemente** de mudanças na comissão técnica.

### Estado atual do Soccer Exchange

O modelo ML usa `form_pts5` (normalizado) como feature direta. Uma sequência ruim de 5 jogos reduz essa feature e pode distorcer as probabilidades, tratando o declínio como permanente.

### Melhoria proposta

**Adicionar fator de regressão à média no feature engineering:**

```typescript
// Comparar form recente vs form longo prazo
const formRegression = (formPts10 - formPts5) / formPts10;
// Positivo = time em queda (candidato a regressão positiva)
// Negativo = time em alta (pode estar sobrevalorizado)

// Nova feature para o modelo ML
features[17] = formRegression; // feature #18
```

**Impacto nos sinais:**
- Time com queda recente mas histórico sólido (`formPts10 > 7`, `formPts5 < 4`) → não penalizar excessivamente nas odds
- Sinalizar como potencial **value bet** quando o mercado precifica apenas a forma recente

---

## 4. Quantificação de Impacto Individual (Desfalques)

### O que o notebook diz

O sistema deve mensurar o **impacto marginal de ausências** cruzando clean sheets e pontos ganhos com/sem o jogador. Caso concreto: Vincent Kompany no Manchester City:

| Situação | Jogos | Clean Sheets |
|----------|-------|-------------|
| Kompany presente | 12 | 7 (58%) |
| Kompany ausente | 19 | 2 (10.5%) |

> *"Sinais precisos precisam dessa correlação para explorar linhas antes que o mercado reaja à falta do atleta."*

### Estado atual do Soccer Exchange

O scheduler já monitora escalações (`lineup check` a cada 5 minutos para jogos nas próximas 2 horas) e regera análises pós-escalação (`postLineup: true`). No entanto, o ajuste de probabilidades é genérico — não há scoring individual por jogador.

### Melhoria proposta

**Criar tabela `player_impact` no SQLite:**

```sql
CREATE TABLE player_impact (
  id INTEGER PRIMARY KEY,
  team_id TEXT,
  player_name TEXT,
  position TEXT,
  games_played INTEGER,
  games_missed INTEGER,
  clean_sheets_with INTEGER,
  clean_sheets_without INTEGER,
  goals_scored_with_avg REAL,
  goals_scored_without_avg REAL,
  impact_score REAL  -- calculado: diferença normalizada
);
```

**No lineup check, ajustar probability para desfalques de alto impacto:**
```typescript
if (missingPlayer.impactScore > 0.3 && missingPlayer.position === 'defender') {
  awayGoalsProbability *= 1.15; // 15% mais provável sofrer gols
}
```

---

## 5. Modelo Moneyball — Vitórias Acima da Expectativa

### O que o notebook diz

Inspirado em Billy Beane (Oakland A's), usa-se regressão logística para prever % de vitórias esperada com base no poder financeiro/qualidade do time (em desvios padrão). Cruzando expectativa com rendimento real, extrai-se a métrica de **"vitórias acima da expectativa"** — revela times que extraem eficiência invisível ao mercado e que podem estar com odds desajustadas.

### Estado atual do Soccer Exchange

O campo `ev` (Expected Value) já existe nos sinais:
```
ev = (1 - probability) × 100
```

Mas não há comparação sistemática entre probabilidade calculada vs probabilidade implícita nas odds de mercado.

### Melhoria proposta

**Adicionar campo `marketImpliedProb` nos sinais e calcular o edge real:**

```typescript
interface Signal {
  // ... campos existentes
  marketOdds?: number;              // odds da casa de apostas (futuro)
  marketImpliedProb?: number;       // 1 / marketOdds
  modelEdge?: number;               // probability - marketImpliedProb
}

// Sinal é "value bet" quando modelEdge > 5%
const isValueBet = modelEdge > 0.05;
```

**Ranking de ligas por "alpha"** — acompanhar em quais ligas o modelo consistentemente supera o mercado, priorizando essas nas recomendações.

---

## 6. Vieses Psicológicos e Como os Dados os Contornam

O notebook documenta vieses que afetam apostadores humanos e que uma plataforma automatizada naturalmente evita — mas deve estar ciente para explorar:

| Viés | Exemplo do Notebook | Oportunidade para a Plataforma |
|------|--------------------|---------------------------------|
| **Ilusão causal** | Melhora após demissão atribuída ao novo técnico | Identificar times em "falsa recuperação" e calcular o valor real das odds |
| **Viés de confirmação** | Özil visto como preguiçoso por estilo fluido, mas work rate alto | Usar dados de 100 jogos, não últimas 3 partidas vistas |
| **Subestimação do improvável** | Leicester a 5000/1 — apostador fez cash out em £29k perdendo £100k | Manter sinal mesmo quando odds de mercado parecem absurdas se o modelo justifica |
| **Decisões irracionais** | Cellino afastou goleiro por nascer no dia 17 | Monitorar afastamentos por motivos não-técnicos e recalcular sem o ruído emocional |
| **Pânico do apostador** | Cash out prematuro com base em "instinto" | LLM report deve citar dados objetivos, não narrativas, para apoiar confiança no sinal |

---

## 7. Plano de Implementação Priorizado

### Prioridade Alta (maior impacto no modelo atual)

| # | Melhoria | Arquivo alvo | Esforço |
|---|----------|-------------|---------|
| 1 | **Desvio padrão nas TeamStats** | `src/analysis/signalGenerator.ts`, `src/scrapers/` | Médio |
| 2 | **Big Chances no xG proxy** | `src/analysis/mlPredictor.ts`, `src/scrapers/sofascore.py` | Médio |
| 3 | **Fator de regressão à média** | `src/analysis/mlPredictor.ts` (feature engineering) | Baixo |

### Prioridade Média

| # | Melhoria | Arquivo alvo | Esforço |
|---|----------|-------------|---------|
| 4 | **Player impact score** | `src/db/schema.ts`, `src/scheduler/lineupCheck.ts` | Alto |
| 5 | **Market edge (modelEdge)** | `src/types/index.ts`, `src/analysis/signalGenerator.ts` | Baixo |

### Prioridade Baixa (futuro)

| # | Melhoria | Esforço |
|---|----------|---------|
| 6 | Alpha por liga (ranking de mercados) | Alto |
| 7 | Integração com FM/StatDNA para ligas secundárias | Muito Alto |

---

## Conclusão

O notebook confirma e fundamenta teoricamente várias escolhas arquiteturais do Soccer Exchange (uso de xG, form, ML sobre Poisson). As principais lacunas identificadas são:

1. **Qualidade vs. volume de finalizações** — o xG proxy atual ignora Big Chances
2. **Volatilidade de equipes** — não há σ calculado, apenas médias
3. **Regressão à média** — form recente é tratado como estado permanente
4. **Impacto individual** — lineup check existe mas ajuste de probabilidade é genérico

Essas melhorias podem aumentar a precision dos sinais, especialmente nos mercados BTTS e Under/Over 2.5 que dependem fortemente da qualidade ofensiva real das equipes.
