# Plano de Implementacao - Correcao de Sinais Pre-Jogo

## Objetivo

Corrigir inconsistencias de recomendacao (ex.: `layAway` quando o visitante e claramente favorito) na geracao de sinais pre-jogo, sem degradar a performance global dos mercados.

Este plano foi escrito para execucao por multiplos agentes de IA em paralelo, com etapas independentes, criterios de aceite claros e estrategia de rollout seguro.

---

## Problema observado

Em alguns jogos, o pipeline publica sinais contraditorios com o contexto estatistico (favoritismo, forma, medias de gol/xG), principalmente no mercado 1x2.

### Causas provaveis no estado atual

1. No 1x2, quando o modelo ML esta carregado, as probabilidades de `homeWin/draw/awayWin` sao usadas diretamente, sem calibracao por baseline estatistico.
2. As regras de emissao de `layHome`/`layAway` sao sensiveis a variacoes da probabilidade prevista e nao possuem guardrails de coerencia contextual.
3. Nao ha trilha de auditoria detalhada para explicar por que um sinal foi emitido.
4. Features inconsistentes (dados faltantes/anomalos) podem degradar a predicao.
5. Sinal pre-jogo pode permanecer visivel em jogo ao vivo sem contextualizacao explicita.

---

## Escopo

### Dentro do escopo

- Melhorar decisao de sinais pre-jogo (especialmente 1x2 e lays).
- Aumentar observabilidade e auditabilidade da decisao.
- Fortalecer validacao de dados de entrada.
- Introduzir rollout gradual com feature flags.
- Definir suite de backtest e criterios de aceite.

### Fora do escopo (neste ciclo)

- Reescrever o modelo ML do zero.
- Criar um motor live completo de trading in-play.
- Alterar UI/UX profunda do frontend (apenas ajustes de rotulo/contexto, se necessario).

---

## Arquivos alvo

- `src/analysis/index.ts`
- `src/analysis/mlPredictor.ts` (somente se precisar telemetria adicional)
- `src/parsers/sofascoreParser.ts`
- `src/db/schema.ts`
- `src/db/queries/signals.ts`
- `src/scheduler/pipeline.ts`
- `frontend-next/types/index.ts` (se novos campos forem exibidos)
- `frontend-next/components/signals/SignalCard.tsx` (rotulo pre/live, opcional)

---

## Arquitetura proposta (alto nivel)

1. **Camada de Qualidade de Dados**
   - Sanitiza features e identifica inconsistencias.
2. **Camada de Probabilidade**
   - Combina previsao ML com baseline estatistico (ensemble).
3. **Camada de Guardrails**
   - Impede sinais contraditorios em cenarios de favoritismo claro.
4. **Camada de Publicacao**
   - Publica sinal + metadata de explicacao/auditoria.
5. **Camada de Observabilidade**
   - Salva os drivers da decisao para analise posterior.

---

## Plano de implementacao por fases

## Fase 0 - Preparacao e baseline (1 dia)

### Tarefas

1. Congelar baseline atual (antes de mudancas):
   - Taxa de sinais por mercado
   - Taxa de contradicao (definicao abaixo)
   - Brier score 1x2
   - ROI simulado por mercado (se disponivel)
2. Definir oficialmente a metrica de contradicao:
   - Exemplo: sinal `layAway` com `awayWin_baseline >= 0.55`.
3. Criar checklist de regressao minima.

### Criterio de aceite

- Arquivo de baseline salvo em `docs/metrics-baseline-sinais.md`.

---

## Fase 1 - Observabilidade e auditoria (1-2 dias)

### Tarefas

1. Adicionar trilha de decisao por jogo/sinal:
   - `model_source` (`ml`/`poisson`)
   - `p_ml_home/draw/away`
   - `p_base_home/draw/away`
   - `p_final_home/draw/away`
   - `rules_triggered` (lista de guardrails acionados)
   - `feature_quality_score`
2. Persistir debug:
   - Opcao A: nova tabela `signal_debug`
   - Opcao B: colunas novas em `signals` (menos flexivel)
3. Expor endpoint de debug (somente ambiente interno):
   - Ex.: `GET /signals/debug/:gameId`

### Criterio de aceite

- Para qualquer sinal publicado, e possivel responder: "qual regra/modelo gerou este sinal e por que".

---

## Fase 2 - Qualidade de features (1-2 dias)

### Tarefas

1. Validar coerencia de campos no parser:
   - `shots_avg >= shots_on_target_avg` (ou ajustar quando fonte estiver invertida)
   - ranges plausiveis para xG, gols, posse, corners, cards
2. Implementar imputacao conservadora para dados faltantes/anomalos.
3. Calcular `feature_quality_score` (0-1) por time e por jogo.
4. Bloquear sinais agressivos (lays) quando qualidade estiver abaixo de limite.

### Criterio de aceite

- Nenhum jogo com anomalia forte gera lay agressivo sem override explicito.

---

## Fase 3 - Ensemble de probabilidades 1x2 (2 dias)

### Tarefas

1. Criar baseline pre-jogo (Poisson/forca estatistica) para `home/draw/away`.
2. Combinar previsoes:
   - `p_final = w_ml * p_ml + (1 - w_ml) * p_base`
3. Ajustar pesos iniciais por confianca:
   - Exemplo inicial:
     - qualidade alta: `w_ml = 0.60`
     - qualidade media: `w_ml = 0.50`
     - qualidade baixa: `w_ml = 0.35`
4. Normalizar probabilidades para soma ~1.0 apos blending.

### Criterio de aceite

- Reducao relevante de contradicoes sem piora significativa de calibracao global.

---

## Fase 4 - Guardrails de decisao para lay/back (2 dias)

### Tarefas

1. Definir regras objetivas para `layAway` e `layHome`:
   - Nao emitir `layAway` se visitante e favorito claro no baseline, a menos que `p_final_away` esteja abaixo de limiar estrito.
   - Nao emitir `layHome` se mandante e favorito claro no baseline, criterio analogo.
2. Priorizar sinal menos contraditorio quando dois lays passarem threshold.
3. Criar fallback para "sem sinal 1x2" quando conflito de regras for alto.

### Parametros iniciais (sugestao)

- Favorito claro: `p_base >= 0.55`
- Limiar de lay: `1 - p_final >= 0.65`
- Excecao para contrariar favorito claro: somente se `p_final_favorito <= 0.35` e `feature_quality_score >= 0.70`

### Criterio de aceite

- Casos como Lecce x Atalanta deixam de gerar `layAway` pre-jogo.

---

## Fase 5 - Politica para jogo ao vivo (1 dia)

### Tarefas

1. Definir regra de exibicao para sinal pre-jogo durante live:
   - opcao recomendada: manter, mas com rotulo explicito `pre-match`.
2. Opcional: ocultar/atenuar sinais pre-jogo apos minuto X.
3. Opcional: reprocessar analise em eventos de status importantes.

### Criterio de aceite

- Usuario entende claramente se o sinal e pre-jogo ou adaptado ao vivo.

---

## Fase 6 - Backtest, rollout e monitoramento (2 dias)

### Tarefas

1. Rodar backtest comparativo "antes vs depois" por liga e mercado.
2. Ativar feature flags:
   - `SIGNAL_ENSEMBLE_ENABLED`
   - `SIGNAL_GUARDRAILS_ENABLED`
   - `SIGNAL_FEATURE_QUALITY_GATE_ENABLED`
3. Executar rollout em 3 etapas:
   - shadow mode (calcula, nao publica)
   - 20% jogos
   - 100%
4. Monitorar por 7 dias:
   - contradicoes
   - cobertura de sinais
   - hit-rate/ROI

### Criterio de aceite

- Contradicao reduzida com estabilidade operacional.

---

## Divisao de trabalho para multiplos agentes de IA

## Agente A - Analise/Signals

- Implementar ensemble + guardrails em `src/analysis/index.ts`.
- Adicionar logs estruturados de decisao.

## Agente B - Dados/Parser

- Implementar validacao e saneamento em `src/parsers/sofascoreParser.ts`.
- Produzir `feature_quality_score`.

## Agente C - DB/Observabilidade

- Migracao em `src/db/schema.ts`.
- Query helpers em `src/db/queries/signals.ts` para debug.

## Agente D - Scheduler/API

- Ajustar politica pre-jogo/live em `src/scheduler/pipeline.ts` e rotas necessarias.

## Agente E - Frontend (opcional)

- Exibir badge `Pre-match`/`Live` e (se habilitado) resumo de confianca/qualidade.

### Regra de integracao entre agentes

1. Cada agente abre PR separado por fase.
2. Nao misturar schema migration com mudanca de regra de negocio no mesmo PR.
3. Merge order recomendado:
   1) observabilidade/schema
   2) qualidade de features
   3) ensemble/guardrails
   4) frontend

---

## Testes obrigatorios

## Unitarios

- Regras de guardrail (`layAway` bloqueado em favorito claro)
- Normalizacao de probabilidades apos ensemble
- Sanitizacao de features anomalas

## Integracao

- Pipeline completo em jogo sintetico com dados consistentes
- Pipeline com dados inconsistentes (deve cair em modo conservador)

## Regressao

- Caso de controle: Lecce x Atalanta pre-jogo nao pode produzir `layAway` sem evidencia forte.

---

## Definicao de pronto (DoD)

- [ ] Auditoria de sinal implementada e consultavel
- [ ] Guardrails ativos via flag
- [ ] Ensemble 1x2 ativo via flag
- [ ] Validacao de feature ativa
- [ ] Testes unitarios e integracao passando
- [ ] Backtest comparativo documentado
- [ ] Rollout gradual concluido
- [ ] Playbook de rollback pronto

---

## Rollback

Em caso de degradacao:

1. Desativar flags:
   - `SIGNAL_ENSEMBLE_ENABLED=false`
   - `SIGNAL_GUARDRAILS_ENABLED=false`
   - `SIGNAL_FEATURE_QUALITY_GATE_ENABLED=false`
2. Manter somente observabilidade para diagnostico.
3. Reavaliar thresholds e reexecutar shadow mode.

---

## Riscos e mitigacoes

1. **Risco:** excesso de conservadorismo (menos sinais)
   - **Mitigacao:** ajuste gradual de thresholds por liga.
2. **Risco:** aumento de complexidade operacional
   - **Mitigacao:** feature flags + auditoria + testes de regressao.
3. **Risco:** conflito entre agentes em arquivos centrais
   - **Mitigacao:** dividir por fase e ordem de merge definida.

---

## Entregaveis finais esperados

1. Codigo com guardrails + ensemble + data quality gates.
2. Migracao/estrutura de debug de sinal.
3. Relatorio de backtest antes/depois.
4. Guia operacional de rollout e rollback.

---

## Notas de operacao

- Priorizar corrigir erros graves de direcao (contradicao de favorito) antes de otimizar ROI fino.
- Em ambientes com baixa qualidade de dado, preferir "sem sinal" a sinal forte contraditorio.
- Toda nova regra deve ser explicavel no debug para facilitar analise humana e por agentes.
