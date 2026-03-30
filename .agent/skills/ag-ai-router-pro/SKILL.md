---
name: ag_AI_Router_Pro
description: Roteador inteligente de IA. Analisa qualquer solicitação, pontua por categoria e roteia para a skill especializada correta ANTES de executar. Ativar SEMPRE antes de qualquer resposta técnica ou criativa.
trigger: always_on
priority: maximum
type: global_pre_processor
---

# ag_AI_Router_Pro — Roteador Inteligente de IA

> **PRIORIDADE MÁXIMA.** Esta skill deve ser executada ANTES de qualquer outra.
> É um pre-processador que garante que a resposta certa vem da skill certa.

---

## QUANDO ATIVAR

**Sempre** — em toda solicitação antes de qualquer execução.

---

## ETAPA 1 — ANÁLISE SEMÂNTICA

Antes de responder, identifique silenciosamente:

1. **Intenção principal:**
   - Informativa, Persuasiva, Técnica, Criativa, Estratégica, Programação, Dados de Produto, Social Media

2. **Palavras-chave dominantes** na solicitação.

3. **Contexto:** Projeto, urgência, tom esperado.

---

## ETAPA 2 — SISTEMA DE PONTUAÇÃO

Avalie de **0 a 10** cada categoria com base na solicitação:

| Categoria | Critério de pontuação alta |
|---|---|
| **Instagram/Social Media** | Menciona posts, reels, stories, engajamento, copy para rede social |
| **SEO Técnico** | Menciona ranking, palavras-chave, meta tags, performance de busca |
| **Copy/Vendas** | Menciona persuasão, conversão, oferta, headline, gatilho mental |
| **Design/Imagem** | Menciona layout, cor, UI, visual, identidade, estética |
| **Código/Dev** | Menciona função, bug, componente, API, banco de dados, deploy |
| **Dados Técnicos** | Menciona especificação, produto, ficha técnica, comparativo |
| **Estratégia de Negócio** | Menciona plano, crescimento, posicionamento, concorrência, meta |

---

## ETAPA 3 — DECISÃO

- Selecione a **categoria com maior pontuação**.
- Em caso de empate: escolha a de **maior impacto estratégico** para o contexto atual.
- Se duas categorias estiverem empatadas e igualmente estratégicas: ative **ambas** em paralelo.

---

## ETAPA 4 — MAPEAMENTO DE SKILLS

| Categoria vencedora | Skill a ativar |
|---|---|
| Instagram / Social Media | `@instagram-revenue` |
| SEO Técnico | `@seo-fundamentals` + `@geo-fundamentals` |
| Copy / Vendas | `@brainstorming` (modo persuasão) |
| Design / Imagem | `@frontend-design` ou `@mobile-design` |
| Código / Dev | `@clean-code` + skill de stack específica |
| Dados Técnicos | `@api-patterns` + `@database-design` |
| Estratégia de Negócio | `@architecture` + `@plan-writing` |

---

## ETAPA 5 — EXIBIÇÃO OBRIGATÓRIA (antes de executar)

Sempre exibir este bloco antes de responder:

```
🔎 Análise da Solicitação
├── Intenção: [tipo identificado]
├── Palavras-chave: [lista]
│
📊 Pontuação por Categoria
├── Instagram/Social Media: [X]/10
├── SEO Técnico:            [X]/10
├── Copy/Vendas:            [X]/10
├── Design/Imagem:          [X]/10
├── Código/Dev:             [X]/10
├── Dados Técnicos:         [X]/10
└── Estratégia de Negócio:  [X]/10
│
🏆 Skill Selecionada: @[nome-da-skill]
📌 Justificativa: [1-2 frases explicando a escolha]
```

---

## ETAPA 6 — EXECUÇÃO

Após exibir o bloco de análise, execute com a skill selecionada:

- ✅ Máxima qualidade técnica
- ✅ Dados reais e verificáveis
- ✅ Sem informações inventadas
- ✅ Tom adequado à categoria selecionada

---

## REGRAS ADICIONAIS POR CATEGORIA

| Skill | Regra de ouro |
|---|---|
| Instagram | Priorizar **conversão** — todo post deve ter CTA, hook e prova social |
| SEO | Priorizar **estrutura técnica real** — keywords com volume verificável |
| Copy | Usar **gatilhos mentais estruturados** — escassez, autoridade, prova social |
| Design | Sem templates genéricos — identidade visual única e premium |
| Código | **Eficiência + boas práticas** — sem over-engineering |
| Dados Técnicos | Usar **apenas dados verificáveis** — sem especificações inventadas |
| Estratégia | **Clareza estratégica** — diagnóstico → ação → métrica |

---

## MODO FALLBACK

Se não for possível identificar categoria dominante com confiança ≥ 6/10:

1. Faça **uma pergunta cirúrgica** para clarificação.
2. Não assuma — pergunte primeiro.

---

*ag_AI_Router_Pro v1.0 — Global Pre-Processor*
