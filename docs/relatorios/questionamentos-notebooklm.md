# Questionamentos para NotebookLM (futebol)

Use este roteiro para consultar manualmente os 2 notebooks de futebol:

- `Football Statistics & Leaderboards`
- `A Revolução dos Dados: Estatísticas, Gestão e Probabilidades no Futebol`

Objetivo: identificar por que as sugestoes de entrada estao inconsistentes com o contexto real do jogo e obter um plano concreto de correcao (incluindo avaliacao do TensorFlow).

## Como usar

1. Rode os prompts abaixo no primeiro notebook.
2. Repita os mesmos prompts no segundo notebook.
3. Cole as respostas brutas em um novo arquivo em `docs/relatorios/` ou me envie no chat.
4. Eu consolido tudo e transformo em plano de execucao tecnico.

## Prompt 1 - Diagnostico de inconsistencias

"Estou enfrentando inconsistencias nas sugestoes de entrada para jogos de futebol. Liste as 15 causas mais provaveis de desalinhamento entre recomendacao e contexto real do jogo. Para cada causa, traga: (a) sintoma observado, (b) como medir, (c) impacto esperado no resultado, (d) acao corretiva."

## Prompt 2 - Framework completo de analise por mercado

"Monte um framework auditavel de analise pre-jogo e ao vivo para os mercados 1x2, over/under, BTTS e cantos. Estruture em tabela com: variavel, definicao, fonte de dados, janela temporal, limiar recomendado, peso no score e observacoes. Separar em hard filters (bloqueiam entrada) e sinais de confianca (ajustam stake/odd minima)."

## Prompt 3 - Hierarquia de decisao e score

"Proponha uma logica de decisao em camadas para sugestao de entrada:
1) validacao de qualidade dos dados,
2) filtros obrigatorios,
3) score de contexto,
4) score estatistico,
5) score de mercado (valor/odd),
6) gatilho final.
Inclua formula sugerida, pesos por camada e regras de no-bet."

## Prompt 4 - Gatilhos de invalidação (kill-switch)

"Liste gatilhos objetivos que devem invalidar entrada antes e durante o jogo. Incluir no minimo: lesoes de ultima hora, mudanca tatica, rotacao, calendario apertado, clima extremo, arbitragem, red card, dominio territorial divergente, xG vivo divergente, pressao sem finalizacao qualificada, e variacao abrupta de odd sem justificativa. Traga limiares numericos quando possivel."

## Prompt 5 - Checklist de contexto real do jogo

"Crie um checklist operacional (pre-jogo e live) para garantir aderencia ao contexto real do jogo. Incluir: elenco disponivel, motivacao competitiva, importancia da partida, viagem/fadiga, estilo de jogo e match-up, arbitragem, clima/gramado, padrao recente, e estado emocional do jogo. Para cada item, informe como pontuar de 0 a 2 e quando isso reduz ou cancela entrada."

## Prompt 6 - Formato anti-alucinacao da sugestao

"Defina um formato obrigatorio de explicacao de entrada para evitar alucinacao analitica. Quero um template com: mercado, direcao, odd minima justa, probabilidade estimada, edge, evidencias principais (max 5), contraevidencias (max 3), condicoes de invalidacao, confianca (0-100), stake sugerida e motivo do no-bet quando aplicavel."

## Prompt 7 - Backtesting e validacao

"Proponha um protocolo de validacao para medir se as correcoes melhoram as sugestoes: split temporal, walk-forward, metricas (ROI, hit rate, CLV, max drawdown, calibration), testes de robustez e criterios de aprovacao/reprovacao para entrar em producao."

## Prompt 8 - TensorFlow: avaliacao critica

"Avalie criticamente se o uso de TensorFlow faz sentido neste tipo de pipeline de sugestao de entradas em futebol. Responda:
1) Em quais cenarios TensorFlow agrega valor real,
2) Em quais cenarios modelos mais simples (logistica, gradient boosting, regressao de Poisson, modelos bayesianos) tendem a performar igual ou melhor,
3) Sinais de overfitting e leakage,
4) Riscos de baixa interpretabilidade para operacao de trade,
5) Recomendacao pratica: manter TF, simplificar, ou substituir parcialmente,
6) Plano de comparacao A/B com criterios objetivos de decisao."

## Prompt 9 - Feature engineering e leakage

"Liste features recomendadas e features perigosas para leakage em modelos de futebol pre-live e live. Para cada feature, classifique: segura, risco medio, alto risco. Explique por que e como blindar leakage na engenharia de atributos e no treino."

## Prompt 10 - Entrega final que eu preciso receber

"Com base em tudo acima, gere uma proposta final em 3 blocos:
Bloco A: correcoes imediatas (alto impacto, baixa complexidade),
Bloco B: melhorias estruturais (medio prazo),
Bloco C: pesquisa/experimentacao (longo prazo).
Para cada item, incluir prioridade, esforco estimado, risco e KPI de sucesso."

## Formato de retorno (copiar e preencher)

Quando me devolver, tente organizar assim:

```md
# Respostas NotebookLM - [nome do notebook]

## Prompt 1
Com base na nossa arquitetura discutida para o `soccer-exchange` e nas melhores práticas documentadas por modeladores quantitativos e traders profissionais, aqui estão as 15 causas mais prováveis para o desalinhamento entre o sinal gerado e a realidade do jogo. 

Este framework servirá como um checklist de auditoria para o seu sistema:

### ⚙️ Falhas de Arquitetura e Matemática (O Motor)

**1. Falta de Correção de Dixon-Coles no Modelo de Poisson**
*   **(a) Sintoma:** O modelo sugere muitos sinais de *Over 2.5* ou *Lay 0-0* que terminam em placares magros.
*   **(b) Como medir:** Compare a frequência de empates (0-0, 1-1) prevista pelo modelo com a frequência real observada nas ligas.
*   **(c) Impacto:** O modelo de Poisson puro subestima empates de baixa pontuação, gerando falsos positivos em mercados de gols.
*   **(d) Ação Corretiva:** Implementar o parâmetro `rho` de Dixon-Coles para criar dependência entre os gols e inflar matematicamente a probabilidade de placares baixos.

**2. Benchmark Incorreto de Odds (Soft vs. Sharp)**
*   **(a) Sintoma:** O painel indica muito +EV, mas a banca (bankroll) está estagnada ou caindo a longo prazo.
*   **(b) Como medir:** Calcule se as odds sugeridas batem o *Closing Line Value* (CLV) da Pinnacle.
*   **(c) Impacto:** Falsa sensação de vantagem. Comparar suas probabilidades com a Bet365 (que tem margens maiores) infla o aparente Retorno sobre Investimento (ROI).
*   **(d) Ação Corretiva:** Usar odds de fechamento de corretoras *sharp* (Pinnacle/Betfair Exchange) com a margem (vig) removida como linha base.

**3. Ausência de Fator de Decaimento Temporal (Time Decay de Forma)**
*   **(a) Sintoma:** O modelo supervaloriza uma equipe que foi excelente na temporada passada, mas está mal agora (ex: Sheffield United em 20/21).
*   **(b) Como medir:** Avalie o *Ranked Probability Score* (RPS) do modelo. Se o erro for alto em times que mudaram de fase, o decaimento está falho.
*   **(c) Impacto:** Precificação baseada em glórias passadas, ignorando a forma técnica atual.
*   **(d) Ação Corretiva:** Aplicar decaimento exponencial (ex: `exp(-xi * t)`), dando peso muito maior aos jogos das últimas 5 semanas.

**4. Ruído de Início de Temporada (Small Sample Size)**
*   **(a) Sintoma:** Sinais extremamente erráticos e prejuízos nas primeiras 5 a 6 rodadas do campeonato.
*   **(b) Como medir:** Segregue o ROI do modelo por rodada. As rodadas iniciais terão alta variância.
*   **(c) Impacto:** Times recém-promovidos ou elencos reformulados quebram as predições matemáticas.
*   **(d) Ação Corretiva:** Aplicar "Encolhimento Bayesiano" (Bayesian Shrinkage), puxando as estatísticas dos times em direção à média da liga até a 6ª rodada.

**5. Subestimação Crônica do 0-0 (Zero-Inflated Data)**
*   **(a) Sintoma:** Mesmo com Dixon-Coles, grandes favoritos empatam em 0-0 e o modelo não previu o risco.
*   **(b) Como medir:** Verifique o % de resultados 0-0 reais (geralmente ~6-8%) contra a predição do modelo.
*   **(c) Impacto:** Perda de *stakes* em mercados de *Over 0.5 HT* ou *Match Odds*.
*   **(d) Ação Corretiva:** Utilizar modelos de "Poisson Zero-Inflado", que injetam uma probabilidade extra na chance de nenhuma das equipes marcar.

**6. Delegação da Decisão para a IA (Alucinação da LLM)**
*   **(a) Sintoma:** Primeira semana de lucros, seguida de um ROI de -6.0% e quedas inexplicáveis nos acertos.
*   **(b) Como medir:** Tente reproduzir a matemática exata de por que a LLM sugeriu a entrada. Será impossível.
*   **(c) Impacto:** A IA sofre de viés narrativo e destrói o raciocínio estocástico.
*   **(d) Ação Corretiva:** O Node.js/Python faz 100% da matemática e decide a aposta. A LLM apenas redige a explicação baseada no output dos números.

---

### 📡 Falhas em Dados e Tempo Real (In-Play)

**7. Ignorar o Impacto das Escalações Confirmadas**
*   **(a) Sintoma:** Sinal pré-jogo de "Value Bet" num favorito, mas o time não consegue criar chances reais.
*   **(b) Como medir:** Cruzar a expectativa de xG base com o xG histórico *apenas dos 11 titulares em campo*.
*   **(c) Impacto:** Apostar no peso da "camisa", ignorando que o time está com reservas.
*   **(d) Ação Corretiva:** O sinal final só pode ser disparado 20 a 50 minutos antes do jogo, descontando o poder de fogo de astros ausentes.

**8. Latência na Ingestão de Dados In-Play**
*   **(a) Sintoma:** O alerta de "Entrar" chega no dashboard, mas a linha (odd) já derreteu ou o mercado foi suspenso.
*   **(b) Como medir:** Subtraia o timestamp do sinal do seu sistema do timestamp do evento na API.
*   **(c) Impacto:** Execução impossível ou entrada em uma odd sem +EV (sem valor).
*   **(d) Ação Corretiva:** Migrar conexões REST (polling) para WebSockets, garantindo recebimento de pressão (PPM) em milissegundos.

**9. Ignorar a Liquidez do Mercado (Exchanges)**
*   **(a) Sintoma:** Sinal validado, aposta colocada, mas não é possível fazer *Cash Out* (Hedging) depois do gol.
*   **(b) Como medir:** Verifique o "Volume Correspondido" (Matched Volume) da partida na API da Betfair.
*   **(c) Impacto:** Ficar "preso" na posição, transformando um trade seguro em um jogo de azar (Red total).
*   **(d) Ação Corretiva:** Hard filter no código: Abortar sinal se a liquidez do mercado for menor que $X mil.

---

### 🧠 Falhas de Leitura Tática (Contexto)

**10. Confundir "Posse Estéril" com Ameaça (Falta de xGOT)**
*   **(a) Sintoma:** O time tem 70% de posse e 15 chutes, o alerta de gols dispara, mas o jogo termina 0-0.
*   **(b) Como medir:** Checar o xGOT (Expected Goals on Target) vs. Chutes totais.
*   **(c) Impacto:** Entrar a favor de um time que só chuta bloqueado de fora da área.
*   **(d) Ação Corretiva:** Inserir a regra: Se (Posse > 60%) MAS (xGOT < 0.5), gerar alerta de "Falso Domínio".

**11. Viés do "Efeito Placar" (Game State Ignorance)**
*   **(a) Sintoma:** O algoritmo aponta "Pressão Máxima" nos últimos 15 minutos para o time A.
*   **(b) Como medir:** Avalie o placar atual. O time A está perdendo de 2-0?
*   **(c) Impacto:** Confundir um "bloco baixo" proposital do adversário vencedor com uma genialidade ofensiva do perdedor.
*   **(d) Ação Corretiva:** Descontar peso do Momentum/PPM de acordo com a diferença de gols no placar.

**12. Má Leitura de Cartões Vermelhos**
*   **(a) Sintoma:** Um time recebe vermelho, as odds do adversário despencam (1.20), o sistema manda entrar, mas o adversário não marca.
*   **(b) Como medir:** Avalie o xT (Expected Threat) do time com 11 homens contra o bloco de 10.
*   **(c) Impacto:** Assumir risco gigante (Back a 1.20) contra um time que simplesmente "estacionou o ônibus" e fechou a área.
*   **(d) Ação Corretiva:** Em caso de expulsão, congelar modelos pré-jogo e depender 100% de métricas live de quebra de linha (xA, xT).

**13. Overfitting de Momentum Curto (Bolha de 5 min)**
*   **(a) Sintoma:** Alerta de "Pressão" dispara, o trader entra, e o time imediatamente para de atacar.
*   **(b) Como medir:** Avaliar o tempo sustentado da intensidade.
*   **(c) Impacto:** Entrar no trade exatamente no momento em que a equipe precisa "respirar" fisicamente.
*   **(d) Ação Corretiva:** Exigir no mínimo 2 blocos consecutivos de 10 minutos de alto PPM para validar um cerco real.

**14. Falha na Leitura de Fadiga (PPDA)**
*   **(a) Sintoma:** Back no visitante aos 80 minutos num jogo empatado, mas eles tomam gol de contra-ataque.
*   **(b) Como medir:** Monitorar a métrica PPDA (Passes Per Defensive Action) nos minutos finais.
*   **(c) Impacto:** Ignorar que o time que pressionou o jogo todo está fisicamente esgotado e exposto.
*   **(d) Ação Corretiva:** Se PPDA do time atacante subir muito no final do jogo, cancelar sinais de *Back* e buscar sinais de *Lay*.

**15. Ignorar a Motivação / Fatores Extracampo**
*   **(a) Sintoma:** Favorito absoluto em casa (odd 1.30) poupa jogadores ou joga desmotivado contra time na zona de rebaixamento.
*   **(b) Como medir:** Analisar o calendário (jogo de copa daqui a 3 dias?) ou status do campeonato (já campeão?).
*   **(c) Impacto:** A matemática de longo prazo é distorcida por um evento onde 100% do esforço não está sendo aplicado.
*   **(d) Ação Corretiva:** O scraper de notícias/LLM deve classificar o jogo como "Alto Risco de Rotação", diminuindo a *Stake* recomendada pela metade.

## Prompt 2
Com base nas melhores práticas de modelagem quantitativa, plataformas de dados avançados (como FBref, Sportmonks e Understat) e nas dinâmicas de *exchanges* e corretoras *sharp*, estruturei o framework auditável para o seu projeto `soccer-exchange`. 

Este framework divide a análise em **Hard Filters** (disjuntores que impedem uma entrada ruim, protegendo o capital) e **Sinais de Confiança** (que validam a tese, ajustam a *stake* e definem a odd mínima de valor).

### 🛑 PARTE 1: Hard Filters (Filtros de Exclusão)
Estes critérios **bloqueiam** a recomendação da API. Se qualquer um destes for verdadeiro, o sistema não deve emitir sinal, independentemente de quão bons sejam os números de ataque/defesa.

| Variável | Definição | Fonte de Dados | Janela Temporal | Limiar Recomendado (Bloqueia se...) | Peso no Score | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Edge (+EV)** | Diferença entre a prob. do modelo e a odd implícita *Vig-Free* do mercado sharp | Pinnacle / Betfair / OddsPortal | Live (Momento do cálculo) | **< 3% de Edge** | Bloqueio | Impede apostas em odds amassadas. Se o mercado sharp precifica melhor, aborte. |
| **Liquidez (Matched Vol)** | Volume financeiro correspondido no mercado da *exchange* | API Betfair / Geeks Toy | Live | **< $5k - $10k** | Bloqueio | Sem liquidez, o trader fica preso no trade e não consegue fazer *Cash Out*. |
| **Status da Escalação** | Validação dos XI iniciais cruzados com o xG base da equipe | Sportmonks / FotMob | Pré-jogo (50-20 min antes) | **XI Não Confirmado** | Bloqueio | O modelo deve rodar a versão final apenas após o XI oficial, subtraindo o xG de estrelas ausentes. |
| **Falso Domínio** | Posse de bola alta, muitos chutes, mas sem perigo real para o goleiro | FBref / Flashscore | In-Play (Últimos 15-30 min) | **Posse > 60% E xGOT < 0.5** | Bloqueio (para Backs) | Evita o "Back Favorito" em times com posse estéril contra blocos baixos. |
| **Ruído de Amostragem** | Jogos nas rodadas iniciais da temporada com elencos alterados | Transfermarkt / API | Pré-jogo | **Rodada < 6** | Bloqueio / Redução Stake | Usar "Encolhimento Bayesiano" (puxar p/ a média) para evitar distorções estatísticas iniciais. |

---

### 🟢 PARTE 2: Sinais de Confiança (Validação por Mercado)
Estes parâmetros geram o *Score* final de 0 a 100 da sua API. Eles modulam o grau de confiança da entrada e o tamanho da *stake* recomendada.

#### 1. Mercado: 1X2 (Match Odds / Back e Lay)
Focado em prever o vencedor ou explorar assimetrias de favoritismo.

| Variável | Definição | Fonte de Dados | Janela Temporal | Limiar Recomendado (+ Confiança) | Peso no Score | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Projeção xG (Dixon-Coles)** | Expectativa de gols usando Poisson com ajuste p/ empates e *Time Decay* | Modelo Node.js Próprio | Pré-jogo (pesando últimos 5-10 jgs) | **Prob > 55% / xG Diff > 1.2** | 35% | O ajuste de Dixon-Coles corrige a subestimação crônica de 0-0 e 1-0 do modelo Poisson. |
| **xGOT (xG on Target)** | Qualidade de execução das finalizações que acertam o gol | Flashscore / Sportmonks | In-Play | **xGOT Casa > 1.5** | 30% | Separa chutes de longe/ruins de perigo real. Ótimo gatilho para Back In-Play. |
| **xT / PPM (Momentum)** | Pressão e ameaça de posse em zonas perigosas (Expected Threat) | Soccerment / API | In-Play (Blocos de 10-15 min) | **PPM Forte e Sustentado** | 25% | Essencial para capturar a quebra defensiva no 2º tempo (Late Home Press). |
| **Game State (Motivação)** | Contexto do placar limitando a atitude tática | Placar Live | In-Play | **Favorito perdendo/empatado** | 10% | O modelo deve ajustar o peso da pressão se o time forte estiver em desespero. |

#### 2. Mercado: Over/Under Gols (Ex: Over 2.5 / Lay 0-0)
Focado no fluxo da partida, letalidade ofensiva e espaços na defesa.

| Variável | Definição | Fonte de Dados | Janela Temporal | Limiar Recomendado (+ Confiança) | Peso no Score | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **xG Total Combinado** | Soma do poder ofensivo vs vulnerabilidade defensiva (xGa) | Modelo Node.js | Pré-jogo (Forma recente) | **Soma xG > 2.85** | 40% | Base multiplicativa: Ataque Casa * Defesa Visitante * Média Liga. |
| **Decaimento Temporal** | Pressão que o relógio exerce sobre as odds de *Under/Empate* | Exchange (Betfair) | In-Play (Específico ao minuto) | **Queda brusca da Odd** | 25% | Útil para a estratégia de saída (*Hedging/Cash Out*) em *Lay 0-0* ou *Lay The Draw*. |
| **Qualidade da Criação (xA)** | Expected Assists combinados de ambas as equipes | FBref / Understat | Pré-jogo | **Alto volume de xA** | 20% | Se as equipes criam muito, a ausência de um artilheiro (variância) não afeta tanto o Over. |
| **One-Twos e Transições** | Equipes com altos índices de passes rápidos/contra-ataque | Soccerment | Pré-jogo | **Alta taxa de One-Twos** | 15% | Equipes rápidas quebram defesas compactas e furam mercados de Under. |

#### 3. Mercado: BTTS (Both Teams To Score / Ambas Marcam)
Focado na probabilidade de os dois lados perfurarem a defesa adversária.

| Variável | Definição | Fonte de Dados | Janela Temporal | Limiar Recomendado (+ Confiança) | Peso no Score | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Defensiva PPDA** | Passes permitidos por ação defensiva (Intensidade de Pressão) | FBref / Sportmonks | In-Play e Recente | **PPDA < 10 para ambas** | 35% | Pressão alta gera contra-ataques letais e falhas perto da área. Ótimo para BTTS. |
| **xG Concedido (xGa)** | Gols esperados contra cada defesa | Understat / FBref | Pré-jogo (Sazonal) | **xGa > 1.30 p/ ambas** | 35% | Mostra que nenhuma defesa é sólida o suficiente para garantir um *Clean Sheet* (0 sofridos). |
| **Desvio Padrão Ofensivo** | Consistência de marcação fora de casa vs em casa | Dados Históricos | Pré-jogo | **Visitante constante** | 30% | Muitas vezes o Visitante falha. O BTTS só é forte se o Visitante tem alto xG fora. |

#### 4. Mercado: Cantos (Escanteios)
Mercado de nicho altamente dependente de desespero in-play e amplitude tática.

| Variável | Definição | Fonte de Dados | Janela Temporal | Limiar Recomendado (+ Confiança) | Peso no Score | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Game State / Tempo** | Placar desfavorável para o favorito gerando cerco total | Placar Live | In-Play (70' aos 90') | **Favorito perdendo 1 gol** | 45% | O maior motor de cantos é o desespero de um time forte encurralando um bloco baixo. |
| **Heatmap / Zonas de Ataque** | Concentração das jogadas pelos flancos vs meio-campo | SofaScore / WhoScored | Pré/In-Play | **> 65% posse nas alas** | 30% | Cruzamentos constantes geram cortes e bloqueios pela linha de fundo. |
| **AERO Ofensivo/Defensivo** | Qualidade de duelos aéreos ganhos na área (Zagueiros vs Atacantes) | Soccerment | Pré-jogo | **Ataque forte no AERO** | 25% | Times que ganham duelos aéreos forçam defensores a cederem cantos por precaução. |

---

### 📝 Como estruturar o Output da IA (A Explicação da Sugestão)

No JSON de retorno da sua API REST, a IA deve atuar apenas como **Narradora e Auditora de Risco**, usando as variáveis acima. O formato visual do *Dashboard* do trader deve ser:

1. **🚨 O Sinal +EV:** (Ex: BACK MANDANTE @ Odd 2.45 | Edge + 7.2%)
2. **⚙️ O Motor (Matemática):** (Ex: O modelo Dixon-Coles aponta odd justa de 2.25. xG projetado: 1.8 vs 0.6).
3. **🧠 Contexto Live (LLM):** (Ex: *O Visitante está em bloco baixo após expulsão. Mandante com PPM Extremo (95/100) e xGOT crescente. Exaustão defensiva (Aumento de PPDA) indica quebra iminente*).
4. **🛑 Risco / Saída:** (Ex: *Hard Filter de Liquidez aprovado. Trade In-Play de alto risco. Sugestão: Cash Out com 30% de lucro ou Hedging se não houver gol em 15 min*).

...

## Prompt 3
Para o seu projeto `soccer-exchange`, estruturar a lógica de decisão em camadas é o que garantirá que a sua API não dispare falsos positivos e proteja o capital (*bankroll*) do usuário. Baseado nas práticas de modelagem quantitativa, como a distribuição de Poisson com ajuste de Dixon-Coles, métricas avançadas (xG, xGOT, xT) e a dinâmica das exchanges peer-to-peer (P2P), proponho o seguinte framework auditável e automatizável.

Abaixo está a arquitetura da lógica de decisão dividida nas 6 camadas solicitadas:

### ⚙️ 1. Validação de Qualidade dos Dados (Data Ingestion Layer)
Antes de qualquer cálculo ser feito, a API deve garantir que a "matéria-prima" é confiável. Dados corrompidos geram apostas perdedoras.
*   **Tempo de Latência (In-Play):** Se a defasagem dos dados (timestamp do evento na API vs. relógio real) for $> 15$ segundos, os dados estão obsoletos para trading na exchange.
*   **Amostragem (Ruído de Início de Temporada):** O modelo verifica se as equipes jogaram pelo menos 5-6 partidas no campeonato. Se não, deve aplicar o Encolhimento Bayesiano (*Bayesian Shrinkage*), puxando a projeção para a média da liga para evitar distorções.
*   **Confirmação de Escalações (Pré-jogo):** O algoritmo só avança para o cálculo final se o *status* das escalações oficiais constar como "Confirmado" (geralmente 20 a 50 min antes do jogo).

### 🛑 2. Filtros Obrigatórios (Hard Filters / No-Bet Rules)
Estes são os **disjuntores do sistema**. Se qualquer uma destas condições for verdadeira, o sinal morre aqui. Não há exceções.
*   **Regra de Liquidez (No-Bet):** Volume correspondido (Matched Volume) no mercado da Betfair/Exchange $< \$5.000$. Sem liquidez, o trader não consegue fazer o *Cash Out* e fica preso na posição.
*   **Falso Domínio In-Play (No-Bet):** Equipe pressionando com posse de bola $> 60\%$ e finalizações altas, MAS com **xGOT (Expected Goals on Target) $< 0.5$** nos últimos 15 min. Indica "posse estéril" sem perigo real para o goleiro.
*   **Cartão Vermelho Inesperado (No-Bet Temporário):** Se houver uma expulsão, o modelo estatístico pré-jogo é congelado e a entrada é abortada até que o novo estado de jogo (*Game State*) estabilize as métricas *live*.

### 🧠 3. Score de Contexto (Context Score) — Peso: 20%
Esta camada quantifica fatores extracampo e táticos, muitas vezes processados pelo seu *scraper* de notícias ou IA. A nota vai de 0 a 100.
*   **Impacto das Ausências (Lineups):** Subtrai o xG base da equipe se o principal criador de xA (Expected Assists) ou artilheiro estiver lesionado/poupado.
*   **Game State / Desespero:** Se o time superfavorito estiver perdendo ou empatando aos 70 minutos, o *score* contextual de ataque aumenta drasticamente (gatilho para mercados de Cantos/Escanteios ou *Back* Mandante).
*   **Fadiga / PPDA (Passes Per Defensive Action):** Se o PPDA da equipe que defende subir bruscamente no 2º tempo, indica cansaço, aumentando o *score* de contexto ofensivo da equipe adversária.

### 📊 4. Score Estatístico (Statistical Score) — Peso: 40%
O motor matemático puramente frio da sua API. Transforma dados em probabilidades (0 a 100 pontos).
*   **Matriz de Poisson (Dixon-Coles):** Cruza a Força de Ataque vs. Força de Defesa para projetar o xG do jogo, ajustando o fator de empate com o parâmetro `rho`.
*   **Decaimento Temporal (Time Decay):** Aplica a função $\exp(-\xi t)$ para que o xG dos últimos 5 jogos tenha muito mais peso que os jogos de 3 meses atrás.
*   **Métricas de Ameaça (xT e xGOT):** Para in-play, o *Expected Threat* (passes em áreas de perigo) e xGOT (qualidade do chute) determinam a letalidade do time.

### 📈 5. Score de Mercado (Market / Value Score) — Peso: 40%
De nada vale uma probabilidade alta se o preço for ruim. Esta camada busca o Valor Esperado (+EV).
*   **Benchmark Sharp:** Compara a *Fair Odd* (odd justa) do seu modelo Estatístico contra a Linha de Fechamento (*Closing Line Value*) de casas como a **Pinnacle**, removendo a margem de lucro (*vig-free*).
*   **Cálculo da Edge:** Se a Pinnacle precifica um *Back* a 2.00 (50% prob) e seu modelo dá 55% de prob (Odd 1.81), você tem uma *Edge* de +5%.
*   **Conversão para Score:** 
  * Edge $< 2\%$ = 0 pontos (No-Bet)
  * Edge entre $2\%$ e $5\%$ = 50 pontos
  * Edge $> 5\%$ = 100 pontos

### ⚡ 6. Gatilho Final (Final Trigger) e Fórmula Sugerida
A API no Node.js coleta a pontuação ponderada das três camadas pontuáveis. O *Gatilho Final* emite o payload JSON de entrada, o ajuste da *stake* (unidade de aposta), e ordena a LLM a gerar a explicação de leitura de jogo para o usuário.

**Fórmula de Decisão Final:**
$$Score_{Total} = (Score_{Est} \times 0.40) + (Score_{Mkt} \times 0.40) + (Score_{Ctx} \times 0.20)$$

**Regras de Saída (Trigger) com base no $Score_{Total}$:**
1.  **$Score_{Total} \ge 85$ (ALTO VALOR):** 
    *   **Ação:** Disparar Alerta Verde (*Back / Lay*).
    *   **Stake:** Entrada Padrão (Ex: 1 Unidade).
2.  **$70 \le Score_{Total} < 85$ (SINAL MODERADO):**
    *   **Ação:** Disparar Alerta Amarelo.
    *   **Stake:** Entrada Reduzida (Ex: 0.5 Unidade) devido a contexto frágil ou *Edge* de mercado modesta.
3.  **$Score_{Total} < 70$ (NO-BET ABSOLUTO):**
    *   **Ação:** Ignorar silenciosamente o jogo. O mercado está precificado corretamente (eficiente) ou o risco não justifica a entrada.

**Exemplo de Execução do Pipeline In-Play (Lay Casa):**
1) **Validação:** Latência API ok, Escalações ok.
2) **Hard Filter:** Jogo do *Palmeiras x Grêmio* tem \$50k de liquidez na Betfair (Passou). Falso Domínio detectado no Palmeiras (Passou o filtro de perigo).
3) **Context Score:** Grêmio está em bloco baixo e Palmeiras tem PPDA alto (cansaço). Score = 80.
4) **Stat Score:** Poisson projeta 0-0. xGOT do Palmeiras nos últimos 20 min é 0. Score = 90.
5) **Market Score:** Odd do Lay Palmeiras está 1.30 na exchange. Modelo vê odd justa do Lay em 1.50. Edge enorme. Score = 100.
6) **Gatilho:** $Score_{Total} = (90 \times 0.4) + (100 \times 0.4) + (80 \times 0.2) = 92$. **Entrada validada (Forte). LLM constrói a narrativa para o frontend informando a exaustão da equipe e ausência de pontaria.**

## Prompt 4
Para proteger o *bankroll* (capital) em uma operação de trading esportivo profissional, saber a hora de **não apostar** é tão importante quanto o próprio modelo preditivo. A implementação de "Hard Filters" (filtros de exclusão) impede que o sistema seja enganado por ruídos estatísticos e falsos positivos.

Abaixo está o checklist de **Gatilhos Objetivos de Invalidação**, dividido entre o pré-jogo e o momento em que a bola está rolando. Sempre que possível, incluí os limiares matemáticos (*thresholds*) para você programar no seu algoritmo.

---

### 🛑 GATILHOS DE INVALIDAÇÃO PRÉ-JOGO (Pre-Match)

As probabilidades pré-jogo devem ser consideradas provisórias até a janela crítica de **50 a 20 minutos antes do pontapé inicial**, quando as escalações confirmadas (*Starting XI*) são divulgadas.

**1. Lesões de Última Hora & Rotação de Elenco**
*   **Ação:** O modelo compara a escalação confirmada com as escalações anteriores para medir a queda de "poder de fogo".
*   **Limiar Numérico:** Se os jogadores ausentes (lesionados ou poupados) representarem, combinados, **> 25% da média de xG e xA (Expected Assists) da equipe na temporada**, a entrada a favor da equipe deve ser invalidada.
*   **Limiar de Rotação:** Se a equipe fizer **mais de 3 ou 4 alterações** nos titulares habituais (foco em outra competição), aborte. 

**2. Calendário Apertado (Fadiga)**
*   **Limiar Numérico:** Tempo de descanso **inferior a 72 horas** desde a última partida oficial. 
*   **Ação:** Invalida entradas em "Back" (a favor) ou "Handicap Esticado" para essa equipe, pois a fadiga afeta diretamente as métricas de pressão (PPDA) no segundo tempo.

**3. Mudança Tática Abrupta**
*   **Ação:** O *scraper* detecta a formação tática no anúncio do XI inicial.
*   **Limiar:** Alteração drástica na estrutura da defesa ou ataque (exemplo: transição de um 4-3-3 ofensivo histórico para um 5-4-1 com bloco baixo). 
*   **Efeito:** Invalida imediatamente as projeções baseadas na Distribuição de Poisson histórica para mercados de "Over Gols", já que a postura será reativa.

**4. Clima Extremo e Condições do Gramado**
*   **Limiar Numérico:** Chuvas torrenciais confirmadas no dia do jogo, ventos **acima de 35-40 km/h** ou gramados encharcados/congelados.
*   **Ação:** Invalida mercados de *Over 2.5* e desfavorece equipes cujo xG e xT são amplamente baseados em passes curtos e infiltração. Partidas sob clima extremo tendem a ser mais caóticas e aleatórias.

**5. Arbitragem (Fator Disciplinar)**
*   **Limiar Numérico:** Árbitro escalado possui média de **> 5.5 cartões amarelos** ou **> 0.35 cartões vermelhos** por jogo na temporada.
*   **Ação:** Em jogos de alta rivalidade (derbies), invalida mercados de "Over Gols" rápidos, pois o excesso de faltas destrói o tempo de bola rolando (*effective playing time*) e o ritmo do jogo.

**6. Variação Abrupta de Odd sem Justificativa (*Dropping Odds*)**
*   **Limiar Numérico:** A odd de fechamento em corretoras *sharp* (como a Pinnacle) cai **> 10% a 15%** nos últimos 30 minutos antes do jogo, sem que haja uma notícia de lesão pública.
*   **Ação:** Indica "dinheiro inteligente" (sindicatos profissionais) agindo sob informação privilegiada ou manipulação. Se a recomendação do seu modelo for na direção oposta ao *drop*, **aborte**. Não aposte contra o mercado eficiente.

---

### 🔴 GATILHOS DE INVALIDAÇÃO AO VIVO (In-Play)

Durante o jogo, os dados pré-match perdem valor conforme o tempo passa (*time decay*). A decisão passa a depender de métricas de perigo real e qualidade de execução.

**7. Cartão Vermelho Inesperado (*Red Card*)**
*   **Limiar:** Qualquer expulsão, independentemente de quem seja.
*   **Ação:** **Congelar a API.** Todas as métricas pré-jogo (Poisson, xG base) perdem a validade instantaneamente. É proibido fazer qualquer entrada nos primeiros **10 a 15 minutos** pós-expulsão, tempo necessário para o "Game State" se estabilizar (ex: o time com 10 homens pode fechar uma "linha de 5" na defesa).

**8. Pressão sem Finalização Qualificada (Falso Domínio)**
*   **Limiar Numérico:** Equipe com Posse de Bola **> 60%**, com **> 8 chutes** totais no tempo, **MAS** o **xGOT (Expected Goals on Target) é < 0.5**.
*   **Ação:** Invalida a entrada de "Back Favorito". Esse cenário prova que o time tem "posse estéril" e está dando chutes de longe, bloqueados ou sem perigo contra o goleiro.

**9. xG Vivo Divergente (Qualidade Esperada vs. Execução Real)**
*   **Limiar Numérico:** xG acumulado no radar do jogo é alto (ex: **> 1.2 xG**), mas o **xGOT** (que mede a qualidade da execução da finalização na direção do gol) é discrepantemente baixo (ex: **< 0.3 xGOT**).
*   **Ação:** Abortar a entrada em mercados de gols para esse time. Demonstra que, embora estejam criando as jogadas e acessando boas zonas, os atacantes estão em um péssimo dia técnico (isolando a bola ou escorregando).

**10. Domínio Territorial Divergente**
*   **Limiar Numérico:** Time A tem **> 65% de posse** no meio-campo, mas o Time B possui vantagem no **xT (Expected Threat)** ou anota um **PPM (Pressure Per Minute) alto e sustentado** no terço final.
*   **Ação:** Invalida qualquer estratégia de apoio ao Time A. Isso indica que a equipe com a bola é vulnerável a pressões altas e o "azarão" (Time B) está gerando ameaças letais a cada roubada de bola. 

---

### 🧩 Resumo para o seu Motor de Regras:
Ao codificar isso na sua API, coloque as regras como portas lógicas booleanas (`TRUE / FALSE`). Se o sistema detectar **"Drop de Odd Abrupto = TRUE"** ou **"xGOT < 0.5 sob posse alta = TRUE"**, o *Score* da aposta é sumariamente zerado, o robô marca o jogo como **NO-BET** e aguarda o próximo. No trading esportivo profissional, como bem ressaltou o desenvolvedor que testou mais de 500 partidas, a lógica de seleção sobre **o que NÃO apostar** determina se você será lucrativo ou não no longo prazo.

## Prompt 5

Para garantir que o seu modelo matemático não seja enganado por números frios e reflita a realidade em campo, este checklist operacional cruza os dados com o contexto real. No trading profissional, a decisão final sempre depende dessa camada de inteligência e auditoria de risco.

### 📊 Sistema de Pontuação e Gestão de Stake
Antes de detalhar o checklist, defina esta regra de ouro para a execução:
*   **2 Pontos (Sinal Verde):** Cenário ideal. Confirma o modelo matemático. **Stake normal (100%).**
*   **1 Ponto (Sinal Amarelo):** Cenário de alerta ou ruído parcial. **Reduz a stake pela metade (50%).**
*   **0 Pontos (Red Flag):** O cenário quebra a premissa estatística do modelo. **Cancela a entrada (No-Bet)**. Basta **um único 0** em qualquer um dos itens críticos para abortar o trade.

---

### 📋 Checklist Operacional de Contexto (Pré-Jogo e Live)

#### 1. Elenco Disponível (Lineups)
O modelo só deve rodar a sua versão final quando as escalações oficiais (XI inicial) forem confirmadas.
*   **** Time titular base confirmado ou ausências irrelevantes.
*   **** 1 a 2 desfalques no time titular, mas a estrutura da equipe e o artilheiro principal estão mantidos.
*   **** Rotação pesada (> 3 alterações inabituais) ou desfalques que representam, combinados, **> 25% da média de xG e xA (Assistências Esperadas) da equipe**. 
*   *Ação:* Um **** **cancela** qualquer entrada em mercados de Back (A Favor) e de Handicap esticado para esta equipe.

#### 2. Motivação Competitiva
A motivação altera drasticamente a "fome" de uma equipe e invalida médias de longo prazo.
*   **** Ambas as equipes com alto interesse (briga por título, vagas continentais, fugir do rebaixamento).
*   **** Competições de copa jogadas com times mistos ou um time levemente confortável na tabela.
*   **** Equipe com "foco dividido" (tem um jogo decisivo de Champions League em 3 dias) ou partidas de fim de temporada apenas para "cumprir tabela" (dead rubber).
*   *Ação:* Um **** **reduz a stake** pela metade ou **cancela** entradas se a odd pré-jogo da equipe "desmotivada" despencar sem explicação tática.

#### 3. Importância da Partida (Game State Pré-Jogo)
*   **** Partida de liga padrão ou fase eliminatória onde o "Must-Win" é claro.
*   **** Partida de ida em mata-mata (equipes tendem a ser mais cautelosas, afetando o Over).
*   **** Partida de volta onde o favorito já venceu a ida por 3 ou mais gols de diferença. 
*   *Ação:* Um **** **cancela** entradas em Over Gols ou BTTS (Ambas Marcam), pois o favorito tenderá a "matar" o jogo e reduzir o ritmo ao máximo.

#### 4. Viagem e Fadiga (Calendário)
A exaustão física quebra a capacidade de manter alta intensidade (baixo PPDA) no 2º tempo.
*   **** Equipe com descanso ideal (> 4 a 5 dias) e jogando em casa ou após viagem curta.
*   **** Descanso na faixa de 72h a 96h, com viagem de média distância.
*   **** Tempo de descanso **inferior a 72 horas** após uma partida intensa, somado a viagens longas/intercontinentais.
*   *Ação:* Um **** **cancela** entradas em Back Favorito no 2º tempo ou Over Gols no late-game a favor da equipe cansada.

#### 5. Estilo de Jogo e Match-Up (Tática)
*   **** O cenário tático favorece sua posição (Ex: Back Visitante em uma equipe letal em contra-ataques enfrentando um mandante desesperado com linha alta).
*   **** As equipes têm estilos parecidos que podem "anular" o jogo pelo meio-campo.
*   **** Mudança tática abrupta revelada na escalação (Ex: Time ofensivo mudando do 4-3-3 para um 5-4-1 de contenção). 
*   *Ação:* Um **** **cancela** completamente o sinal de mercados de Gols (Over 2.5) originados da estatística histórica do modelo de Poisson.

#### 6. Arbitragem
O juiz dita o tempo de bola rolando (effective playing time) da partida.
*   **** Árbitro permissivo, que deixa o jogo fluir (média de cartões e faltas abaixo da média da liga).
*   **** Árbitro na média normal da competição.
*   **** Árbitro extremamente rigoroso (ex: **> 5.5 cartões amarelos ou > 0.35 vermelhos por jogo**) escalado para um jogo de alta rivalidade (Derby).
*   *Ação:* Um **** **reduz a stake** ou **cancela** apostas em mercados de "Gols no 1º Tempo", pois o excesso de faltas destrói o ritmo de criação e as chances de gol.

#### 7. Clima e Condições do Gramado
*   **** Tempo limpo, gramado rápido e impecável.
*   **** Chuva leve ou gramado com desgaste visual, mas que permite a troca de passes.
*   **** Chuva torrencial, gramado encharcado/congelado, ou ventos acima de **35-40 km/h**.
*   *Ação:* Um **** **cancela** sumariamente mercados de *Over 2.5* e prejudica drasticamente apostas a favor de equipes que dependem muito de passes curtos e infiltração pelo chão.

#### 8. Padrão Recente (Forma e Mercado)
Auditoria do cruzamento entre os dados recentes e a linha de dinheiro "Smart Money".
*   **** A forma recente bate com a odd: Odd estável contra o benchmark (Pinnacle/Betfair).
*   **** Estamos nas primeiras 5 a 6 rodadas da temporada (alta variância/ruído estatístico).
*   **** *Drop* de odd abrupto não justificado: A odd de fechamento da equipe no mercado Sharp cai **> 10% a 15%** minutos antes do jogo começar, e o seu modelo mandava apostar contra essa equipe.
*   *Ação:* Nas rodadas iniciais, **reduza a stake**. Se houver um *Drop* abrupto contra sua posição , **cancele a entrada**, pois o mercado inteligente sabe de algo que seu modelo de Poisson não sabe.

#### 9. Estado Emocional do Jogo (Gatilhos LIVE / In-Play)
Uma vez que o jogo começa, o comportamento real dita a regra sobre a matemática inicial.
*   **** O fluxo acompanha a estatística: A equipe favorita tem alto Expected Threat (xT), recupera a bola rápido e finaliza com perigo (xGOT alto).
*   **** Jogo morno ou muito truncado nos primeiros 15 minutos, forçando a segurar a entrada.
*   **** Cartão vermelho ou "Falso Domínio" detectado (ex: O time da casa tem > 60% de posse, chuta 10 vezes, mas o xGOT é próximo a 0, significando apenas chutes de fora da área sem perigo real).
*   *Ação:* Cartão vermelho **cancela e congela** qualquer aposta por 10 a 15 minutos até a recomposição tática. Falso domínio **cancela** as estratégias de "Back Casa" ou Lay ao empate, invertendo a análise para proteger o seu capital.

## Prompt 6
Para evitar o que chamamos de "alucinação analítica" — um problema real documentado por desenvolvedores que tentaram usar IA para prever jogos e viram o Retorno Sobre o Investimento (ROI) despencar porque a LLM não conseguia justificar sua própria matemática —, a saída da IA deve ser estritamente controlada. A LLM não deve "decidir" a aposta, mas sim formatar e traduzir os dados matemáticos gerados pelo seu motor em Node.js/Python.

Abaixo está o template obrigatório que você deve injetar no *System Prompt* da sua LLM. Ele força a IA a agir apenas como um "Auditor de Risco", limitando o tamanho da resposta e exigindo parâmetros exatos.

---

### 📋 Template Obrigatório de Explicação de Entrada (JSON/Markdown)

Você deve instruir a LLM a retornar a análise **exatamente** neste formato estruturado:

**SINAL DE MERCADO: [STATUS]** *(Pode ser: ENTRADA VALIDADA, ALERTA DE RISCO ou NO-BET)*

*   **Mercado:** [Ex: Match Odds (1X2), Over 2.5 Gols, BTTS]
*   **Direção:** [Ex: Back Mandante, Lay Visitante]
*   **Odd Mínima Justa:** [Odd calculada pelo seu modelo Dixon-Coles/Poisson]
*   **Probabilidade Estimada:** [X%]
*   **Edge (+EV):** [+X% em comparação com a linha de fechamento da Pinnacle/Exchange]
*   **Confiança:** [Score de 0 a 100 baseado na ponderação de Stat + Contexto + Mercado]

🟢 **EVIDÊNCIAS PRINCIPAIS (Máx. 5)**
*(Instrução para a LLM: Liste apenas fatos baseados em métricas ou notícias confirmadas. Sem adjetivos emocionais).*
1.  [Ex: Modelo Poisson projeta xG de 2.14 para o Mandante vs 0.48 para o Visitante]
2.  [Ex: Pressão extrema detectada (PPM 95/100) nos últimos 15 minutos]
3.  [Ex: xGOT do Mandante subiu para 1.5 no segundo tempo, indicando finalizações no alvo]
4.  [Ex: PPDA do Visitante aumentou 40%, indicando clara exaustão defensiva]
5.  [Ex: Desfalque confirmado do zagueiro titular da equipe visitante diminuiu a força defensiva base em 15%]

🔴 **CONTRAEVIDÊNCIAS (Máx. 3)**
*(Instrução para a LLM: Liste os principais riscos matemáticos ou contextuais que ameaçam a tese).*
1.  [Ex: O xGOT do Mandante continua em 0.0, indicando "posse estéril" sem chutes perigosos]
2.  [Ex: O Visitante possui um histórico de contra-ataque letal (alto xT em transição)]
3.  [Ex: Clima extremo (chuva forte) reduz a probabilidade histórica de Over 2.5]

🛑 **CONDIÇÕES DE INVALIDAÇÃO**
*(Gatilhos para realizar Cash Out ou abortar a entrada imediatamente)*
*   [Ex: Se o volume correspondido (liquidez) for inferior a $5.000 na exchange]
*   [Ex: Se houver um cartão vermelho para a equipe apoiada]
*   [Ex: Se a Odd de mercado cair abaixo da "Odd Mínima Justa" antes da entrada]

💰 **GESTÃO DE POSIÇÃO**
*   **Stake Sugerida:** [Ex: 1 Unidade (Padrão), 0.5 Unidade (Risco), ou 0 Unidades se No-Bet]
*   **Motivo do NO-BET (quando aplicável):** [Ex: Edge de mercado negativo (-2%). O mercado precifica o evento melhor que o modelo. Aposta abortada.]

---

### 💡 Exemplo de Saída Preenchida (Cenário In-Play)

**SINAL DE MERCADO: ENTRADA VALIDADA**

*   **Mercado:** Match Odds (1X2)
*   **Direção:** Back Chapecoense
*   **Odd Mínima Justa:** 2.10
*   **Probabilidade Estimada:** 47.6%
*   **Edge (+EV):** +4.5%
*   **Confiança:** 82/100

🟢 **EVIDÊNCIAS PRINCIPAIS**
1. O modelo projeta superioridade ofensiva clara nos minutos finais devido à expulsão no Vitória aos 38'.
2. Chapecoense domina o momentum com 3 blocos consecutivos de PPM > 9.0 (Score 100/100).
3. Aumento drástico do Expected Threat (xT) da Chapecoense no terço final a partir dos 60 minutos.
4. Odd atual no mercado da exchange (2.40) superior à odd mínima justa calculada (2.10).

🔴 **CONTRAEVIDÊNCIAS**
1. Chapecoense apresenta dificuldade na conversão: 10 chutes, mas apenas 1 no alvo.
2. Vitória adotou um bloco baixo (linha de 5), reduzindo o xG por chute concedido.

🛑 **CONDIÇÕES DE INVALIDAÇÃO**
*   Abortar entrada se o Vitória registrar qualquer finalização no alvo (indicando risco de contra-ataque letal).
*   Realizar Cash Out imediato caso a Chapecoense marque o gol (evitar variância dos acréscimos).

💰 **GESTÃO DE POSIÇÃO**
*   **Stake Sugerida:** 0.5 Unidade (Stake reduzida).
*   **Motivo do NO-BET:** Não se aplica. Risco justificado pela alta pressão (PPM) cruzada com a queda física do adversário desfalcado, apesar da baixa precisão de chutes.

---

### Por que esse formato blinda o seu sistema?
Este template força a IA a processar a **assimetria da informação** de forma fria. A obrigatoriedade de listar "Contraevidências" impede o viés de confirmação da máquina, e o campo "Motivo do NO-BET" documenta claramente para o usuário por que ele foi salvo de perder dinheiro (como evitar o *Over 2.5* em uma liga defensiva que costuma sangrar bancas).

## Prompt 7
Para garantir que as correções propostas (como Dixon-Coles, decaimento temporal e filtros de In-Play) representem uma vantagem matemática real e não apenas um ajuste excessivo (*overfitting*) aos dados passados, é fundamental um protocolo de validação rigoroso. Como evidenciado por modeladores quantitativos, sistemas de apostas costumam "morrer" na transição do papel para a prática quando não são calibrados contra as linhas de fechamento (*closing lines*) ou quando os testes permitem o vazamento de dados (*data leakage*).

Abaixo está o framework completo de validação quantitativa para o seu sistema `soccer-exchange` antes do *deploy* em produção.

### ⏱️ 1. Validação Temporal e Walk-Forward (Prevenção de Vazamento)

Em modelos esportivos, a ordem cronológica é sagrada. Usar métodos tradicionais de *Machine Learning* (como validação cruzada K-Fold aleatória) é um erro fatal, pois você estaria prevendo jogos do passado usando dados do futuro (o que seria trapaça).

*   **Split Temporal (Out-of-Sample):** Divida o seu conjunto de dados de forma estritamente cronológica. Por exemplo, treine o modelo base com dados de 2018 a 2022. Use a temporada 2023 para validação (ajuste de hiperparâmetros como o peso do *Time Decay*) e reserve a temporada 2024 como o conjunto de teste "cego".
*   **Walk-Forward Backtesting (Janela Deslizante):** Para simular o ambiente real do *trading*, o modelo deve ser retreinado ou atualizado à medida que avança no tempo. Você treina o modelo com dados até o Dia $T$, prevê as partidas do Dia $T+1$. Em seguida, incorpora os resultados do Dia $T+1$ ao histórico, treina novamente e prevê o Dia $T+2$. Isso valida a capacidade do modelo de se adaptar a novas tendências (como um time que muda de técnico).

### 📊 2. Bateria de Métricas de Avaliação

O sucesso não é medido apenas pelo lucro bruto, pois uma sequência de sorte (*hot streak*) está perfeitamente dentro da variância natural do futebol.

*   **ROI (Return on Investment) e Yield:** O lucro líquido dividido pelo total investido (Staked). Para ser validado, o ROI deve ser calculado usando odds limpas (sem margem/*vig*) da Pinnacle ou da Betfair.
*   **Hit Rate (Taxa de Acerto) vs. Odd Média:** A taxa de vitórias isolada não diz nada. O protocolo deve cruzar o *Hit Rate* com a *Odd Média*. Um *Hit Rate* de 45% com odd média de 2.50 é excepcional; o mesmo *Hit Rate* numa odd de 1.80 é falência.
*   **CLV (Closing Line Value):** Esta é a métrica suprema. Ela mede se as odds que o seu modelo sugeriu bateram a odd de fechamento das casas *sharp* asiáticas. Se o seu modelo indicou a entrada a 2.10 e a odd fechou em 1.90, você tem uma *Edge* validada pelo mercado, independentemente de a aposta ter ganho ou perdido.
*   **Max Drawdown (Rebaixamento Máximo):** A maior queda percentual da sua banca (do pico ao fundo) durante a simulação. Se o seu modelo em tese dá lucro no final do ano, mas no meio do caminho sofre um *Drawdown* de 60%, ele é reprovado por ser inviável para a psicologia e gestão de risco humana.
*   **Calibration (RPS - Ranked Probability Score):** Uma métrica estritamente matemática usada para penalizar previsões probabilísticas distantes da realidade. Se o seu modelo diz que o "Back Casa" tem 80% de chance, a calibração testa se, em 1000 jogos com esse mesmo sinal, o time da casa realmente venceu em 800 deles. O RPS vai de 0 (previsão perfeita) a 1 (pior possível).

### 🛡️ 3. Testes de Robustez (Stress Testing)

Um modelo pode ter um ROI excelente nos dados históricos simplesmente porque encontrou uma anomalia em uma liga específica ou ignorou taxas do mundo real.

*   **Sensibilidade à Liquidez e Derrapagem (*Slippage*):** Desconte de 2% a 5% de cada operação vencedora no *backtest* para simular a comissão da *Exchange* e adicione um atraso de 1 *tick* de derrapagem (você nem sempre consegue a melhor odd do mercado ao vivo).
*   **Teste de Exclusão de Ligas (League Drop Test):** Remova as 2 ou 3 ligas mais lucrativas do seu resultado final. Se o modelo passa de lucrativo para deficitário apenas removendo a Premier League e a Série A, significa que ele não generaliza bem o futebol e está dependente da variância de poucos campeonatos.
*   **Simulação de Monte Carlo:** Embaralhe a ordem cronológica das apostas simuladas 10.000 vezes para gerar caminhos alternativos de banca. Isso responde à pergunta: *"Se eu pegar uma sequência de azares concentrada no início do mês, minha banca quebra antes que o longo prazo (+EV) corrija os resultados?"*

### 🚦 4. Critérios de Aprovação e Reprovação (Go/No-Go)

Estes são os *Hard Filters* do ciclo de vida de desenvolvimento do seu modelo.

**🟢 Critérios de Aprovação (GO para Produção em *Paper Trading*):**
1.  **CLV Positivo Consistente:** O modelo bate a linha de fechamento da Pinnacle (sem *vig*) em pelo menos 60% a 65% dos sinais gerados.
2.  **Lucratividade no Teste Cego:** ROI $> 3\%$ no conjunto de dados do ano mais recente, mantendo-se positivo mesmo após a dedução da comissão da Betfair.
3.  **Drawdown Controlado:** O *Max Drawdown* nunca ultrapassou 20% do capital inicial estipulado nos testes.
4.  **Estabilidade do RPS:** A inclusão das novas regras (como Dixon-Coles) gerou um RPS inferior (mais próximo de 0) ao do modelo Poisson clássico, atestando melhor capacidade preditiva.

**🔴 Critérios de Reprovação (NO-GO - Voltar para o laboratório):**
1.  **Divergência Lucro/CLV:** O modelo é extremamente lucrativo, mas tem CLV negativo ou nulo na maioria dos jogos. (Veredito: o lucro foi pura sorte e os lucros logo "cairão de um penhasco" na vida real).
2.  **Sensibilidade Extrema In-Play:** Se a aprovação do ROI depende de pegar odds que duram menos de 10 segundos no mercado ao vivo, o modelo é rejeitado por falha operacional de latência.
3.  **Overfitting de Ligas Pequenas:** O modelo gera falsos positivos ao precificar altíssima confiança nas rodadas iniciais de campeonatos irrelevantes (onde a amostra de dados é pequena). Requer reinjeção de Encolhimento Bayesiano (*Bayesian Shrinkage*).

Se o seu motor matemático passar em todos os critérios verdes e sobreviver aos testes de robustez de derrapagem e exclusão de ligas, ele está estatisticamente maduro para ser acoplado à sua camada LLM e assumir execuções na exchange em tempo real.

## Prompt 8
**1) Em quais cenários TensorFlow agrega valor real**
O uso de *Deep Learning* (redes neurais via TensorFlow ou PyTorch) em análises de futebol brilha exclusivamente ao lidar com **dados não-estruturados, não-lineares e de altíssima dimensionalidade**. 
*   **Dados de Rastreamento (Tracking/Spatiotemporal):** O processamento de coordenadas (X,Y) de todos os 22 jogadores e da bola a cada milissegundo (obtidos via rastreamento óptico ou GPS) exige modelos complexos para detectar padrões de formação ou redes de passes.
*   **Geração Bruta de xG/xT:** Para treinar os algoritmos base que calculam o *Expected Goals* (xG) ou *Expected Threat* (xT) a partir de milhares de variáveis de um campo (ângulo, velocidade, posição dos defensores), as redes neurais podem oferecer alta precisão.

**2) Em quais cenários modelos mais simples performam igual ou melhor**
Para o **cálculo de probabilidades de apostas a partir de dados tabulares** (estatísticas, xG acumulado, PPDA, posse), modelos complexos de *Deep Learning* costumam ser superados por abordagens tradicionais, que são mais eficientes e exigem menos dados:
*   **Regressão de Poisson (com ajuste de Dixon-Coles):** É o "padrão ouro" matemático para prever resultados (1X2) e o mercado de gols (Over/Under). O futebol é um esporte de baixa pontuação, e a distribuição de Poisson, ajustada por Dixon-Coles para corrigir a subestimação de empates (0-0, 1-1), é altamente superior a redes neurais na precificação justa de odds.
*   **Logistic Regression & Gradient Boosting (XGBoost/LightGBM):** Para classificar se um chute será gol (cálculo de xG padrão) ou para dados estruturados, a regressão logística e modelos baseados em árvores (como XGBoost) performam exepcionalmente bem, são mais rápidos de treinar e lidam melhor com dados tabulares do que o TensorFlow.
*   **Modelos Bayesianos (Bayesian Shrinkage):** Lidam perfeitamente com o ruído estatístico de início de temporada, puxando as previsões de times com pouca amostragem de volta para a média da liga. Redes neurais costumam falhar drasticamente e se perder em amostras pequenas.

**3) Sinais de Overfitting e Data Leakage**
*   **Overfitting:** O sintoma clássico ocorre quando o modelo apresenta resultados estratosféricos em backtests e nas primeiras semanas de operação ao vivo, mas a precisão "cai de um penhasco" e o ROI (Retorno sobre Investimento) fica negativo rapidamente depois. Redes neurais memorizam ruídos (ex: o time A ganhou os últimos 3 jogos por sorte) em vez de capturar o verdadeiro valor do time.
*   **Data Leakage (Vazamento de Dados):** Ocorre com frequência ao se inserir métricas de *momentum* (como pressão e posse) sem ajustá-las ao **Game State (Efeito Placar)**. O modelo TF pode associar cegamente posse de bola à vitória, "vazando" a conclusão de que um time sufocando o adversário no final do jogo é superior, quando na verdade o adversário apenas recuou propositalmente porque já estava vencendo por 2-0.

**4) Riscos de baixa interpretabilidade para operação de trade**
No trading esportivo em uma *exchange*, a **interpretabilidade é uma questão de sobrevivência financeira**. 
Redes neurais operam como "caixas-pretas" (*black-box*): elas emitem a probabilidade, mas não conseguem explicar a matemática por trás da decisão. Se o seu painel sugerir um *Lay* no time da casa com odd de 1.50, o trader precisa saber o **porquê**. O modelo tomou essa decisão porque o xGOT do visitante está alto, ou porque uma anomalia na rede neural deu peso excessivo a um confronto direto (H2H) de cinco anos atrás? Sem compreender o peso das variáveis, é impossível para o trader saber a hora certa de realizar o *Cash Out* (Hedging) ou cancelar a entrada caso o contexto mude (ex: um cartão vermelho).

**5) Recomendação prática: Substituir parcialmente**
**Substitua o TensorFlow** no motor central de geração de *odds* e probabilidades do seu `soccer-exchange`. Mantenha-o apenas se estiver construindo *features* a partir de dados de tracking visual.
Para a precificação de apostas, **simplifique a arquitetura**:
*   *Pré-jogo:* Utilize um **Modelo de Poisson com correção de Dixon-Coles** e fator de decaimento de tempo (*Time Decay*) para calcular a *Fair Odd*.
*   *Ao Vivo (In-Play):* Utilize **XGBoost** ou regras heurísticas sólidas em cima de dados em tempo real (xT, PPDA, xGOT) integrados por meio de WebSockets, enviando as evidências matemáticas claras para a LLM redigir a justificativa do alerta.

**6) Plano de comparação A/B com critérios objetivos de decisão**
Para decidir cientificamente qual modelo vai para produção, aplique um *Walk-Forward Backtesting* (treinar até o dia $T$, prever o dia $T+1$) em uma temporada fora da amostra (ex: 2024), confrontando o Modelo A (TensorFlow) com o Modelo B (Poisson/XGBoost). 
Utilize as seguintes métricas absolutas para aprovação (*Go/No-Go*):
1.  **Ranked Probability Score (RPS):** Mede a precisão matemática da probabilidade de forma estrita, penalizando o modelo cujas estimativas estejam mais distantes da realidade (varia de 0 a 1, sendo 0 a previsão perfeita). O modelo vencedor deve ter o menor RPS sustentado.
2.  **Closing Line Value (CLV):** Verifique com que frequência as *odds* geradas por cada modelo batem a probabilidade implícita de fechamento de casas asiáticas *sharp* (como a Pinnacle) com a margem (vig) removida. A superação do CLV garante que a vantagem (*edge*) não é fruto do acaso.
3.  **Maximum Drawdown:** A queda máxima de banca. Se o Modelo A for mais lucrativo, mas sofrer rebaixamentos financeiros agressivos (alta variância) que o Modelo B evita, o Modelo B deve ser escolhido para proteger o usuário de riscos psicológicos em longo prazo.

## Prompt 9
O texto que você destacou captura com precisão cirúrgica a essência do **Trading In-Play (Ao Vivo) "Reativo"**. Como traders profissionais costumam ressaltar, não importa o quão sofisticado seja o seu modelo matemático pré-jogo (como a Regressão de Poisson); uma vez que a bola rola, o *Game State* (estado do jogo) e as dinâmicas em tempo real devem ditar as suas decisões na *exchange*. 

Com base nas fontes e na nossa arquitetura do `soccer-exchange`, aqui está o aprofundamento técnico de como esses três cenários ditam o sucesso de um modelo de trading ao vivo:

### 1. O Fluxo Acompanha a Estatística (Validação via xT e xGOT)
Quando a equipe favorita impõe seu ritmo, o uso de métricas avançadas de nova geração é o que separa um trader amador de um profissional. 
*   **O papel do xT (Expected Threat):** O xT avalia a probabilidade de uma equipe marcar um gol com base na progressão da bola (passes e conduções) para zonas de perigo. Um xT alto significa que o time está sufocando o adversário no terço final do campo.
*   **O papel do xGOT (Expected Goals on Target):** Enquanto o xG mede a qualidade da *oportunidade* antes do chute, o xGOT foca na **execução**, medindo a probabilidade de a bola efetivamente entrar após o chute, considerando o posicionamento do goleiro e o local onde a bola foi direcionada. 
*   **Ação:** Se o xT e o xGOT estão altos, a pressão é real e o gol é iminente. É o momento perfeito para executar estratégias In-Play como o *Back Favorito* ou *Over 2.5 Goals*.

### 2. Jogo Morno ou Truncado (A Importância da Paciência)
Nos primeiros 15 minutos, as equipes costumam se estudar. Se o jogo está truncado, sem quebras de linha e com muitas faltas, a volatilidade do mercado cai e não há vantagem matemática aparente.
*   **Ação:** Segurar a entrada. Profissionais de *exchanges* defendem que a **decisividade e a disciplina** são cruciais no in-play. Você deve agir como um franco-atirador: aguardar pacientemente pelo gatilho correto e não forçar uma entrada em um jogo sem intensidade, evitando a ganância ou o *overtrading*.

### 3. Gestão de Crise: Cartão Vermelho e Falso Domínio
Estes são os maiores armadilhas que destroem bancas de apostadores desavisados, exigindo disjuntores (*Hard Filters*) no seu sistema:
*   **O Choque do Cartão Vermelho:** Uma expulsão causa uma reação exagerada no mercado e uma desordem tática momentânea. **Congelar as entradas por 10 a 15 minutos** é fundamental, pois permite que você observe como a equipe com 10 homens vai se recompor taticamente (ex: adotando um bloco baixo) e como as *odds* vão se estabilizar após o pânico inicial do mercado.
*   **O "Falso Domínio" (Posse Estéril):** O mercado costuma supervalorizar times com alta posse de bola (ex: > 60%) e muitos chutes. No entanto, se a equipe tem 10 chutes, mas o xGOT está próximo de zero, significa que as finalizações estão sendo bloqueadas ou foram chutes inofensivos de muito longe. 
*   **Ação de Proteção:** Abortar estratégias como o *Lay The Draw* (Apostar contra o empate) ou o *Back Casa*. O seu capital é preservado ao constatar que a equipe, apesar de ter a bola, não está exigindo defesas difíceis do goleiro adversário. 

Resumindo, a integração dessa lógica ao seu *dashboard* In-Play garante que você reaja à verdadeira probabilidade do evento (baseada em qualidade de execução) e não à falsa narrativa do volume cego, garantindo a proteção do seu capital (bankroll) a longo prazo.

## Prompt 10
**Bloco A: Correções Imediatas (Alto Impacto, Baixa Complexidade)**
Este bloco foca em "estancar sangramentos" e corrigir erros metodológicos que distorcem o valor real das operações financeiras e causam latência crítica.

*   **1. Desacoplamento da LLM na Tomada de Decisão**
    *   **Ação:** O motor matemático (Node.js/Python) deve ser o único decisor da entrada. A LLM atua apenas de forma assíncrona para redigir a justificativa. Experiências mostram que delegar a decisão à IA gera viés narrativo e destrói o ROI.
    *   **Prioridade:** Máxima.
    *   **Esforço Estimado:** Baixo (apenas remapeamento da chamada de API).
    *   **Risco:** Baixo.
    *   **KPI de Sucesso:** Tempo de processamento do sinal reduzido a milissegundos e eliminação de sugestões baseadas apenas em "narrativas" extracampo.
*   **2. Benchmark Rigoroso de CLV (Closing Line Value)**
    *   **Ação:** Alterar o comparativo de odds da sua API. Em vez de usar casas *soft* (como Bet365), o sistema deve validar a *Edge* (+EV) cruzando a probabilidade do seu modelo exclusivamente com as odds *vig-free* (sem margem) da Pinnacle ou de exchanges como a Betfair.
    *   **Prioridade:** Máxima.
    *   **Esforço Estimado:** Baixo.
    *   **Risco:** Baixo.
    *   **KPI de Sucesso:** Taxa superior a 60% de sinais gerados que conseguem bater a linha de fechamento do mercado (CLV positivo).
*   **3. Implementação do Filtro de "Falso Domínio" (xGOT e PPDA)**
    *   **Ação:** Criar um *Hard Filter* (*circuit breaker*) no código para abortar sinais de *Back Favorito* In-Play se o time tiver posse de bola elevada (> 60%), mas o *Expected Goals on Target* (xGOT) for inferior a 0.5 (indicando chutes bloqueados/sem perigo).
    *   **Prioridade:** Alta.
    *   **Esforço Estimado:** Baixo/Médio.
    *   **Risco:** Baixo.
    *   **KPI de Sucesso:** Redução da taxa de perdas (*reds*) em mercados In-Play de times que sofrem contra-ataques devido à "posse estéril".

**Bloco B: Melhorias Estruturais (Médio Prazo)**
Este bloco visa fortalecer o motor quantitativo e a infraestrutura de ingestão de dados para garantir que a plataforma sobreviva à eficiência do mercado a longo prazo.

*   **1. Ajuste de Dixon-Coles e Decaimento Temporal (*Time Decay*)**
    *   **Ação:** Atualizar o modelo de Poisson padrão. Implementar o parâmetro $\rho$ (rho) de Dixon-Coles para corrigir a subestimação crônica de empates de baixa pontuação (0-0, 1-1). Adicionar uma função de decaimento exponencial ($\exp(-\xi t)$) para que jogos recentes tenham maior peso na força da equipe.
    *   **Prioridade:** Alta.
    *   **Esforço Estimado:** Médio/Alto (requer validação matemática).
    *   **Risco:** Médio (risco de superajustar o parâmetro $\xi$).
    *   **KPI de Sucesso:** Melhoria (redução) do *Ranked Probability Score* (RPS) do modelo matemático na previsão de placares finais.
*   **2. Migração para WebSockets para Ingestão de Dados In-Play**
    *   **Ação:** Substituir chamadas REST (*polling*) por conexões WebSockets com o provedor de dados (ex: Sportmonks ou Sportradar). Em *exchanges*, a latência destrói a execução; a linha de odds se move antes de o sinal ser exibido.
    *   **Prioridade:** Alta.
    *   **Esforço Estimado:** Médio.
    *   **Risco:** Baixo (arquiteturalmente mais limpo para dados *live*).
    *   **KPI de Sucesso:** Latência de entrega do evento (gol, cartão, ataque perigoso) para o *dashboard* do usuário reduzida a menos de 2 segundos.
*   **3. Ajuste de Força Baseado nas Escalações Confirmadas (*Lineups*)**
    *   **Ação:** O modelo deve rodar sua versão oficial de precificação apenas entre 50 e 20 minutos antes do jogo, comparando o XI inicial com o time-base e subtraindo a métrica ofensiva/defensiva caso jogadores-chave estejam ausentes.
    *   **Prioridade:** Média/Alta.
    *   **Esforço Estimado:** Médio.
    *   **Risco:** Médio (exige dados precisos de escalação prévia).
    *   **KPI de Sucesso:** Aumento da lucratividade (ROI) das apostas feitas pouco antes do pontapé inicial.

**Bloco C: Pesquisa e Experimentação (Longo Prazo)**
Este bloco foca no estado da arte da ciência de dados no esporte, permitindo que a sua API crie *edges* que o mercado público ainda não precificou perfeitamente.

*   **1. Encolhimento Bayesiano (*Bayesian Shrinkage*) para Início de Temporada**
    *   **Ação:** Para combater o ruído estatístico de times recém-promovidos ou com elencos novos, os dados das 5 a 6 primeiras rodadas devem ser puxados em direção à média geral da liga.
    *   **Prioridade:** Média.
    *   **Esforço Estimado:** Alto.
    *   **Risco:** Baixo.
    *   **KPI de Sucesso:** Estabilização da variância da banca (Drawdown Controlado) durante os dois primeiros meses das ligas.
*   **2. Modelagem Avançada In-Play via *Expected Threat* (xT) e *Tracking Data***
    *   **Ação:** Integrar pacotes de análise de dados espaço-temporais (como o pacote Python *Floodlight*) ou feeds sofisticados para medir a progressão da bola por zonas, avaliando o perigo *antes* de a finalização ocorrer (xT). Utilizar *Machine Learning* (TensorFlow/XGBoost) aqui, e não na decisão da odd.
    *   **Prioridade:** Baixa.
    *   **Esforço Estimado:** Muito Alto (engenharia de dados complexa).
    *   **Risco:** Alto (alto custo computacional).
    *   **KPI de Sucesso:** Disparo de entradas no padrão "Ameaça Letal de Contra-Ataque" minutos antes de o mercado tradicional reagir à posse de bola.
*   **3. Validação Robusta com Walk-Forward e Teste de Exclusão de Ligas**
    *   **Ação:** Abandonar backtests simples e implementar o método *Walk-Forward* (treinar até o dia T, prever T+1 e re-treinar) para simular condições reais. Além disso, conduzir um teste de exclusão (remover as 3 ligas mais lucrativas do *backtest* para ver se o modelo sobrevive).
    *   **Prioridade:** Média (para ciclos de auditoria).
    *   **Esforço Estimado:** Alto.
    *   **Risco:** Baixo.
    *   **KPI de Sucesso:** Sobrevivência do modelo a testes de estresse, atestando que a lucratividade vem da metodologia geral (ex: +8% ROI verificado) e não de anomalias isoladas em um campeonato menor.


