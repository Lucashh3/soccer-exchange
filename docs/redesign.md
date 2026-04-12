# Proposta de Redesign — Soccer Exchange Frontend

> Documento de análise e diretrizes para refatoração visual do app.

---

## 1. Diagnóstico dos Problemas Atuais

### 1.1 Layout com três colunas colapsando

O dashboard tem três colunas: sidebar de navegação (220px) + sidebar de ligas (224px) + conteúdo principal. Em telas médias (<1280px) isso comprime demais o conteúdo, e a sidebar de ligas some em mobile sem uma alternativa adequada.

**Problema:** filtro de liga acessível só em desktop.

### 1.2 Controles de filtro fragmentados

Os filtros do dashboard estão divididos em três lugares distintos:
- Sidebar esquerda (filtro de liga)
- Barra de controles (status + mercado + ordenação)
- Cada um com interação diferente (click vs select)

Isso cria confusão sobre "o que está filtrado agora" — não há estado visual consolidado dos filtros ativos.

### 1.3 SignalCard pouco legível

O card atual empilha informações sem hierarquia clara:
- Nome do jogo + league/country na mesma linha pequena
- Probabilidade (número grande) competindo com o MarketBadge
- Barra de confiança discreta demais — não chama atenção
- O xG aparece só em alguns cards (condicional) quebrando consistência visual

### 1.4 Página de detalhe do jogo sobrecarregada

A `/game/[id]` tem um painel esquerdo com até 7 abas e um painel direito com mais 3 abas internas. Isso é navegação demais para uma única tela, e os painéis não têm proporção clara.

### 1.5 Ausência de hierarquia tipográfica

Tamanhos de fonte muito próximos (`text-xs`, `text-sm`, `text-[11px]`, `text-[10px]`). Títulos de seção não se diferenciam visualmente do conteúdo.

### 1.6 Sidebar de navegação subutilizada

A sidebar principal tem só 2 itens (Dashboard e Screener) mas ocupa 220px permanentemente. Em mobile não tem menu equivalente.

---

## 2. Objetivos do Redesign

1. **Clareza** — o usuário entende em segundos quais são os melhores sinais do dia
2. **Foco** — reduzir ruído visual, destacar o que importa (probabilidade, mercado, confiança)
3. **Responsividade real** — o app deve funcionar bem em 1024px, não só em 1440px+
4. **Consistência** — todos os cards com a mesma estrutura, independente de ter sinal ou não
5. **Navegação simples** — reduzir profundidade de abas na página de detalhe

---

## 3. Mudanças por Área

### 3.1 Shell / Navegação Global

**Atual:** Sidebar vertical fixa (220px) com 2 links.

**Proposto:** Topbar fina (48px) com logo + navegação central + status da pipeline à direita.

```
┌─────────────────────────────────────────────────────────────┐
│  ⚽ Soccer Exchange    Dashboard    Screener        ● 53j 181s│
└─────────────────────────────────────────────────────────────┘
```

- Remove a sidebar permanente liberando ~220px de espaço horizontal
- Em mobile: topbar com hamburger menu lateral (sheet)
- O indicador de pipeline fica discreto mas acessível no canto direito

---

### 3.2 Dashboard — Filtros

**Atual:** Liga sidebar (esquerda) + barra de filtros sobrepostos.

**Proposto:** Barra de filtros única e compacta no topo da listagem.

```
┌──────────────────────────────────────────────────────────────┐
│ [Todos] [Ao Vivo ●3] [A Iniciar] [Finalizados]   Ordenar ▾  │
│ Mercado: [Todos] [BTTS] [Over 2.5] [Back Casa] ...           │
│ Liga: [Todas ▾]                          53 jogos · 181 sinais│
└──────────────────────────────────────────────────────────────┘
```

- Status em pills na primeira linha (com contagem e dot de live)
- Mercados em pills na segunda linha (scroll horizontal em mobile)
- Liga como dropdown compacto — não precisa de sidebar dedicada
- Estado ativo claramente visível (pill preenchida vs outlined)
- Chip "Limpar filtros" aparece quando qualquer filtro está ativo

---

### 3.3 SignalCard — Reformulação

**Atual:** Card com layout inconsistente, probabilidade destacada mas sem contexto visual do mercado.

**Proposto:** Card em duas zonas horizontais.

```
┌─────────────────────────────────────────────────────────────┐
│ La Liga · Spain                               16:00          │
│ Real Sociedad  vs  Levante UD                               │
├─────────────────────────────────────────────────────────────┤
│  OVER 2.5         57%  ████████░░  Conf 70%   1.4 / 1.1 xG │
└─────────────────────────────────────────────────────────────┘
```

- **Zona superior:** contexto (liga, times, horário) — tipografia leve
- **Zona inferior (acento colorido):** mercado + probabilidade + confiança + xG numa única linha
- Cor de fundo da zona inferior = cor do mercado com opacidade baixa (~8%)
- Se não tem sinal: zona inferior fica cinza com "Sem sinal"
- Cards **sem sinal** têm opacidade reduzida (60%) e não têm a zona colorida
- Tamanho fixo (sem variação de altura entre cards com/sem sinal)

---

### 3.4 Página de Detalhe do Jogo — Simplificação

**Atual:** Split panel com muitas abas em ambos os lados.

**Proposto:** Layout single-column com seções expansíveis.

#### Header do jogo (sempre visível, sticky)
```
┌─────────────────────────────────────────────────────────────┐
│ ← Voltar    Real Sociedad  1 - 2  Barcelona    La Liga      │
│             [LIVE 67']  Over 2.5 · 57% · Conf 70%          │
└─────────────────────────────────────────────────────────────┘
```

#### Seções abaixo (scroll vertical, com toggle para expandir):

| Seção | Estado padrão | Conteúdo |
|-------|--------------|----------|
| **Sinais** | Expandida | Todos os sinais com probabilidade, mercado, EV |
| **Análise IA** | Expandida | Report gerado pela LLM |
| **Stats Comparativo** | Expandida | StatRow grid (xG, gols, BTTS%, form) |
| **Poisson / Probabilidades** | Colapsada | Heatmap + win probabilities |
| **Odds** | Colapsada | Tabela de mercados de odds |
| **H2H** | Colapsada | Últimos confrontos |
| **Elenco** | Colapsada | Jogadores home/away |
| **Ao Vivo** | Visível se live | Stats ao vivo + placar |
| **Narração** | Colapsada | Commentary |
| **Destaques** | Colapsada | Highlights/vídeos |

**Vantagem:** Elimina a confusão de "qual painel estou navegando?" e funciona perfeitamente em mobile.

---

### 3.5 Screener — Pequenos Ajustes

O screener está mais estável, mas precisa de:

- **Filtros colapsáveis** em mobile (painel lateral vira drawer)
- **Coluna de confiança** com barras visuais em vez de número puro
- **Highlight de linha** quando o jogo tem sinal de alta confiança (≥80%)
- **Badge de mercado colorido** na coluna Sinal (já existe no MarketBadge, checar se está sendo usado)

---

## 4. Sistema de Tipografia Revisado

| Uso | Classe atual | Classe proposta |
|-----|-------------|-----------------|
| Título de página | `text-lg font-semibold` | `text-xl font-semibold tracking-tight` |
| Título de seção | `text-sm font-semibold text-muted-foreground uppercase` | `text-xs font-bold text-muted-foreground uppercase tracking-widest` |
| Nome de time | `text-sm font-medium` | `text-base font-semibold` |
| Liga/país | `text-[11px] text-muted-foreground` | `text-xs text-muted-foreground` |
| Probabilidade | `text-2xl font-bold font-mono` | `text-xl font-bold font-mono tabular-nums` |
| Números de stats | `text-xs font-mono` | `text-sm font-mono tabular-nums` |
| Rótulo de stat | `text-[10px] text-muted-foreground` | `text-xs text-muted-foreground` |

**Regra:** mínimo `text-xs` (12px) para qualquer texto legível. Eliminar `text-[10px]` e `text-[11px]`.

---

## 5. Cores — Refinamentos

O sistema de cores atual é bom (dark navy + cyan + mercado colorido). Ajustes menores:

### Problema: border muito sutil
`border: rgba(255,255,255,0.08)` é quase invisível. Proposta: `rgba(255,255,255,0.12)` para bordas de cards.

### Problema: contraste do card background vs page background
`card: #0f1520` vs `background: #090b12` — diferença de apenas ~10 de luminosidade. Proposta: `card: #111827` para maior separação.

### Adicionar: estado "sem dados"
Quando uma seção não tem dados, usar um empty state visual padronizado:
```
[ícone neutro]
Sem dados disponíveis
```
Em vez de simplesmente não renderizar nada (que confunde o usuário).

---

## 6. Priorização de Implementação

### Fase 1 — Quick wins (menor esforço, maior impacto)
- [ ] Migrar navegação para topbar (remove sidebar 220px)
- [ ] Unificar filtros do dashboard em barra única com dropdown de liga
- [ ] Fixar tamanho mínimo dos SignalCards (altura consistente)
- [ ] Aumentar contraste de bordas e backgrounds de cards
- [ ] Substituir `text-[10px]`/`text-[11px]` por `text-xs`

### Fase 2 — Estrutura da página de detalhe
- [ ] Converter split-panel em single-column com seções expansíveis
- [ ] Header sticky com placar + sinal principal
- [ ] Seções "Sinais" e "Análise IA" sempre expandidas por padrão

### Fase 3 — Polimento
- [ ] Mobile drawer para filtros do screener
- [ ] Empty states padronizados
- [ ] Animações de transição de filtro (fade in/out dos cards ao filtrar)
- [ ] Skeleton loaders com shape correto para o novo layout dos cards
