---
name: vpsskill
description: Arquitetura definitiva do Banco de Dados. A VPS (MySQL) é a única Fonte de Verdade para o Catálogo.
skills: []
---

# VPSSkill - Diretriz Absoluta de Acesso a Dados (Catálogo e Combos)

## 🔴 REGRA CRÍTICA DE ARQUITETURA (NUNCA IGNORE ESTA REGRA)

A API da VPS (`@/services/vpsApiService`) é a **ÚNICA** fonte de verdade para todos os dados de **CATÁLOGO DE PRODUTOS**.
O Supabase (tabela `products` e `models`) foi oficialmente **DESCONTINUADO** para leitura e gravação de produtos e combos.

**NUNCA**, **JAMAIS** crie, atualize, ou consulte dados de produtos ou combos utilizando chamadas para o Supabase (`supabase.from('products').select(...)` ou `update` ou `insert`). 

### O que usar?
- Para tudo relacionado ao produto/catálogo, utilize as funções da nossa interface oficial: `src/services/vpsApiService.ts`.

### 1. Manipulação de Produtos
- **Busca**: Sempre utilize `vpsApiService.getProductBySlug(slug)`, `getProductById(id)`.
- **Relacionados / Variantes / Cross-Sell**: Já estão processados pela VPS ou pelas rotas do `vpsApiService`. O Frontend não deve montar lógicas e queries extensas locais para agrupar isso em bancos antigos.
- **Gravação/Atualização**: O Painel Admin deve salvar as modificações (preço, descrição, estoque) sempre via API da VPS.

### 2. Combos de Produtos
- **Leitura e Busca**: Informação rica agora vive na VPS e flui de forma nativa.
- **Persistência**: Ao salvar um combo (ProductCombosPage), utilize estritamente `createCombo` ou `updateCombo` da VPS.
- **Jamais grave "cadastros paralelos" no Supabase.** A consistência do ERP requer que o Combo seja válido e único no banco MySQL.

### 3. Exceções (Onde o Supabase continua)
O Supabase é mantido como pilar de infraestrutura para:
- Autenticação de Usuários / Auth.
- Carrinho de Compras (`carts`, `cart_items`).
- Vendas / Checkout (`Orders`).
- Tabelas Estáticas / Menus / Categorias (tabelas menores de suporte do sistema).

### Resumo para Automações
Sempre que for trabalhar em telas como:
- `ProductCard.tsx`
- `PublicProductPage.tsx`
- `AdminProductList.tsx`
- `ProductCombosPage.tsx`
> **LEMBRE-SE**: Catálogo = VPS = `vpsApiService`. Qualquer código sugerido com `supabase.from('products')` será rejeitado imediatamente como dívida técnica e violação da arquitetura (Fail-Fast).
