# Coach Live IA - Especificacao e Plano de Implementacao

Coach Live e um assistente de IA para trading in-play. Ele orienta entradas durante o jogo em tom de guia operacional, combinando contexto ao vivo, sinal de momentum e noticias pre-jogo.

## Objetivo

- Entregar recomendacoes de entrada durante o jogo com atualizacao a cada 5 minutos.
- Melhorar decisao do usuario com contexto tecnico + narracao orientada.
- Funcionar somente quando o usuario ativar explicitamente o Coach.

## Escopo do MVP

- Recomendacao de entrada in-play (nao inclui automacao de ordem).
- Dados usados no ciclo:
  - live (`/games/:id/live`)
  - live stats (`/games/:id/live-stats`)
  - momentum/PPM (`/games/:id/graph` + calculo de `EntrySignal`)
  - sinais pre-jogo da partida (`getSignalsByGameId` ou top signal)
  - noticias pre-jogo (`getNewsByGameId`)
- Toggle por usuario no frontend (estado local para MVP).
- Polling do Coach em 5 minutos.

## Regras de produto

- O Coach so responde quando ativado pelo usuario.
- Sem jogo ao vivo, o Coach retorna estado inativo.
- Em ausencia de sinal claro, recomendar aguardar (evitar overtrading).
- Noticias pre-jogo devem influenciar confianca e racional da recomendacao.
- Linguagem em tom de mentor de execucao, sem prometer lucro.

## Arquitetura proposta

```text
Frontend (Game page)
  -> GET /api/game/:id/coach?enabled=true
     -> Next proxy route
        -> Express GET /games/:id/coach?enabled=true
           -> agrega live + stats + graph + sinais + noticias
           -> monta prompt estruturado
           -> generateReport() (OpenAI -> fallback DeepSeek)
           -> parse + normaliza resposta
           -> cache 5 min por gameId
```

## Contrato de resposta do Coach

```ts
export interface CoachResponse {
  status: 'disabled' | 'inactive' | 'ready'
  text: string
  action: 'entrar_back' | 'entrar_lay' | 'aguardar' | 'sair'
  market: string | null
  side: 'home' | 'away' | 'neutral'
  confidence: number
  reasonCodes: string[]
  cachedAt: number
  fromCache: boolean
  contextUsed: {
    live: boolean
    ppm: boolean
    news: boolean
  }
}
```

## Contexto de noticias pre-jogo

Noticias entram no prompt como bloco dedicado `Noticias pre-jogo` com ate 5 itens mais relevantes.

Exemplos de impacto esperado:

- Desfalque de atacante principal -> reduz agressividade em entradas de gols para aquele time.
- Troca de treinador recente -> aumenta incerteza, recomenda stake menor ou espera confirmacao.
- Declaracoes de poupanca/rotacao -> aumenta cautela em mercados de favorito.

Regra de seguranca: se noticia forte contradiz leitura de curto prazo, o Coach deve reduzir confianca e sugerir cautela.

## Prompt base do Coach (resumo)

- Papel: trader profissional de futebol orientando execucao in-play.
- Estilo: direto, curto, acionavel.
- Saida obrigatoria em JSON com `action`, `market`, `side`, `confidence`, `text`, `reasonCodes`.
- Instrucoes:
  - usar contexto ao vivo + PPM + noticias pre-jogo
  - se sinais ambiguos, retornar `aguardar`
  - nunca usar tom de certeza absoluta

## Cache e atualizacao

- TTL: 5 minutos por `gameId`.
- Invalidacao antecipada quando:
  - gol no placar
  - variacao forte de momentum
  - mudanca de tempo de jogo relevante (ex.: inicio 2T)
  - mudanca relevante no conjunto de noticias consideradas

## Plano de implementacao

### Fase 1 - Backend Coach

1. Criar `src/services/coach.ts`
   - `buildCoachPrompt(input)`
   - `summarizeNews(news)`
   - `getCoachSuggestion(input)` com cache e fallback seguro
2. Adicionar tipos de request/response em `src/types/index.ts`
3. Adicionar endpoint `GET /games/:id/coach` em `src/api/routes/games.ts`
   - query param `enabled=true|false`
   - agrega dados em paralelo
   - retorna `disabled/inactive/ready`

### Fase 2 - Frontend e ativacao

4. Criar proxy `frontend-next/app/api/game/[id]/coach/route.ts`
5. Adicionar `fetchCoach` em `frontend-next/lib/api.ts`
6. Criar `frontend-next/hooks/useCoachToggle.ts`
   - persistencia local (`localStorage`)
   - chave por jogo no MVP (`coach_enabled_<gameId>`)
7. Criar `frontend-next/components/game/CoachCard.tsx`
   - toggle "Ativar Coach"
   - exibicao da recomendacao
8. Integrar `CoachCard` em `frontend-next/app/game/[id]/page.tsx` dentro de `LiveSection`

### Fase 3 - Qualidade e observabilidade

9. Log estruturado das recomendacoes (sem dados sensiveis)
10. Telemetria minima:
    - taxa de ativacao
    - taxa de recomendacoes `aguardar`
    - latencia media por ciclo
    - endpoint de metricas: `GET /games/coach/metrics`
11. Testes basicos:
    - endpoint retorna `disabled` sem toggle
    - endpoint retorna `inactive` sem jogo ao vivo
    - endpoint retorna `ready` com payload valido

## Criterios de aceite

- O Coach nao chama LLM quando desativado.
- O Coach nao chama LLM para jogo nao ao vivo.
- Recomendacoes atualizam a cada 5 minutos.
- Noticias pre-jogo aparecem no contexto do prompt e afetam confianca.
- Falha de LLM nao quebra fluxo; retorna fallback seguro (`aguardar`).

## Riscos e mitigacoes

- Ruido de noticias: aplicar resumo e priorizacao por relevancia.
- Custo de LLM: cache + ativacao explicita + sem chamadas fora de live.
- Recomendacao inconsistente: schema fixo + normalizacao + guardrails de cautela.

## Fora do escopo do MVP

- Gestao automatica de posicao (stop/take dinâmico automatico).
- Perfil de risco persistido em backend com conta autenticada.
- Treinamento supervisionado para ranking de recomendacoes.
