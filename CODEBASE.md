# CODEBASE.md — Planta Completa: Mercado do Vale

> **LEITURA OBRIGATÓRIA antes de qualquer modificação.**
> Fonte de verdade sobre dependências, funções e zonas de risco.
> **ATUALIZAR SEMPRE** que criar, mover, remover arquivos ou funções.

---

## 🏗️ Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS |
| Roteamento | React Router v7 |
| Backend | Supabase (PostgreSQL + RLS + Storage) |
| Deploy | Vercel |
| Validação | Zod (`schemas/product.ts`) |

---

## 🗂️ Estrutura de Diretórios

```
mercado-do-vale/
├── components/
│   ├── catalog/          # Catálogo público (cliente)
│   ├── categories/       # Gerenciamento de categorias
│   ├── pdv/              # Componentes do PDV
│   ├── products/         # Componentes de produto (admin)
│   │   ├── entry/        # Entrada em massa
│   │   ├── sections/     # Seções do ProductForm
│   │   └── selectors/    # Dropdowns (BrandSelect, ColorSelect...)
│   ├── settings/         # Modais de configuração (ModelModal, etc.)
│   └── ui/               # Componentes base (SmartInput, CurrencyInput...)
├── hooks/                # Custom hooks
├── pages/
│   ├── admin/            # Páginas do painel admin
│   │   ├── products/     # CRUD de produtos
│   │   └── settings/     # Configurações (marcas, cores, modelos...)
│   ├── customer/         # Páginas do cliente (catálogo, perfil)
│   └── pdv/              # PDV
├── services/             # Chamadas ao Supabase
├── types/                # Interfaces TypeScript
└── utils/                # Funções utilitárias
```

---

## 📦 SERVICES — Funções Exportadas

### `services/products.ts` — CRUD Admin de Produtos
**Exporta:** `productService` (objeto)
**Tabela:** `products`
**Requer:** `company_id` via `getCompanyId()`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list()` | `(): Promise<Product[]>` | Lista todos os produtos da empresa |
| `getById(id)` | `(id: string): Promise<Product \| null>` | Busca produto por UUID |
| `getByEan(ean)` | `(ean: string): Promise<Product \| null>` | Busca por EAN (array `eans`) |
| `create(input)` | `(input: ProductInput): Promise<Product>` | Cria produto, faz upload de imagens |
| `update(id, input)` | `(id, input): Promise<Product>` | Atualiza produto |
| `delete(id)` | `(id: string): Promise<void>` | Remove produto |
| `search(query)` | `(query: string): Promise<Product[]>` | Busca por nome ou EAN |
| `searchByEAN(ean)` | `(ean: string): Promise<Product[]>` | Busca por EAN (retorna array) |
| `transformFromDB(row)` | `(row: any): Product` | Converte row do banco para tipo Product |

**⚠️ Usado por:** `useProducts`, `ProductForm`, `ProductDetailPage`, `ProductFormPage`

---

### `services/productService.ts` — Busca Simplificada (PDV)
**Exporta:** funções individuais (não objeto)
**Tabela:** `products`
**⚠️ NÃO usa `company_id` — queries sem RLS completo**

| Função | Assinatura | Busca em |
|--------|-----------|---------|
| `searchProducts(term)` | `(term: string): Promise<Product[]>` | `name`, `sku`, `specs->serial`, `specs->imei1`, `specs->imei2` |
| `getProductById(id)` | `(id: string): Promise<Product \| null>` | `id` |
| `getProductBySku(sku)` | `(sku: string): Promise<Product \| null>` | `sku` + `is_active=true` |
| `getProductByImei(imei)` | `(imei: string): Promise<Product \| null>` | `imei1` ou `imei2` (colunas diretas, não specs) |
| `getProductByBarcode(barcode)` | `(barcode: string): Promise<Product \| null>` | array `eans` via `.contains()` |

**⚠️ Usado por:** `ProductSearchSection` (PDV)
**⚠️ DIFERENTE de `products.ts`** — são dois services distintos para o mesmo banco!

---

### `services/catalogService.ts` — Catálogo Público
**Exporta:** `catalogService` (objeto)
**Tabela:** `products` (read-only)
**Cache:** 5 minutos em memória (`productCache`)

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `getProducts(filters, page, pageSize)` | filtros opcionais | Busca paginada com filtros (search, categories, brands, priceRange, inStockOnly, featuredOnly, newOnly) |
| `searchProducts(query)` | `(query: string): Promise<CatalogProduct[]>` | Busca por texto no catálogo |
| `getProductById(id)` | `(id: string): Promise<CatalogProduct \| null>` | Produto por ID |
| `getProductsByCategory(category)` | `(category: string): Promise<CatalogProduct[]>` | Produtos por categoria |
| `getFeaturedProducts(limit)` | `(limit?: number): Promise<CatalogProduct[]>` | Produtos em destaque |
| `getNewProducts(limit)` | `(limit?: number): Promise<CatalogProduct[]>` | Produtos novos |
| `recordProductView(productId, customerId?)` | async | Registra visualização |
| `addToFavorites(productId, customerId)` | async | Adiciona aos favoritos |
| `removeFromFavorites(productId, customerId)` | async | Remove dos favoritos |
| `getUserFavorites(customerId)` | `(customerId: string): Promise<CatalogProduct[]>` | Favoritos do cliente |
| `isFavorite(productId, customerId)` | `(): Promise<boolean>` | Verifica se é favorito |
| `clearCache()` | `(): void` | Limpa cache em memória |
| `getCategories()` | `(): Promise<string[]>` | Lista categorias disponíveis |
| `getBrands()` | `(): Promise<string[]>` | Lista marcas disponíveis |

**⚠️ Usado por:** `CustomerCatalogPage`, `CatalogSection`, `ProductDetailsModal`
**⚠️ Retorna `CatalogProduct` (tipo diferente de `Product`)** — ver `types/catalog.ts`

---

### `services/saleService.ts` — Vendas (PDV)
**Exporta:** `createSale`, `getSaleById`, `getSales`, `cancelSale`, `refundSale`, `getSalesSummary`
**Tabelas:** `sales`, `sale_items`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `createSale(saleInput)` | `(input: SaleInput): Promise<Sale>` | Cria venda + itens + atualiza estoque |
| `getSaleById(id)` | `(id: string): Promise<SaleWithItems \| null>` | Venda com itens |
| `getSales(filters?)` | `(filters?: SaleFilters): Promise<SaleWithItems[]>` | Lista vendas com filtros |
| `cancelSale(id)` | `(id: string): Promise<void>` | Cancela venda |
| `refundSale(id)` | `(id: string): Promise<void>` | Estorna venda |
| `getSalesSummary(filters?)` | `(filters?: SaleFilters): Promise<SaleSummary>` | Resumo financeiro |

**⚠️ `createSale` atualiza `stock_quantity` dos produtos vendidos**
**⚠️ Usado por:** `PDVPage` (via `handleFinalizeSale`)

---

### `services/averagePriceService.ts` — Preço Médio
**Exporta:** `averagePriceService`, `updateAveragePrices`
**Tabela:** `products` (update em massa)

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `updateAveragePrices(newProduct)` | `(newProduct: ProductInput & { model_id }): Promise<result \| null>` | Recalcula preço médio ponderado para todos os produtos da mesma variação |
| `getProductsByVariation(variation)` | `(variation: VariationKey): Promise<Product[]>` | Busca produtos por `model_id + specs.ram + specs.storage` |

**Chave de variação:** `model_id + specs.ram + specs.storage`
**⚠️ Só roda se `ram` E `storage` estiverem preenchidos** — produtos sem RAM/storage são ignorados
**⚠️ Atualiza TODOS os produtos da variação** — não só o novo
**⚠️ Usado por:** `ProductForm.tsx` (ao salvar)

---

### `services/modelColorImages.ts` — Fotos por Modelo+Cor
**Exporta:** `modelColorImageService`
**Tabela:** `model_color_images`
**⚠️ Coluna de imagens: `images TEXT[]` (array) — NÃO é `image_url`**

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `getByModelAndColor(modelId, colorId)` | `(): Promise<ModelColorImage[]>` | Todas as imagens de um modelo+cor |
| `create(input)` | `(input: ModelColorImageInput): Promise<ModelColorImage>` | Adiciona imagem à galeria |
| `updateOrder(imageId, newOrder)` | `(): Promise<ModelColorImage>` | Atualiza ordem de exibição |
| `reorderAll(modelId, colorId, imageIds)` | `(): Promise<void>` | Reordena toda a galeria (drag & drop) |
| `delete(imageId)` | `(imageId: string): Promise<void>` | Remove imagem |
| `deleteAllByModelAndColor(modelId, colorId)` | `(): Promise<void>` | Remove todas as imagens do modelo+cor |
| `getCoverImage(modelId, colorId)` | `(): Promise<ModelColorImage \| null>` | Primeira imagem (capa) |
| `hasImages(modelId, colorId)` | `(): Promise<boolean>` | Verifica se tem imagens |

**⚠️ Usado por:** `ModelColorImagesManager`, `ProductCard` (fallback de foto)
**⚠️ `ProductCard` NÃO usa este service** — faz query direta ao Supabase com `company_id`

---

## 🪝 HOOKS — Funções Retornadas

### `hooks/useProducts.ts`
**Retorna:**
```ts
{
  products: Product[],          // Lista filtrada
  allProducts: Product[],       // Lista completa
  isLoading: boolean,
  error: string | null,
  filters: ProductFiltersState,
  handleFilterChange: (filters) => void,
  refetch: () => void,
  deleteProduct: (id: string) => Promise<boolean>
}
```
**Usa:** `productService.list()` de `services/products.ts`
**Filtra no cliente:** por `name`, `sku` (search) e `status`

---

## 🧩 COMPONENTES CRÍTICOS

### `components/products/ProductForm.tsx`
**Props:** `productId?` (edição) ou nenhuma (criação)
**Estado interno crítico:**
- `serialList: string[]` — lista de seriais para entrada em massa
- `templateValues` — valores do template do modelo (autofill)

**Fluxo de salvamento (`handleFormSubmit`):**
1. Valida dados com Zod (`schemas/product.ts`)
2. Se `serialList.length > 0`: cria um produto por serial
3. Verifica unicidade de seriais antes de salvar qualquer um
4. Gera SKU: `MARCA-MODELO-COR-RAM-STORAGE` (determinístico)
5. Chama `productService.create()` de `services/products.ts`
6. Chama `updateAveragePrices()` de `services/averagePriceService.ts`

**Seções:**
- `ProductBasicInfo` → nome, SKU, EAN, modelo, marca, categoria
- `ProductSpecifications` → serial, IMEI1/2, cor, RAM, storage, versão, bateria
- `ProductPricing` → preços (centavos), is_gift
- `ProductImages` → upload de imagens

**⚠️ Efeitos colaterais ao modificar:**
- `handleFormSubmit` → afeta validação de serial, preço médio, SKU
- `serialList` → afeta `ProductSpecifications` (prop `onSerialConfirm`)
- SKU gerado → afeta agrupamento no catálogo

---

### `components/products/ProductCard.tsx`
**Props:** `product: Product`, `onEdit?`, `onDelete?`
**Estado:** `modelImageUrl: string | null`

**Lógica de foto:**
1. Se `product.images[]` tem itens → usa `product.images[0]`
2. Senão → busca `model_color_images` pelo `model_id` (query direta ao Supabase)
3. Query usa `company_id` (busca empresa por slug `mercado-do-vale`)
4. Coluna buscada: `images` (array) → usa `images[0]`

**⚠️ Faz 2 queries ao Supabase por card** (companies + model_color_images)

---

### `components/pdv/ProductSearchSection.tsx`
**Props:** `onAddToCart: (product, quantity) => void`
**Busca:** chama `searchProducts()` de `services/productService.ts`
**Debounce:** 500ms após parar de digitar
**Filtra:** produtos com `track_inventory=true` e `stock_quantity=0` são ocultados

---

### `components/catalog/CatalogSection.tsx`
**Props:** `section: CatalogSection` (configuração da seção)
**Agrupamento:** por `model_id + specs.color + specs.ram + specs.storage`
**Soma:** `stock_quantity` por grupo
**Usa:** `catalogService.getProducts()` ou `getFeaturedProducts()` etc.

---

## 🗄️ BANCO DE DADOS — Tabelas e Colunas

### `products`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `model_id` | UUID | FK models |
| `name` | TEXT | Nome do produto |
| `sku` | TEXT | Gerado: `MARCA-MODELO-COR-RAM-STORAGE` |
| `eans` | TEXT[] | Array de EANs |
| `specs` | JSONB | `{serial, imei1, imei2, color, ram, storage, version, battery_health}` |
| `price_cost` | INTEGER | Custo em centavos |
| `price_retail` | INTEGER | Varejo em centavos |
| `price_reseller` | INTEGER | Revenda em centavos |
| `price_wholesale` | INTEGER | Atacado em centavos |
| `stock_quantity` | INTEGER | Quantidade em estoque |
| `track_inventory` | BOOLEAN | Controla estoque? |
| `images` | TEXT[] | Fotos individuais (produtos usados) |
| `status` | TEXT | `active`, `inactive`, `out_of_stock`, `discontinued` |
| `is_gift` | BOOLEAN | Produto brinde (desconto 100%) |
| `is_active` | BOOLEAN | Visível no catálogo? |

**Busca por specs (sintaxe Supabase):**
```ts
.eq('specs->>serial', value)        // igual
.ilike('specs->>serial', '%value%') // like
```

### `model_color_images`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies — **obrigatório para RLS** |
| `model_id` | UUID | FK models |
| `color_id` | UUID | FK colors |
| `images` | TEXT[] | **Array de URLs** — NÃO é `image_url` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**⚠️ UNIQUE:** `(company_id, model_id, color_id)` — um registro por combinação

### `sales`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `customer_id` | UUID | FK customers — **obrigatório** |
| `seller_id` | UUID | FK team (opcional) |
| `subtotal` | INTEGER | Centavos |
| `discount_total` | INTEGER | Centavos |
| `total` | INTEGER | Centavos |
| `cost_total` | INTEGER | Centavos |
| `profit` | INTEGER | Centavos |
| `payment_methods` | JSONB | Array de pagamentos |
| `delivery_type` | TEXT | `store_pickup`, `delivery` |
| `delivery_cost_store` | INTEGER | Custo da loja |
| `delivery_cost_customer` | INTEGER | Custo do cliente |
| `promotional_discount` | INTEGER | Desconto promocional |
| `status` | TEXT | `completed`, `cancelled`, `refunded` |

---

## 🚨 ZONAS DE RISCO

### Zona 1: `specs` (JSONB)
Campos: `serial`, `imei1`, `imei2`, `color`, `ram`, `storage`, `version`, `battery_health`
- **Busca:** `.eq('specs->>campo', valor)` ou `.ilike('specs->>campo', '%valor%')`
- **Agrupamento catálogo:** usa `specs.color + specs.ram + specs.storage`
- **SKU:** gerado com `specs.color + specs.ram + specs.storage`
- **Preço médio:** usa `specs.ram + specs.storage` como chave de variação

### Zona 2: Preços (centavos)
- **TODOS os preços são inteiros em centavos** (R$ 10,00 = 1000)
- Usar sempre `CurrencyInput` — nunca `input type="number"` direto
- Campos: `price_cost`, `price_retail`, `price_reseller`, `price_wholesale`

### Zona 3: Dois services de produto
- `services/products.ts` → CRUD completo (admin) — exporta `productService`
- `services/productService.ts` → Busca simplificada (PDV) — exporta funções individuais
- **Mudanças no schema `products` afetam AMBOS**

### Zona 4: Agrupamento no Catálogo
Chave: `model_id + specs.color + specs.ram + specs.storage`
Implementado em **2 lugares**:
- `pages/customer/CustomerCatalogPage.tsx`
- `components/catalog/CatalogSection.tsx`
**Se mudar a lógica, mudar nos DOIS arquivos.**

### Zona 5: RLS (Row Level Security)
- Queries sem `company_id` retornam vazio **silenciosamente** (sem erro)
- `company_id` obtido via: `.from('companies').select('id').eq('slug', 'mercado-do-vale')`
- `model_color_images` exige `company_id` no filtro

### Zona 6: `model_color_images` — coluna `images[]`
- Coluna é `images TEXT[]` (array), **NÃO** `image_url`
- O service `modelColorImages.ts` tem interface desatualizada (diz `image_url`) — **ignorar a interface, usar `images`**
- Para pegar a capa: `data.images[0]`

### Zona 7: Entrada em Massa (serialList)
- `ProductForm.tsx` gerencia `serialList: string[]`
- Ao salvar: valida unicidade de TODOS os seriais antes de salvar qualquer um
- Cada serial gera um produto separado com o mesmo SKU
- Mudanças no fluxo de salvamento afetam entrada em massa

### Zona 8: Preço Médio — Condição de Ativação
- `updateAveragePrices` só roda se `ram` **E** `storage` estiverem preenchidos
- Produtos sem RAM/storage (ex: receptores) **não participam** do cálculo
- Atualiza **todos** os produtos da variação, não só o novo

---

## 🔄 Histórico de Mudanças (atualizar sempre)

| Data | Mudança | Arquivos afetados |
|------|---------|-------------------|
| 2026-02-18 | Agrupamento no catálogo por modelo+variação | `CustomerCatalogPage.tsx`, `CatalogSection.tsx` |
| 2026-02-18 | Busca por serial/IMEI no PDV | `services/productService.ts` |
| 2026-02-18 | Foto do modelo no ProductCard (fallback) | `components/products/ProductCard.tsx` |
| 2026-02-18 | SKU determinístico por modelo+config | `components/products/ProductForm.tsx` |
| 2026-02-18 | Botão Voltar no perfil do cliente | `pages/customer/CustomerProfilePage.tsx` |
| 2026-02-18 | Entrada em massa com validação de unicidade | `ProductForm.tsx`, `ProductSpecifications.tsx` |
| 2026-02-18 | Descoberto: `model_color_images.images` é array, não `image_url` | `ProductCard.tsx` |

---

## ✅ Checklist Antes de Modificar

1. Qual arquivo vou modificar?
2. Quem usa esse arquivo? (ver tabelas acima)
3. A mudança afeta alguma Zona de Risco?
4. Preciso atualizar mais de um arquivo?
5. A mudança afeta o banco de dados?
6. **Atualizar este CODEBASE.md** na seção "Histórico de Mudanças"
