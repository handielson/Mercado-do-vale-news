---
name: marketplace-patterns
description: Super-especialista em padrões de marketplace e e-commerce. Página de produto (PDP), páginas de listagem (PLP), filtros, busca, categorias, navegação, resultados de busca e arquitetura de informação para lojas online. Ativar quando trabalhar em navegação de produtos, sistema de busca, categorias ou arquitetura de loja.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Marketplace Patterns — Arquitetura de Loja Online

> **Missão:** Usuário deve encontrar o produto certo no menor número de cliques possível — e sentir confiança em cada passo.
> **Princípio:** Clareza converte. Confusão mata a venda.

---

## 1. ARQUITETURA DE INFORMAÇÃO

### Hierarquia de Navegação

```
HOME
├── CATEGORIAS (menu principal)
│   ├── Smartphones
│   │   ├── Apple iPhone
│   │   ├── Samsung Galaxy
│   │   └── [Marca]
│   ├── Notebooks
│   ├── Acessórios
│   └── [Categoria]
├── PÁGINAS ESPECIAIS
│   ├── Ofertas / Promoções
│   ├── Mais Vendidos
│   ├── Lançamentos
│   └── Outlet / Recondicionados
└── BUSCA (global, sempre acessível)
```

### Profundidade Máxima de Categorias

```
✅ IDEAL: 2-3 níveis
  Eletrônicos → Smartphones → Apple iPhone

❌ EVITAR: 4+ níveis
  Eletrônicos → Portáteis → Smartphones → Android → Samsung → Galaxy S

Regra: Se o breadcrumb não cabe em uma linha mobile = fundo demais.
```

---

## 2. PÁGINA DE LISTAGEM (PLP — Category / Search Results)

### Layout de Grid

```
DESKTOP:
  4 colunas: padrão para maioria dos produtos
  3 colunas: para produtos maiores / mais premium
  2 colunas: para produtos muito detalhados (notebooks, TVs)

MOBILE:
  2 colunas: padrão (nunca 1 coluna — desperdício)
  1 coluna: apenas para produtos com muito texto/spec

TABLET:
  3 colunas landscape / 2 colunas portrait
```

### Anatomia do Card de Produto

```
┌─────────────────────┐
│  [BADGE: OFERTA/    │
│   MAIS VENDIDO]     │
│                     │
│   [IMAGEM PRODUTO]  │ ← 1:1 ou 4:3, fundo branco
│                     │
├─────────────────────┤
│ [MARCA] (pequeno)   │
│ [NOME PRODUTO]      │ ← 2 linhas máx, truncar
│ ★★★★☆ (4.2) 847    │ ← rating + n. avaliações
│                     │
│ ~~R$2.499~~         │ ← preço riscado (se desconto)
│ R$ 1.899            │ ← preço atual, destaque
│ ou 12x de R$158     │ ← parcelamento
│                     │
│ [CORES] ○ ○ ●       │ ← swatches clicáveis
│                     │
│ [ADICIONAR AO ↗]    │ ← CTA, aparece no hover
└─────────────────────┘
```

### Ordenação (Sort)

```
Ordem dos itens no dropdown de ordenação:
1. "Relevância" (default para buscas)
2. "Mais Vendidos" (default para categoria)
3. "Menor Preço"
4. "Maior Preço"
5. "Maior Desconto"
6. "Melhores Avaliações"
7. "Lançamentos" (se aplicável)

Mostrar ordenação atual: "Ordenado por: Mais Vendidos ▼"
```

### Resultados e Estado Vazio

```
RESULTADOS:
"X produtos encontrados" (sempre mostrar contagem)
"Mostrando 1-24 de 847 produtos"

ESTADO VAZIO (0 resultados):
✅ Mostrar: "Nenhum produto encontrado para '[busca]'"
✅ Sugerir: "Você quis dizer: [sugestão]?"
✅ Oferecer: categorias relacionadas
✅ CTA: "Ver todos os produtos" / "Limpar filtros"
❌ NUNCA: página em branco sem orientação
```

---

## 3. SISTEMA DE FILTROS

### Tipos de Filtros por Categoria

```
SMARTPHONES:
- Preço (range slider)
- Marca (checkbox — Apple, Samsung, Motorola...)
- Sistema Operacional (iOS, Android)
- Tamanho de tela (range)
- Armazenamento (32GB, 64GB, 128GB, 256GB, 512GB)
- RAM (4GB, 6GB, 8GB, 12GB+)
- Cor (swatches visuais)
- Câmera principal (MP range)
- Bateria (mAh range)
- Condição (Novo, Recondicionado)
- Disponibilidade (Em estoque)

NOTEBOOKS:
- Preço (range)
- Marca
- Processador (Intel i3/i5/i7/i9, AMD Ryzen, Apple M)
- RAM (8GB, 16GB, 32GB, 64GB)
- Armazenamento (256GB, 512GB, 1TB, 2TB)
- Tela (tamanho + resolução)
- Placa de vídeo (integrada, dedicada)
- Sistema operacional
- Uso (Gamer, Profissional, Estudante)
```

### UX dos Filtros

```
DESKTOP — Sidebar esquerda (sticky):
  ✅ Accordion por categoria de filtro
  ✅ Mostrar contagem: "Marca (5)" → indica quantos selecionados
  ✅ "Limpar filtros" visível quando há filtros ativos
  ✅ Aplicação imediata (não precisa clicar "Aplicar")
  ✅ Scroll independente do conteúdo

MOBILE — Bottom Sheet ou Drawer:
  ✅ Botão fixo: "Filtros (3)" com contagem de ativos
  ✅ Abre drawer de baixo para cima
  ✅ Botão "Aplicar filtros" no bottom do drawer
  ✅ Botão "Limpar tudo" no header do drawer

FILTROS ATIVOS — Tags visíveis:
  [Marca: Apple ×] [Preço: R$1.000-R$3.000 ×] [Limpar todos]
```

### Range Slider (Preço)

```
✅ Inputs manuais além do slider (para precisão)
✅ Valores formatados: "R$1.000 — R$3.000"
✅ Histograma de distribuição (mostra where the products are)
✅ Aplicar após soltar o slider (debounce)

Não usar range de preço com:
- Muito poucos produtos (< 10) → use checkboxes de faixa
- Preços muito concentrados → pouca utilidade
```

---

## 4. SISTEMA DE BUSCA

### Busca Inteligente (Autocomplete)

```
Trigger: ao digitar 2+ caracteres

Exibir no dropdown:
┌─────────────────────────────┐
│ 🔍 iphone 13                │ ← query atual
├─────────────────────────────┤
│ SUGESTÕES:                  │
│ iphone 13 128gb             │
│ iphone 13 pro max           │
│ iphone 13 pro               │
├─────────────────────────────┤
│ PRODUTOS (top 3-5):         │
│ [img] iPhone 13 128GB Blue  │
│       R$1.899 ★4.8          │
│ [img] iPhone 13 Pro 256GB   │
│       R$3.299 ★4.9          │
├─────────────────────────────┤
│ CATEGORIAS:                 │
│ 📱 Smartphones Apple (47)   │
└─────────────────────────────┘
```

### Tolerância a Erros de Digitação

```
Implementar:
✅ Fuzzy search (levenshtein distance)
✅ "Você quis dizer: [correção]?" no resultado
✅ Sinônimos: "celular" = "smartphone" = "telefone"
✅ Números: "iphone13" = "iphone 13"
✅ Acentos: "eletronico" = "eletrônico"

Casos especiais:
"Samsung s23" → Samsung Galaxy S23
"note" → Samsung Galaxy Note (categoria)
"carregador rapido" → filtrar por fast charging
```

### Search Results Page

```
Header da busca:
"[N] resultados para '[query]'"
"Mostrando resultados aproximados para '[query corrigida]'" (se typo)

Destaque da palavra buscada:
→ [query] em negrito nos nomes de produtos nos resultados

Sem resultados:
"Não encontramos produtos para '[query]'"
→ Sugestões de busca relacionadas
→ "Talvez você queira ver:" + categorias populares
→ CTA para contato/atendimento
```

---

## 5. PÁGINA DE PRODUTO (PDP)

### Estrutura Above the Fold (Desktop)

```
┌──────────────────────┬───────────────────────┐
│   IMAGENS (60%)      │  DADOS PRODUTO (40%)  │
│                      │                       │
│  [Main Image Large]  │  [MARCA]              │
│                      │  [Nome do Produto]    │
│  [Thumbs row]        │  ★★★★☆ (4.2) 847 av. │
│                      │                       │
│                      │  ~~R$2.499~~          │
│                      │  R$ 1.899    24% off  │
│                      │  12x de R$158 s/juros │
│                      │                       │
│                      │  [COR]: Azul          │
│                      │  ○ ● ○ (swatches)     │
│                      │                       │
│                      │  [ARMAZENAMENTO]      │
│                      │  [64GB] [128GB] [256GB]│
│                      │                       │
│                      │  [ADICIONAR ✓ ]       │ ← CTA principal
│                      │  [COMPRAR AGORA →]    │
│                      │                       │
│                      │  ✓ Entrega amanhã SP  │
│                      │  ✓ 30 dias p/ trocar  │
│                      │  ✓ 12x sem juros      │
└──────────────────────┴───────────────────────┘
```

### Estrutura Below the Fold (PDP)

```
SEÇÃO 1: Benefícios / Destaques
  → 3-5 bullets com ícone + benefício + descrição breve

SEÇÃO 2: Especificações Técnicas
  → Tabela: Spec | Valor
  → Accordion ou tabs (não mostrar 40 specs de uma vez)

SEÇÃO 3: Reviews / Avaliações
  → Rating breakdown (5★ XX%, 4★ XX%...)
  → Filtro de reviews (por nota, com foto)
  → Reviews com paginação (não infinito scroll aqui)

SEÇÃO 4: Perguntas e Respostas (Q&A)
  → Perguntas de outros clientes + respostas da loja
  → Campo para nova pergunta

SEÇÃO 5: Produtos Relacionados
  → "Frequentemente comprado junto" (cross-sell bundle)
  → "Clientes também viram" (similar)
  → "Você pode gostar" (personalizado)
```

### Galeria de Imagens

```
✅ Imagem principal grande (zoom on hover desktop)
✅ Miniaturas abaixo (desktop) ou lado (se espaço)
✅ Swipe em mobile
✅ Lightbox ao clicar (zoom)
✅ Múltiplos ângulos: frente, verso, lateral, detalhe
✅ Caso de uso / lifestyle (produto sendo usado)
✅ Vídeo (se disponível) — integrado na galeria

Padrão de imagens por produto:
- Mínimo: 3 imagens
- Ideal: 6-8 imagens
- Premium: + vídeo de 30-60s
```

---

## 6. BREADCRUMB E NAVEGAÇÃO

### Breadcrumb

```
Home > Eletrônicos > Smartphones > Apple iPhone > iPhone 13

Regras:
✅ Clicável em todas as etapas
✅ Schema.org markup (SEO)
✅ Mobile: mostrar apenas último nível + "..." para voltar
✅ Posição: abaixo do header, acima do produto
```

### Paginação vs. Infinite Scroll

```
PAGINAÇÃO (preferida para e-commerce):
✅ Usuário sabe onde está ("Página 3 de 12")
✅ Pode voltar para o último produto visto
✅ Melhor para SEO (páginas indexáveis)
✅ Melhor para footer accessibility

INFINITE SCROLL:
⚠️ Usar apenas se implementar "Save position"
✅ Feeds de conteúdo (não produtos)
✅ Sempre manter botão "Carregar mais" como fallback

LOAD MORE (botão):
✅ Melhor dos dois mundos para mobile
✅ Controle do usuário + sem recarregar página
```

---

## 7. CROSS-SELL E UPSELL

### Estratégias por Contexto

```
NA PDP (produto principal):
"Frequentemente comprado junto":
  [Produto principal] + [Acessório 1] + [Acessório 2]
  → Bundle com desconto opcional

"Outros produtos desta linha" (upsell):
  → Modelo superior com preço/benefício justificado

NO CARRINHO:
"Não esqueça de levar também":
  → Produtos complementares ao que está no carrinho
  → Preço baixo (impulso, sem deliberação)
  → 1-3 sugestões máx

"Clientes que compraram X também levaram":
  → Baseado em histórico real de compras

NA CONFIRMAÇÃO:
  → Cross-sell suave (1-2 produtos)
  → Sem urgência — pedido já foi feito
```

### Regras de Cross-sell

```
✅ Preço do cross-sell ≤ 30% do produto principal
✅ Relevância direta (case para iPhone, não geladeira)
✅ Máximo 4-6 produtos sugeridos
✅ Mostrar rating dos sugeridos
✅ One-click add to cart (sem sair da página)

❌ Nunca sugerir produto concorrente ao principal
❌ Nunca sugerir produto mais caro como cross-sell
   (isso é upsell — colocar separado e contextualizar o valor)
```

---

## 8. NAVEGAÇÃO MOBILE

### Menu Mobile

```
PADRÃO: Hamburger → Bottom Sheet / Drawer
✅ Swipe para fechar
✅ Categorias principais no primeiro nível
✅ Subcategorias no segundo nível (accordion)
✅ Busca SEMPRE acessível (não dentro do menu)
✅ CTA secundário: "Minha Conta" / "Carrinho"

ALTERNATIVA: Bottom Navigation Bar (apps/PWA):
[🏠 Início] [🔍 Busca] [🏷️ Ofertas] [🛒 Carrinho] [👤 Conta]
```

### Sticky Header Mobile

```
Comportamento:
- Scroll para baixo: header esconde (mais espaço)
- Scroll para cima: header aparece suavemente
- Sempre visível: logo + busca + carrinho

Na PDP:
- Sticky: nome do produto (truncado) + preço + "Comprar"
- Aparece quando o CTA principal sai da viewport
```

---

## 9. PERFORMANCE E LOADING

### Skeleton Screens (Loading State)

```
NUNCA usar spinner genérico em listagens.
SEMPRE usar skeleton que espelha o layout real do card.

Skeleton do card:
┌─────────┐
│░░░░░░░░░│  ← imagem (cinza animado)
│░░░░░░░░░│
├─────────┤
│░░░░░░░░ │  ← nome (2 linhas)
│░░░░░░   │
│░░░░     │  ← preço
└─────────┘
```

### Lazy Loading de Imagens

```
✅ Imagens below the fold: loading="lazy"
✅ Imagens above the fold (LCP): loading="eager" priority
✅ Placeholder blur (LQIP) enquanto carrega
✅ Tamanho de imagem correto por viewport (srcset)
✅ WebP como formato primário (+ fallback JPG)
```

---

## 10. SEO PARA MARKETPLACE

### URLs Limpas

```
CATEGORIA:
/smartphones/apple-iphone

PRODUTO:
/produto/iphone-13-128gb-azul

BUSCA:
/busca?q=iphone+13 (não indexar — canonicals)

FILTROS:
/smartphones?marca=apple&preco=1000-3000
→ Canonicalizar para URL principal da categoria
→ Não indexar páginas de filtro (exceto filtros principais como marca)
```

### Schema Markup Obrigatório

```json
Product schema:
{
  "@type": "Product",
  "name": "iPhone 13 128GB Azul",
  "image": ["..."],
  "description": "...",
  "brand": {"@type": "Brand", "name": "Apple"},
  "offers": {
    "@type": "Offer",
    "price": "1899",
    "priceCurrency": "BRL",
    "availability": "InStock"
  },
  "aggregateRating": {
    "ratingValue": "4.8",
    "reviewCount": "1847"
  }
}
```

### Meta Tags por Página

```
HOME:
  title: "[Loja] — [Tagline] | Eletrônicos e Tecnologia"
  desc: "Compre [categorias principais] com as melhores condições. Frete grátis, parcelamento e garantia."

CATEGORIA:
  title: "Smartphones [Marca] — [N] produtos | [Loja]"
  desc: "Os melhores [categoria] com preços imperdíveis. [Benefício 1], [Benefício 2]."

PRODUTO:
  title: "[Nome Produto] — Compre com [N]x sem juros | [Loja]"
  desc: "[Benefício 1]. [Benefício 2]. Entrega rápida e garantia de [N] anos."
```

---

## Related Skills

| Skill | Quando Usar |
|-------|------------|
| `ecommerce-conversion` | Otimizar conversão das páginas |
| `product-copywriting` | Escrever textos das páginas |
| `seo-fundamentals` | SEO técnico e de conteúdo |
| `frontend-design` | Design visual dos componentes |
| `checkout-optimization` | Otimizar o fluxo de compra |
