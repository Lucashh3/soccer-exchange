# ML Pipeline — Plano de Implementação

> Objetivo: substituir o modelo Poisson estático por um modelo de machine learning treinado em dados históricos europeus, com calibração progressiva para ligas brasileiras e outras ligas monitoradas.

---

## Contexto atual

O motor de análise (`src/analysis/index.ts`) usa **distribuição de Poisson** para calcular probabilidades de resultado. O input é `goalsScoredAvg` e `goalsConcededAvg` das duas equipes. O output são probabilidades para 6 mercados: `homeWin`, `draw`, `awayWin`, `btts`, `over25`, `under25`.

**Limitações do modelo atual:**
- Ignora xG, posse, chutes, escanteios, cartões, forma recente
- Sem calibração por liga (Premier League ≠ Brasileirão)
- Sem feedback loop — o modelo nunca aprende com resultados reais
- Confiança calculada de forma heurística (`0.7 * avgQuality`)

---

## Dataset

**Fonte:** [github.com/datasets/football-datasets](https://github.com/datasets/football-datasets)

| Liga | País | Temporadas | Partidas estimadas |
|---|---|---|---|
| Premier League | Inglaterra | 1993/94–2025/26 | ~12.400 |
| La Liga | Espanha | 1993/94–2025/26 | ~12.540 |
| Serie A | Itália | 1993/94–2025/26 | ~12.540 |
| Bundesliga | Alemanha | 1993/94–2025/26 | ~10.100 |
| Ligue 1 | França | 1993/94–2025/26 | ~12.540 |
| **Total** | | | **~60.000 partidas** |

**Features disponíveis por partida:**

| Coluna | Descrição |
|---|---|
| `FTHG` / `FTAG` | Gols FT (home/away) — **target** |
| `FTR` | Resultado FT (H/D/A) — **target** |
| `HTHG` / `HTAG` | Gols HT |
| `HTR` | Resultado HT |
| `HS` / `AS` | Chutes totais |
| `HST` / `AST` | Chutes no alvo |
| `HC` / `AC` | Escanteios |
| `HF` / `AF` | Faltas cometidas |
| `HY` / `AY` | Cartões amarelos |
| `HR` / `AR` | Cartões vermelhos |

**Ausente no dataset:** xG, posse de bola — serão derivados de médias móveis calculadas em runtime a partir do histórico acumulado no banco SQLite.

---

## Arquitetura

```
football-datasets (CSV)
        │
        ▼
ml/scripts/prepare_data.py     ← normaliza, engenharia de features, rolling averages
        │
        ▼
ml/scripts/train.py            ← treina modelos (resultado + gols)
        │
        ▼
ml/models/
  ├── outcome_model.json        ← TF.js LayersModel (H/D/A)
  ├── goals_home_model.json     ← regressão gols home
  └── goals_away_model.json     ← regressão gols away
        │
        ▼
src/analysis/mlPredictor.ts    ← carrega modelos TF.js, expõe predict()
        │
        ▼
src/analysis/index.ts          ← substitui Poisson por mlPredictor (com fallback)
```

**Serviços afetados:** apenas o Express Node.js (`src/`). O scraper Python e o frontend Next.js não precisam de mudanças para o MVP.

---

## Engenharia de Features

O modelo não recebe stats brutas de uma única partida — ele recebe **médias móveis das últimas N partidas** de cada equipe, calculadas dinamicamente.

### Features de entrada (por partida)

Para cada jogo, calculamos janelas de 5 e 10 partidas anteriores para home e away:

```
home_goals_scored_avg5      away_goals_scored_avg5
home_goals_conceded_avg5    away_goals_conceded_avg5
home_shots_avg5             away_shots_avg5
home_shots_on_target_avg5   away_shots_on_target_avg5
home_corners_avg5           away_corners_avg5
home_cards_avg5             away_cards_avg5
home_xg_proxy_avg5          away_xg_proxy_avg5      ← HST/HS ratio × avg goals
home_form_pts5              away_form_pts5          ← pontos nas últimas 5 (3/1/0)
home_form_pts10             away_form_pts10
league_group                                        ← embedding categórico (0–4 Europa, 5 Brasil, etc.)
is_home_advantage                                   ← sempre 1 para home (constante, mas explícito)
```

**Total: ~22 features escalares + 1 categórica (liga)**

### Proxy de xG

Como o dataset não tem xG, computamos um proxy razoável:

```
xg_proxy = (shots_on_target / max(shots, 1)) × goals_scored × 1.1
```

Quando dados reais de xG do Sofascore estiverem disponíveis (como já são scrapeados), eles substituem o proxy automaticamente.

---

## Modelos

### Modelo 1 — Classificação de Resultado (H/D/A)

- **Tipo:** Rede neural feedforward (TensorFlow.js)
- **Input:** 22 features normalizadas
- **Output:** softmax 3 classes `[P(H), P(D), P(A)]`
- **Arquitetura:**
  ```
  Input(22) → Dense(64, relu) → Dropout(0.3) → Dense(32, relu) → Dense(3, softmax)
  ```
- **Loss:** `categoricalCrossentropy`
- **Target:** `FTR` (H=0, D=1, A=2)

### Modelo 2 — Regressão de Gols (home)

- **Tipo:** Regressão
- **Output:** `P(gols_home)` como distribuição — na prática retorna `lambda_home` para alimentar Poisson
- **Arquitetura:**
  ```
  Input(22) → Dense(32, relu) → Dense(16, relu) → Dense(1, linear)
  ```
- **Loss:** `meanSquaredError`
- **Target:** `FTHG`

### Modelo 3 — Regressão de Gols (away)

- Idêntico ao Modelo 2, target = `FTAG`

### Integração com mercados

Os lambdas dos modelos 2 e 3 alimentam a função `buildScoreMatrix()` existente para calcular `btts`, `over25`, `under25`. O modelo 1 substitui diretamente `homeWin`, `draw`, `awayWin`.

---

## Estratégia de Transfer Learning para o Brasil

O modelo treinado em dados europeus terá bias sistemático para ligas brasileiras (home advantage diferente, ritmo de gols diferente, etc.).

**Solução progressiva:**

1. **Fase 1 (agora):** modelo europeu puro, sem calibração
2. **Fase 2 (após ~200 jogos acumulados no DB):** fine-tuning com dados do banco SQLite
   - Salvar resultado real de cada jogo monitorado na tabela `game_outcomes`
   - Script `ml/scripts/finetune.py` carrega pesos europeus e retreina nas últimas camadas com dados locais
3. **Fase 3 (após ~1000 jogos):** modelo híbrido com liga como feature de embedding, separando automaticamente o comportamento por contexto

**Schema novo necessário:**
```sql
CREATE TABLE IF NOT EXISTS game_outcomes (
  game_id TEXT PRIMARY KEY REFERENCES games(id),
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('H', 'D', 'A')),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Estrutura de Arquivos

```
soccer-exchange/
├── ml/
│   ├── data/
│   │   ├── raw/                    ← CSVs do football-datasets (não commitados)
│   │   │   ├── premier-league/
│   │   │   ├── la-liga/
│   │   │   ├── serie-a/
│   │   │   ├── bundesliga/
│   │   │   └── ligue-1/
│   │   └── processed/
│   │       └── features.csv        ← dataset unificado com rolling averages
│   ├── models/
│   │   ├── outcome/                ← TF.js LayersModel (arquivos tfjs)
│   │   ├── goals_home/
│   │   └── goals_away/
│   ├── scripts/
│   │   ├── download_data.sh        ← git clone + organiza CSVs
│   │   ├── prepare_data.py         ← feature engineering
│   │   ├── train.py                ← treinamento dos 3 modelos
│   │   ├── evaluate.py             ← métricas de validação
│   │   └── finetune.py             ← fine-tuning com dados locais (Fase 2)
│   ├── requirements.txt            ← tensorflow, pandas, scikit-learn, numpy
│   └── README.md
│
├── src/
│   ├── analysis/
│   │   ├── mlPredictor.ts          ← NOVO: carrega modelos TF.js, expõe predict()
│   │   ├── index.ts                ← MODIFICADO: usa mlPredictor com fallback Poisson
│   │   └── poisson.ts              ← mantido (fallback + btts/over25)
│   └── db/
│       ├── schema.ts               ← MODIFICADO: adiciona tabela game_outcomes
│       └── queries/
│           └── outcomes.ts         ← NOVO: upsertOutcome, getOutcomes
```

---

## Implementação Detalhada

### Fase 1 — Preparação dos dados e treinamento

#### `ml/scripts/download_data.sh`
```bash
#!/bin/bash
# Clona ou atualiza o repositório de dados
git clone --depth=1 https://github.com/datasets/football-datasets ml/data/football-datasets
# Ou se já existe: git -C ml/data/football-datasets pull
```

#### `ml/scripts/prepare_data.py`
1. Lê todos os CSVs de cada liga
2. Adiciona coluna `league` (string) e `league_id` (int 0–4)
3. Para cada jogo, calcula rolling averages das últimas 5 e 10 partidas de cada equipe:
   - Agrupa por `HomeTeam` e `AwayTeam` separadamente
   - Computa janelas deslizantes sobre `FTHG`, `FTAG`, `HS`, `HST`, `HC`, `HY`, `HR`
4. Descarta partidas sem histórico suficiente (menos de 5 jogos anteriores)
5. Normaliza features com `StandardScaler` (salva scaler como JSON)
6. Salva `ml/data/processed/features.csv` + `ml/data/processed/scaler.json`

#### `ml/scripts/train.py`
1. Carrega `features.csv`
2. Split 80/20 (treino/validação), estratificado por liga
3. Treina os 3 modelos (outcome, goals_home, goals_away)
4. Salva modelos no formato TF.js com `tensorflowjs.converters.save_keras_model()`
5. Salva métricas de validação em `ml/models/metrics.json`

#### `ml/scripts/evaluate.py`
Métricas target:
- Outcome accuracy: > 55% (base de Poisson é ~50%)
- Goals MAE: < 0.8 gols
- Brier score: < 0.22 para cada mercado

### Fase 2 — Integração com o Express

#### `src/analysis/mlPredictor.ts` (novo)
```typescript
import * as tf from '@tensorflow/tfjs-node'
import path from 'path'

interface MLFeatures {
  homeGoalsAvg5: number
  awayGoalsAvg5: number
  homeGoalsConcededAvg5: number
  awayGoalsConcededAvg5: number
  homeShotsAvg5: number
  awayShotsAvg5: number
  homeXgProxy: number
  awayXgProxy: number
  homeCornersAvg5: number
  awayCornersAvg5: number
  homeFormPts5: number
  awayFormPts5: number
  leagueId: number
}

interface MLPrediction {
  homeWin: number
  draw: number
  awayWin: number
  lambdaHome: number
  lambdaAway: number
  source: 'ml' | 'poisson'
}

// Carrega modelos uma vez ao iniciar o servidor
let outcomeModel: tf.LayersModel | null = null
let goalsHomeModel: tf.LayersModel | null = null
let goalsAwayModel: tf.LayersModel | null = null

export async function loadModels(): Promise<void> { ... }
export async function mlPredict(features: MLFeatures): Promise<MLPrediction> { ... }
```

#### `src/analysis/index.ts` (modificado)
- Importa `mlPredict` e `loadModels`
- Tenta usar `mlPredict` primeiro
- Se falhar ou modelo não carregado: fallback para Poisson atual
- Adiciona `source: 'ml' | 'poisson'` no log para monitoramento

### Fase 3 — Feedback loop (game_outcomes)

O scraper já busca o status dos jogos. Quando status mudar para `finished`, salvar resultado real:

```typescript
// src/scheduler/pipeline.ts — após scrape de jogos finalizados
await upsertOutcome(gameId, homeGoals, awayGoals)
```

Script `ml/scripts/finetune.py` roda semanalmente (cron) e:
1. Carrega pesos do modelo europeu
2. Congela todas as camadas exceto as 2 últimas
3. Treina por 10 epochs com dados do DB local
4. Salva novo checkpoint com timestamp

---

## Roadmap

### Milestone 1 — Dados e Treinamento (Semana 1–2)
**Objetivo:** modelos treinados e avaliados localmente

- [ ] `T-01` Criar estrutura de pastas `ml/` e `ml/requirements.txt`
- [ ] `T-02` Escrever `ml/scripts/download_data.sh`
- [ ] `T-03` Implementar `ml/scripts/prepare_data.py` — leitura CSVs + rolling averages
- [ ] `T-04` Validar feature engineering — spot check em 10 jogos aleatórios
- [ ] `T-05` Implementar `ml/scripts/train.py` — 3 modelos
- [ ] `T-06` Implementar `ml/scripts/evaluate.py` — métricas de validação
- [ ] `T-07` Treinar modelos e documentar métricas em `ml/models/metrics.json`
- [ ] `T-08` Converter modelos para formato TF.js

### Milestone 2 — Integração Express (Semana 3)
**Objetivo:** Express usando ML por padrão com fallback Poisson

- [ ] `T-09` Instalar `@tensorflow/tfjs-node` no Express
- [ ] `T-10` Implementar `src/analysis/mlPredictor.ts`
- [ ] `T-11` Modificar `src/analysis/index.ts` para usar mlPredictor com fallback
- [ ] `T-12` Adicionar tabela `game_outcomes` ao schema + queries
- [ ] `T-13` Expor campo `source` nos sinais (resposta da API)
- [ ] `T-14` Testar pipeline completo: scrape → análise ML → sinais gerados

### Milestone 3 — Feedback Loop (Semana 4–5)
**Objetivo:** modelo aprende com dados reais acumulados

- [ ] `T-15` Modificar pipeline para salvar resultados finais em `game_outcomes`
- [ ] `T-16` Implementar `ml/scripts/finetune.py`
- [ ] `T-17` Criar cron job semanal para fine-tuning automático
- [ ] `T-18` Dashboard: badge "ML" vs "Poisson" nos sinais
- [ ] `T-19` Avaliar acurácia do modelo pós fine-tuning vs baseline

### Milestone 4 — Mercados Avançados (Semana 6+)
**Objetivo:** expandir para mercados que o Poisson atual não cobre bem

- [ ] `T-20` Modelo específico para BTTS (binary classifier)
- [ ] `T-21` Modelo para over/under 2.5 (binary classifier com threshold calibrado)
- [ ] `T-22` Avaliar viabilidade de modelo de escanteios (`over 9.5 corners`)
- [ ] `T-23` Explorar calibração Platt scaling para probabilidades finais

---

## Decisões de Arquitetura

| Decisão | Escolha | Alternativa considerada | Motivo |
|---|---|---|---|
| Framework ML | TF.js (`@tensorflow/tfjs-node`) | Python Flask API separada | Evita novo serviço; modelos rodam no mesmo processo Express |
| Formato de modelos | TF.js LayersModel | ONNX | Ecossistema nativo JS; sem dependência extra |
| Treinamento | Python (TensorFlow 2) | TF.js Node | Python tem pandas/sklearn para feature engineering; melhor DX |
| Dados históricos | football-datasets (GitHub) | Footystats API, StatsBomb | Open source, domínio público, sem custo, 60k partidas |
| Proxy xG | `HST/HS × goals × 1.1` | Ausente | Melhor que zero; substituído por real quando disponível |
| Fallback | Poisson atual | Nenhum | Segurança: se modelo não carregado, sistema continua funcionando |
| Fine-tuning | Últimas 2 camadas congeladas | Full retrain | Preserva features europeias aprendidas; adapta apenas output |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Modelo europeu superestima home win para ligas brasileiras | Alta | Médio | Feature `league_id` + fine-tuning progressivo |
| `@tensorflow/tfjs-node` aumenta tempo de boot do Express | Média | Baixo | `loadModels()` é assíncrono, não bloqueia rotas |
| Partidas insuficientes para fine-tuning significativo | Alta (curto prazo) | Baixo | Fallback Poisson até acumular >200 jogos |
| Dataset europeu desatualizado entre scrapes | Baixa | Baixo | Repo atualiza diariamente via CI |
| Overfitting no fine-tuning com poucos dados brasileiros | Média | Médio | Early stopping + learning rate baixo (1e-5) |

---

## Dependências

### Python (ml/)
```
tensorflow>=2.13
tensorflowjs>=4.10
pandas>=2.0
scikit-learn>=1.3
numpy>=1.24
```

### Node.js (Express)
```
@tensorflow/tfjs-node  (adicionar ao package.json)
```

---

## Referências

- [football-data.co.uk column definitions](https://www.football-data.co.uk/notes.txt)
- [TF.js Node docs](https://js.tensorflow.org/api_node/latest/)
- [Dixon-Coles model (Poisson corrigido para 0-0/1-0/0-1)](https://www.sciencedirect.com/science/article/abs/pii/S0035900797000064)
- [Calibração de probabilidades — Platt Scaling](https://scikit-learn.org/stable/modules/calibration.html)
