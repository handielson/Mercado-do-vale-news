---
name: vps-data-architecture
description: Regras obrigatórias de arquitetura de dados (VPS vs Supabase) para evitar misturas de fonte de dados no catálogo de produtos.
---

# Regras de Arquitetura de Dados: VPS vs Supabase

## 🔴 REGRA CRÍTICA: FONTE ÚNICA DE VERDADE (SINGLE SOURCE OF TRUTH)

A partir da migração final, o banco de dados MySQL na **VPS é a única e exclusiva fonte de verdade** para o catálogo da loja.

Isso inclui inteiramente:
- Dados Primários de Produtos (Nome, SKU, Status)
- Descrições, Fichas Técnicas e Textos Ricos
- Kits e Combos (Componentes, Preços e Dependências)
- Estoque e Preços
- Imagens e Galerias Principais

**O Supabase NÃO DEVE MAIS SER UTILIZADO PARA O CATÁLOGO CORE:**
- ❌ `supabase.from('products').insert()` para novos produtos ou combos.
- ❌ `supabase.from('products').update()` para atualizar descrições, preços ou estoques.
- ❌ `supabase.from('products').select()` na vitrine pública para buscar o produto principal, variações (siblings), combos ou cross-sells. 

### 1. Leitura na Vitrine (Frontend Público)
Ao modificar ou criar novos componentes de produto na loja pública, **sempre utilize a API da VPS**.
- **Correto:** `await vpsApiService.getProductBySlug(slug)` ou `getProductById(id)`.
- **Incorreto:** Fazer a busca `supabase.from('products')` e tentar fazer fallback (merge) com a VPS.

### 2. Relacionamentos e Vitrines Recomendadas
As buscas de listinhas extras de produtos na página do produto devem trafegar pela inteligência da própria VPS:
- **Variantes/Irmãos:** Busque pela VPS usando o parametro `model_id`. Ex: `vpsApiService.getProducts({ model_id: id })`.
- **Relacionados:** Busque pela VPS filtrando pela ID da categoria `category`.
- **Cross-Sell Dinâmico:** Use o mecanismo de busca nativa da VPS passando a tag do produto. Ex: `vpsApiService.getProducts({ search: tag })`.

### 3. Exceções e Manutenção
O Supabase ainda é o núcleo duro da aplicação para as lógicas de backend e infraestrutura. Ele continua governando:
- Autenticação de Clientes e Sessões (`useSupabaseAuth`).
- Transações como Carrinho (Cart).
- Tabelas de configuração independentes (`custom_fields`, templates locais se aplicável).
- Cadastros hierárquicos que ainda não foram para VPS (como categorias raízes).

## Diretriz Comportamental do Agente (Você)
1. **Interceptação:** Se o usuário pedir para consertar um "bug de descrição vazia", "foto piscando" ou "estoque desatualizado", verifique imediatamente se o componente afetado está usando `vpsApiService`. Se ainda houver resquícios do Supabase misturado com a lógica da VPS, remova a dependência do Supabase e refatore para a VPS pura antes de tentar debugar.
2. **Nova Funcionalidade:** Se for criar algo novo no catálogo (ex: campo "garantia", "tags_seo"), certifique-se de que a implementação passe os dados inteiramente via API (MySQL) e não salve colunas silenciosas no Supabase.
