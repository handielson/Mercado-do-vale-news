---
name: ecommerce-conversion
description: Super-especialista em CRO (Conversion Rate Optimization) para e-commerce. Otimização de páginas de produto, gatilhos mentais, prova social, urgência real, ancoragem de preço e funil de vendas. Ativar sempre que trabalhar em páginas de produto, listagem, banners ou qualquer elemento que impacte a taxa de conversão.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# E-commerce Conversion Rate Optimization (CRO)

> **Missão:** Cada elemento da página tem UM propósito — mover o usuário para a próxima etapa do funil. Nada é decoração.
> **Princípio:** Venda para o CÉREBRO PRIMITIVO. Lógica justifica, emoção decide.

---

## 🎯 REGRA DE LEITURA SELETIVA

| Seção | Quando Ler |
|-------|-----------|
| **Fundamentos CRO** | 🔴 SEMPRE |
| **Página de Produto** | Quando otimizar PDP |
| **Listagem / Categoria** | Quando otimizar PLP |
| **Gatilhos Mentais** | Em qualquer CTA, preço ou urgência |
| **Métricas** | Antes de propor qualquer mudança |

---

## 1. FUNDAMENTOS CRO (SEMPRE LER)

### O Funil Real de E-commerce

```
TRÁFEGO → CATEGORIA → PRODUTO → CARRINHO → CHECKOUT → CONVERSÃO
   ↑           ↑          ↑          ↑           ↑
Não é        Browse    Intent    Commit       Close
seu job      Gap       Gap       Gap          Gap
```

**Onde o dinheiro é perdido:**
- 70% abandona no checkout
- 55% sai da PDP sem adicionar ao carrinho
- 40% abandona o carrinho com frete caro surpresa

### Os 3 Bloqueadores de Conversão

| Bloqueador | Sintoma | Solução |
|-----------|---------|---------|
| **Ansiedade** | "Será que é confiável?" | Trust signals, garantias visíveis |
| **Dúvida** | "É o produto certo pra mim?" | Specs claras, comparison, reviews |
| **Distração** | "Vou ver mais tarde" | Urgência real, CTA persistente |

### Hierarquia Visual de Conversão

```
1. HERO (imagem do produto) → Ativação emocional
2. PREÇO + CTA → Ancoragem + ação
3. PROVA SOCIAL → Validação
4. BENEFÍCIOS → Justificativa racional
5. GARANTIAS → Remoção de risco
6. CROSS-SELL → AOV (ticket médio)
```

---

## 2. PÁGINA DE PRODUTO (PDP)

### Above the Fold (Sem Scroll) — OBRIGATÓRIO

- [ ] Imagem de alta qualidade (zoom, múltiplos ângulos)
- [ ] Título claro com o modelo/variação
- [ ] Preço GRANDE e visível
- [ ] Preço de referência riscado (se aplicável)
- [ ] CTA principal: botão grande, cor contrastante
- [ ] Disponibilidade em estoque ("Apenas X unidades")
- [ ] Avaliação média + número de reviews

### Gatilhos na PDP

```
ESCASSEZ:    "Apenas 3 em estoque" (só mostrar se verdadeiro)
URGÊNCIA:    "Compre hoje, receba amanhã" (prazo real de entrega)
SOCIAL:      "47 pessoas compraram nas últimas 24h"
EXCLUSIVIDADE: "Produto exclusivo / Oferta especial"
ANCORAGEM:   Mostrar preço DE antes do preço POR
RECIPROCIDADE: "Brinde com compra acima de R$X"
```

### Imagens que Vendem

| Tipo | Propósito |
|------|-----------|
| **Produto isolado** (fundo branco) | Clareza, profissionalidade |
| **Produto em uso/contexto** | Desejo, identificação |
| **Detalhe/zoom** | Qualidade, confiança |
| **Comparação de escala** | Expectativa alinhada |
| **Unboxing/embalagem** | Experiência de compra |

### Descrição que Converte

```
NÃO faça: "iPhone 13 128GB Azul"
FAÇA:      "iPhone 13 128GB — Câmera Profissional, Bateria para o Dia Inteiro"

Estrutura:
1. Headline com benefício principal
2. 3-5 bullet points de benefícios (não features)
3. Especificações técnicas (para o racional)
4. Garantias e condições

FEATURE vs BENEFÍCIO:
❌ "Bateria de 4352mAh"
✅ "Bateria que dura o dia inteiro — sem procurar tomada"
```

---

## 3. LISTAGEM / CATEGORIA (PLP)

### Card de Produto que Converte

Elementos obrigatórios no card:
- [ ] Imagem limpa e consistente
- [ ] Nome do produto (conciso)
- [ ] Preço destacado
- [ ] Preço de referência (se desconto)
- [ ] % de desconto (badge)
- [ ] Avaliação (estrelas + qtd)
- [ ] Variações rápidas (cores) sem sair do card
- [ ] CTA rápido em hover ("Adicionar" / "Ver produto")

### Badges de Conversão

```
🔥 MAIS VENDIDO     → Prova social
⚡ OFERTA RELÂMPAGO → Urgência
🆕 NOVIDADE         → Curiosidade
✅ MELHOR CUSTO     → Âncora de valor
📦 ENVIO GRÁTIS     → Remove objeção
```

### Filtros que Aumentam Conversão

Ordem de importância dos filtros:
1. **Preço** (faixa) — mais usado
2. **Marca** — confiança
3. **Disponibilidade** (em estoque) — evita frustração
4. **Avaliação** (4+ estrelas)
5. **Condição** (novo/usado/recondicionado)

### Ordenação Padrão

```
Recomendado (algoritmo) → para novos usuários
Mais Vendidos            → prova social
Menor Preço              → sensível a preço
Maior Desconto           → caçadores de oferta
Avaliação                → qualidade
```

---

## 4. GATILHOS MENTAIS (ARSENAL COMPLETO)

### Escassez (Usar com Ética)

```javascript
// Estoque baixo — só mostrar se verdadeiro
if (stock <= 5) → "⚠️ Apenas {stock} unidades em estoque"
if (stock <= 3) → "🔴 Últimas unidades! Garanta o seu"
if (stock === 0) → Mostrar lista de espera ("Avise-me")
```

> ⚠️ **NUNCA usar escassez falsa.** Além de antiético, destrói confiança.

### Urgência

```
✅ Real: "Frete grátis hoje até às 18h para SP"
✅ Real: "Oferta válida até domingo"
✅ Real: "Entrega amanhã se pedir em 2h 34min"
❌ Fake: Contador zerado que reinicia
```

### Prova Social

```
Hierarquia de credibilidade:
1. Reviews com foto/vídeo de clientes reais
2. Rating numérico (4.8 de 5 — 1.847 avaliações)
3. "X pessoas compraram hoje"
4. Selos de site confiável (Reclame Aqui, Google)
5. Número de vendas ("+ 10.000 clientes satisfeitos")
```

### Ancoragem de Preço

```
Estratégias:
A) Mostrar preço cheio ANTES do desconto
   DE: R$ 2.499  → POR: R$ 1.899
   
B) Mostrar economia
   "Você economiza R$ 600 (24% off)"
   
C) Parcelar para parecer menor
   "12x de R$ 158 sem juros"
   
D) Comparação por dia
   "Menos de R$ 6/dia" (assinaturas)
```

### Reciprocidade (AOV)

```
Frete grátis acima de R$X → "Adicione R$Y para frete grátis"
Brinde acima de R$X → "Ganhe [brinde] nessa compra"
Desconto progressivo → "2 itens: 5% off | 3 itens: 10% off"
```

---

## 5. CTA (CALL TO ACTION)

### Hierarquia de CTAs

```
PRIMÁRIO:   "Comprar Agora" / "Adicionar ao Carrinho" → Verde, grande
SECUNDÁRIO: "Adicionar à Lista" / "Ver Detalhes"      → Outline, menor
TERCIÁRIO:  "Comparar" / "Compartilhar"               → Link simples
```

### Textos de CTA por Contexto

| Contexto | CTA Fraco | CTA Forte |
|----------|-----------|-----------|
| Produto disponível | "Comprar" | "Adicionar ao Carrinho" |
| Oferta limitada | "Comprar" | "Garantir Meu Desconto" |
| Assinatura | "Assinar" | "Começar Agora — Cancele Quando Quiser" |
| Produto caro | "Comprar" | "Parcelar em 12x sem juros" |
| Pré-venda | "Reservar" | "Garantir Meu Exemplar" |

### Cores de CTA

```
Verde → Confirmação, compra, segurança (mais testado)
Laranja → Energia, urgência, promoção
Vermelho → Urgência extrema (usar com cuidado)
EVITAR: Azul para CTA principal (confunde com link)
EVITAR: Cinza (parece desativado)
```

---

## 6. TRUST SIGNALS (SINAIS DE CONFIANÇA)

### Onde Posicionar

```
HEADER:  Logo de pagamento seguro, HTTPS
PDP:     Garantia, prazo de devolução, suporte
CHECKOUT: Todos os selos + resumo do pedido
FOOTER:  Certificações, CNPJ, endereço físico
```

### Arsenal de Confiança

- [ ] Selos de segurança (SSL, Antifraude)
- [ ] Reclame Aqui (nota visível)
- [ ] Google Reviews
- [ ] Prazo de devolução em destaque ("7 dias para devolver")
- [ ] Garantia do produto (meses/anos)
- [ ] CNPJ e endereço físico (rodapé)
- [ ] Chat de suporte acessível
- [ ] Políticas claras (entrega, troca, privacidade)

---

## 7. MÉTRICAS DE CRO

### KPIs Essenciais

| Métrica | O que mede | Meta típica |
|---------|-----------|-------------|
| **Taxa de conversão** | Visitantes que compram | 1-4% e-commerce |
| **Taxa de abandono carrinho** | Carrinhos abandonados | < 70% |
| **CTR do CTA** | Cliques no botão comprar | > 5% na PDP |
| **AOV** | Ticket médio | Aumentar com cross-sell |
| **Bounce rate PDP** | Saem sem interagir | < 50% |

### Hipóteses de Teste A/B (Priorizar por Impacto)

```
ALTO IMPACTO:
- Texto e cor do CTA principal
- Posição do preço/CTA above the fold
- Imagem hero do produto
- Urgência/escassez no produto

MÉDIO IMPACTO:
- Ordem dos elementos da PDP
- Número de imagens no carrossel
- Formato de avaliações/reviews
- Cross-sell (posição e algoritmo)

BAIXO IMPACTO:
- Tamanho de fonte
- Ícones de benefício
- Cor de badges
```

---

## 8. ANTI-PADRÕES DE CONVERSÃO

### ❌ Nunca Fazer

- **Pop-ups imediatos** → Usuário acabou de chegar, tem 0 intenção
- **Frete surpreendente no checkout** → Maior causa de abandono
- **Formulário de cadastro obrigatório** → Oferecer "compra como convidado"
- **Escassez falsa** → Destrói credibilidade para sempre
- **CTA fraco/genérico** → "Clique aqui" não vende
- **Página lenta** → 1 segundo a mais = 7% menos conversão
- **Mobile ignorado** → 60%+ do tráfego é mobile
- **Sem reviews** → 95% dos compradores lê reviews antes

### ✅ Sempre Fazer

- Frete calculado e visível ANTES do checkout
- Salvar carrinho (cookie/auth)
- Retargeting de carrinho abandonado
- Mobile-first em TUDO
- Loading rápido (Core Web Vitals green)
- Guest checkout disponível

---

## Related Skills

| Skill | Quando Usar |
|-------|------------|
| `checkout-optimization` | Otimizar fluxo de pagamento |
| `product-copywriting` | Escrever textos que vendem |
| `frontend-design` | Design visual das páginas |
| `seo-fundamentals` | Tráfego orgânico para as páginas |
| `performance-profiling` | Velocidade da página |
