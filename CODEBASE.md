# CODEBASE.md — Planta Completa: Mercado do Vale

> **LEITURA OBRIGATÓRIA antes de qualquer modificação.**
> Fonte de verdade sobre dependências, funções e zonas de risco.
> **ATUALIZAR SEMPRE** que criar, mover, remover arquivos ou funções.

---

## 🔴 DÉBITOS TÉCNICOS — Corrigir no Final

> Problemas identificados durante o mapeamento. Não causam bugs críticos agora, mas devem ser corrigidos.

| # | Problema | Arquivo(s) | Impacto | Prioridade |
|---|---------|-----------|---------|-----------| 
| 1 | ~~`versions.ts` usa localStorage~~ ✅ **RESOLVIDO** — `VersionSelect` e `VersionsPage` agora importam de `versions-supabase.ts` | `services/versions-supabase.ts` | — | — |
| 2 | ~~`resources.ts` stub legado mock~~ ✅ **RESOLVIDO** — arquivo não é importado por nenhum componente ativo | `services/resources.ts` | — | — |
| 3 | ~~`brands.ts` campo `active` hardcoded true~~ ✅ **RESOLVIDO** — coluna `active` adicionada na tabela + service atualizado | `services/brands.ts` | — | — |
| 4 | ~~`productService.ts` (PDV) não filtra por `company_id`~~ ✅ **RESOLVIDO** — todas as funções agora filtram explicitamente por `company_id` | `services/productService.ts` | — | — |
| 5 | ~~`modelColorImages.ts` interface desatualizada~~ ✅ **RESOLVIDO** — `ImageGalleryShared.tsx` reescrito para usar `model-color-images.ts` com `images TEXT[]` | `components/products/sections/ImageGalleryShared.tsx` | — | — |
| 6 | ~~`companyService.ts` referenciava `userId` não definido (bug de compilação)~~ ✅ **RESOLVIDO** — `console.log` com variável incorreta removido | `services/companyService.ts` | — | — |
| 7 | ~~`rams.ts` usa localStorage~~ ✅ **RESOLVIDO** — `RamSelect` importa de `rams-supabase.ts` | `services/rams-supabase.ts` | — | — |
| 8 | ~~`field-dictionary.ts` runtime usava localStorage~~ ✅ **RESOLVIDO** — código morto removido; `getFieldDefinitionRuntime` agora delega ao dicionário estático | `config/field-dictionary.ts` | — | — |
| 9 | ~~`storages.ts` usa localStorage~~ ✅ **RESOLVIDO** — `CapacitySelect` importa de `storages-supabase.ts` | `services/storages-supabase.ts` | — | — |

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

**⚠️ Filtro de busca** usa `name.ilike`, `brand.ilike` e `model.ilike` (OR)
**⚠️ Cache** não é aplicado quando há `search` ativo — garante resultados frescos ao digitar

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

### `services/categories.ts` — Categorias
**Exporta:** `categoryService`
**Tabela:** `categories`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list()` | `(): Promise<Category[]>` | Lista categorias ordenadas por `sort_order` |
| `getById(id)` | `(id: string): Promise<Category \| null>` | Categoria por ID |
| `create(input)` | `(input: CategoryInput): Promise<Category>` | Cria categoria, gera slug automático |
| `update(id, input)` | `(id, input): Promise<Category>` | Atualiza categoria e slug |
| `remove(id)` | `(id: string): Promise<void>` | Remove categoria |
| `updateSortOrder(orders)` | `(orders: {id, sort_order}[]): Promise<void>` | Reordena múltiplas categorias (drag & drop) |

**⚠️ Slug gerado automaticamente** a partir do nome (normalizado, sem acentos)
**⚠️ Usado por:** `CategoryEditPage`, filtros de produto, `ProductBasicInfo`

---

### `services/models-new.ts` — Modelos
**Exporta:** `modelService` e `modelsService` (alias de compatibilidade)
**Tabela:** `models`
**Depende de:** `services/model-eans.ts` (para EANs do modelo)

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list()` | `(): Promise<Model[]>` | Lista todos os modelos com brand e category |
| `getById(id)` | `(id: string): Promise<Model \| null>` | Modelo por ID (inclui `template_values`) |
| `listByBrand(brandId)` | `(brandId: string): Promise<Model[]>` | Modelos de uma marca |
| `create(input)` | `(input: ModelInput): Promise<Model>` | Cria modelo |
| `update(id, input)` | `(id, input): Promise<Model>` | Atualiza modelo |
| `delete(id)` | `(id: string): Promise<void>` | Remove modelo |
| `listActive()` | `(): Promise<Model[]>` | Apenas modelos ativos |
| `listActiveByBrand(brandId)` | `(brandId: string): Promise<Model[]>` | Modelos ativos de uma marca |

**⚠️ `template_values`** — campo JSONB com specs padrão do modelo (preenchido no autofill do ProductForm)
**⚠️ Usado por:** `ModelSelect`, `ProductForm` (autofill EAN), `ModelModal`, `ModelsPage`

---

### `services/brands.ts` — Marcas
**Exporta:** `brandService`
**Tabela:** `brands`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list()` | `(): Promise<Brand[]>` | Lista todas as marcas |
| `getById(id)` | `(id: string): Promise<Brand \| null>` | Marca por ID |
| `create(input)` | `(input: BrandInput): Promise<Brand>` | Cria marca |
| `update(id, input)` | `(id, input): Promise<Brand>` | Atualiza marca |
| `delete(id)` | `(id: string): Promise<void>` | Remove marca |
| `listActive()` | `(): Promise<Brand[]>` | Marcas ativas (alias de `list()`) |

**⚠️ Campo `active` não existe no banco ainda** — sempre retorna `true`
**⚠️ Usado por:** `BrandSelect`, `BrandsPage`, `ModelModal`

---

### `services/colors.ts` — Cores
**Exporta:** `colorService`, `COLOR_MAP`
**Tabela:** `colors`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list()` | `(): Promise<Color[]>` | Lista todas as cores |
| `getById(id)` | `(id: string): Promise<Color \| null>` | Cor por ID |
| `create(input)` | `(input: ColorInput): Promise<Color>` | Cria cor, auto-detecta `hex_code` do `COLOR_MAP` |
| `update(id, input)` | `(id, input): Promise<Color>` | Atualiza cor |
| `delete(id)` | `(id: string): Promise<void>` | Remove cor |
| `listActive()` | `(): Promise<Color[]>` | Apenas cores ativas |
| `getColorHex(name)` | `(name: string): string \| undefined` | Retorna hex do `COLOR_MAP` (síncrono, sem DB) |

**`COLOR_MAP`** — mapa estático: `{ 'Preto': '#000000', 'Branco': '#FFFFFF', ... }`
**⚠️ Usado por:** `ColorSelect`, `ColorsPage`, `ModelColorImagesManager`

---

### `services/companySettingsService.ts` — Configurações da Empresa
**Exporta:** `companySettingsService`
**Tabela:** `company_settings`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `get()` | `(): Promise<CompanySettings \| null>` | Busca configurações (único registro) |
| `update(settings)` | `(settings: CompanySettingsInput): Promise<CompanySettings>` | Atualiza ou cria configurações |
| `getDefaults()` | `(): Partial<CompanySettings>` | Retorna valores padrão (síncrono) |

**⚠️ Usado por:** `PDVPage` (gerar termo de garantia), `CompanySettingsPage`, `ReceiptPreview`
**⚠️ Não usa `company_id`** — assume único registro na tabela

---

### `services/uploadService.ts` — Upload de Imagens
**Exporta:** `uploadService`
**Bucket Supabase:** `catalog-banners`
**Limites:** 5MB máx, formatos: PNG, JPG, WEBP

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `uploadBannerImage(file)` | `(file: File): Promise<string>` | Upload e retorna URL pública |
| `deleteBannerImage(url)` | `(url: string): Promise<void>` | Remove imagem do storage |
| `validateImageFile(file)` | `(file: File): {valid, error?}` | Valida tipo e tamanho |
| `getPublicUrl(fileName)` | `(fileName: string): string` | URL pública de um arquivo |

**⚠️ Usado por:** `ProductImages` (seção do ProductForm), `BannerManager`
**⚠️ Bucket é `catalog-banners`** — não confundir com imagens de produto

---

### `services/bannerService.ts` — Gerenciamento de Banners v2.0
**Exporta:** `bannerService`, `CustomerType`, `BannerStats`
**Tabela:** `catalog_banners` — campos verificados em 2026-02-19:

| Coluna DB | Tipo | Observação |
|-----------|------|------------|
| `id` | uuid | PK |
| `title`, `subtitle` | text | `subtitle` adicionado em v2.0 |
| `image_url` | text | URL da imagem |
| `link_type` | text | `none/product/category/external` |
| `link_target` | text | **Campo canônico para destino do link** |
| `link_url` | text | Campo legado — não usar em INSERT/UPDATE novos |
| `is_active`, `is_draft` | boolean | `is_draft` = rascunho não publicado |
| `start_date`, `end_date`, `published_at` | timestamp | datas de agendamento e publicação |
| `display_order` | integer | ordem no carrossel |
| `clicks_count`, `views_count` | integer | analytics |
| `target_audience` | TEXT[] | **Adicionado em v2.0** — segmentação por tipo de cliente |
| `created_at`, `updated_at` | timestamp | auditoria |

| Função | O que faz |
|--------|-----------|
| `getActiveBanners(customerType?)` | Banners ativos (filtra por `is_active`, datas) + filtra por `target_audience` se `customerType` informado |
| `getAllBanners()` | Todos os banners sem filtro (admin) |
| `getBannerById(id)` | Banner por ID — retorna `null` se não existir |
| `createBanner(data)` | Cria banner |
| `updateBanner(id, updates)` | Atualiza banner (auto-seta `updated_at`) |
| `deleteBanner(id)` | Remove banner |
| `duplicateBanner(id)` | Clona banner com `"(cópia)"` no título, `is_active = false` |
| `getBannerStats()` | Retorna `BannerStats`: total, ativos, inativos, expirados, totalClicks, totalViews, topByClicks, topByViews |
| `reorderBanners(updates)` | Atualiza `display_order` em paralelo (`Promise.all`) — **bug fix: era loop sequencial** |
| `trackBannerClick(id)` | Incrementa `clicks_count` via RPC `increment_banner_clicks` |
| `trackBannerView(id)` | Incrementa `views_count` via RPC `increment_banner_views` |

**`CustomerType`:** `'varejo' | 'revenda' | 'atacado'`

**Lógica de segmentação em `getActiveBanners`:**
- Se `target_audience` for array vazio → banner é visível para todos
- Se `customerType` for informado → só mostra banners onde `target_audience` inclui o tipo OU está vazio

**⚠️ RPCs necessárias:** `increment_banner_clicks` e `increment_banner_views` — SQL comentado no final do arquivo
**⚠️ Migrations:** `supabase/create_banner_storage.sql`, `fix_banner_rls_policy.sql`, `fix_storage_banners_policy.sql`, **`banner_improvements.sql`** (v2.0)
**⚠️ Usado por:** `BannerManagementPage` (admin), `BannerCarousel` (catálogo público)

**Interface `BannerStats`:**
| Campo | Tipo | O que representa |
|-------|------|------------------|
| `total` | number | Total de banners cadastrados |
| `active` | number | Banners com `is_active = true` |
| `inactive` | number | Banners com `is_active = false` |
| `expired` | number | Banners onde `end_date < now()` |
| `totalClicks` | number | Soma de `clicks_count` de todos os banners |
| `totalViews` | number | Soma de `views_count` de todos os banners |
| `topByClicks` | `{id, title, clicks_count} \| null` | Banner com mais cliques |
| `topByViews` | `{id, title, views_count} \| null` | Banner com mais visualizações |

---

### `pages/admin/settings/BannerManagementPage.tsx` — Página de Banners (Admin) v2.0
**Usa:** `bannerService`, `BannerCard`, `BannerForm`
- **Painel de stats** no topo: total, cliques, views, expirados
- Drag & drop para reordenar banners ativos (**bug fix: usa `useRef` para evitar stale closure**)
- **Duplicar banner** via `handleDuplicate` → `bannerService.duplicateBanner`
- Seção separada de ativos / inativos
- Stats e lista carregados em paralelo com `Promise.all`

---

### `components/admin/BannerForm.tsx` — Formulário de Banner v2.0
**Props:** `banner?: CatalogBanner`, `onSave`, `onClose`

**Bug fixes aplicados:**
- **Bug 1 corrigido:** `start_date`/`end_date` armazenados como string diretamente (sem dupla conversão `new Date()`)
- **Bug 2 corrigido:** `handleSubmit` converte strings vazias para `undefined` (Supabase não aceita `''` em campos de data)
- **Bug 3 corrigido:** unificado `link_target` como campo canônico; fallback `?? link_url` (campo legado real na tabela — `link_value` **não existe no banco**)

**Novos campos:**
- `subtitle` — subtítulo exibido no carrossel
- `target_audience` — seleção de público-alvo via pills (varejo/revenda/atacado)
- Preview ao vivo do carrossel ao clicar "Ver preview"

---

### `components/admin/BannerCard.tsx` — Card de Banner (Lista Admin) v2.0
Preview miniatura + informações por card:
- Pills coloridos de `target_audience` (👥 Todos / 🛒 Varejo / 🤝 Revenda / 📦 Atacado)
- Badge "Expirado" se `end_date` no passado e banner ativo
- Exibe `subtitle` abaixo do título
- Stats inline: cliques e views
- Botão **Duplicar** (ícone `Copy`)
- **Nova prop:** `onDuplicate: (id: string) => void`

---

### `components/catalog/BannerCarousel.tsx` — Carrossel Público v2.0
**Props:** `banners?`, `customerType?: CustomerType`, `autoPlayInterval?`, `showDots?`, `showArrows?`

**Bug fix:** navegação usa `banner.link_target` como campo canônico com fallback `?? banner.link_url` para compatibilidade com banners antigos (campo legado real na tabela). `link_value` **não existe no banco**.

**Nova prop `customerType`:** passada para `getActiveBanners(customerType)` → filtra banners por tipo de cliente automaticamente.

- Sem `banners` prop → busca via `getActiveBanners(customerType)` ao montar + registra views
- Com `banners` prop → modo preview (editor de catálogo)
- Auto-play pausa ao hover; clique registra via `trackBannerClick`
- **Não renderiza nada se lista vazia** (`return null`)
- **⚠️ Usado por:** homepage do catálogo (`CustomerCatalogPage`)

---

### Segmentação de Banners por Tipo de Cliente (nova feature)

**Tabela:** coluna `target_audience TEXT[] DEFAULT '{}'`

| Valor | Tipo de cliente |
|-------|----------------|
| (array vazio) | Todos os visitantes |
| `'varejo'` | Clientes varejo |
| `'revenda'` | Revendedores |
| `'atacado'` | Atacadistas |

**Mapeamento `customer_type` do banco → `CustomerType` do banner** (feito em `pages/catalog/index.tsx`):

| `customer.customer_type` (banco) | `CustomerType` (bannerService) | Usuário |
|----------------------------------|-------------------------------|--------|
| `'retail'` | `'varejo'` | Cliente comum |
| `'wholesale'` | `'atacado'` | Atacadista |
| `'resale'` | `'revenda'` | Revendedor |
| `'ADMIN'` / `null` / não logado | `undefined` | Só banners sem segmentação |

**Rotas relacionadas ao sistema de banners:**

| Rota | Componente | Acesso | Descrição |
|------|-----------|--------|-----------|
| `/admin/settings/banners` | `BannerManagementPage` | Admin | CRUD, reorder, duplicar, stats |
| `/` (catálogo público) | `BannerCarousel` em `pages/catalog/index.tsx` | Público | Exibe banners filtrados por cliente |

**Migration necessária:** `supabase/banner_improvements.sql` (adiciona `target_audience`, `subtitle`, corrige RLS para anon)

---

### `services/catalogConfigService.ts` — Configurações do Catálogo
**Exporta:** `catalogConfigService` (instância de classe)
**Tabelas:** `catalog_settings`, `category_display_config`
**Cache:** 15 minutos em memória

| Função | O que faz |
|--------|-----------|
| `getSettings(userId?)` | Busca configurações do catálogo (retorna `DEFAULT_CATALOG_SETTINGS` se não autenticado) |
| `saveSettings(settings)` | Salva via upsert por `user_id` |
| `getCategoryConfig(categoryId)` | Configuração de exibição de uma categoria |
| `getAllCategoryConfigs()` | Todas as configurações de categorias |
| `saveCategoryConfig(config)` | Salva config de categoria via upsert |
| `applyVisibilityRules(products, settings)` | Filtra produtos por: `hide_inactive`, `hide_out_of_stock`, `hide_zero_price`, `min_stock_to_show` |
| `applyCategoryVisibilityRules(categories, settings)` | Filtra categorias por: `hide_empty_categories`, `hide_categories_no_stock` |
| `clearCache()` | Limpa cache |

**⚠️ `getSettings` usa `supabase.auth.getUser()`** — depende de autenticação
**⚠️ Usado por:** `useCatalog`, `CatalogConfigPage`, `CustomerCatalogPage`

---

### `services/catalogEditorService.ts` — Editor de Catálogo (Draft/Publish)
**Exporta:** `catalogEditorService`
**Tabelas:** `catalog_banners`, `catalog_settings`

| Função | O que faz |
|--------|-----------|
| `loadCatalogState(mode)` | Carrega estado do catálogo (`'draft'` ou `'published'`) |
| `saveDraft(state)` | Salva rascunho (banners + settings) |
| `publish()` | Publica rascunho atual (copia draft → published) |
| `discardDraft()` | Descarta rascunho |
| `copyPublishedToDraft()` | Copia versão publicada para draft (para começar edição) |

**⚠️ Fluxo:** `copyPublishedToDraft` → editar → `saveDraft` → `publish`
**⚠️ Usado por:** `CatalogEditorPage`

---

### `services/catalogSectionsService.ts` — Seções do Catálogo
**Exporta:** `catalogSectionsService` (instância de classe)
**Tabela:** `catalog_sections`
**Cache:** 5 minutos

| Função | O que faz |
|--------|-----------|
| `getSections(userId?)` | Todas as seções do usuário |
| `getActiveSections(userId?)` | Apenas seções habilitadas |
| `getSection(id)` | Seção por ID |
| `createSection(data)` | Cria nova seção |
| `updateSection(id, updates)` | Atualiza seção |
| `deleteSection(id)` | Remove seção |
| `reorderSections(sectionIds)` | Reordena seções (drag & drop) |
| `getProductsForSection(section)` | Busca produtos para uma seção (aplica filtros de tipo) |
| `clearCache()` | Limpa cache |

**Tipos de seção (`SectionType`):** `featured`, `new`, `category`, `brand`, `custom`
**⚠️ Usado por:** `CatalogEditorPage`, `CatalogSection` (homepage)

---

### `services/inventory.ts` — Controle de Estoque
**Exporta:** `inventoryService` (instância de classe)
**Tabelas:** `products`, `stock_movements`

| Função | O que faz |
|--------|-----------|
| `getInventory(filters)` | Lista produtos com filtros de inventário |
| `getInventoryGrouped(filters)` | Produtos agrupados por `brand+model+color+storage` (serializados) ou individuais |
| `getStats()` | Estatísticas: total de produtos, valor total, produtos com baixo estoque |
| `adjustStock(adjustment)` | Ajusta estoque de um produto + registra movimento |
| `getMovements(productId, limit)` | Histórico de movimentações de um produto |
| `getLowStockProducts(threshold)` | Produtos com estoque abaixo do threshold (padrão: 10) |
| `getBrands()` | Lista de marcas únicas no inventário |

**⚠️ `adjustStock` cria registro em `stock_movements` (imutável — trilha de auditoria)**
**⚠️ Usado por:** `InventoryPage`, `StockAdjustmentModal`

---

### `services/model-eans.ts` — EANs por Modelo
**Exporta:** `modelEANsService`
**Tabela:** `model_eans`

| Função | O que faz |
|--------|-----------|
| `getByEAN(ean)` | Busca modelo pelo EAN (retorna `{found, model, ean_record}`) |
| `getByModelId(modelId)` | Lista todos os EANs de um modelo |
| `add(input)` | Adiciona EAN a um modelo (valida 13 dígitos) |
| `update(id, updates)` | Atualiza EAN |
| `setPrimary(id)` | Define EAN como principal |
| `remove(id)` | Remove EAN |
| `validateEAN13(ean)` | Valida checksum EAN-13 (síncrono) |
| `checkDuplicate(ean)` | Verifica se EAN já existe no banco |

**⚠️ `getByEAN` faz JOIN com `models`, `brands`, `categories`**
**⚠️ Usado por:** `useEANAutofill` (ProductForm), `ModelModal`, `models-new.ts`

---

### `services/companyService.ts` — Dados da Empresa
**Exporta:** `getCompanyData`, `saveCompanyData`, `clearCompanyData`
**Tabela:** `company_settings` (registro único global)

| Função | O que faz |
|--------|-----------|
| `getCompanyData()` | Busca dados da empresa (retorna `defaultCompany` se não existir) |
| `saveCompanyData(data)` | Salva/atualiza dados da empresa |
| `clearCompanyData()` | Remove todos os registros |

**⚠️ DIFERENTE de `companySettingsService.ts`** — dois services para a mesma tabela!
- `companyService.ts` → dados completos da empresa (CNPJ, endereço, redes sociais, PIX)
- `companySettingsService.ts` → configurações de recibo/PDV (header, footer, largura)
**⚠️ Usado por:** `CompanyPage` (configurações da empresa)

---

### `services/customers.ts` — Clientes
**Exporta:** `customerService` (instância de classe)
**Tabela:** `customers`
**Cache:** 5 minutos em memória

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list(filters?)` | `(filters?: CustomerFilters): Promise<Customer[]>` | Lista clientes com filtros (search, is_active, datas) |
| `getById(id)` | `(id: string): Promise<Customer \| null>` | Cliente por ID |
| `getByCpfCnpj(cpfCnpj)` | `(cpfCnpj: string): Promise<Customer \| null>` | Cliente por CPF/CNPJ |
| `create(input)` | `(input: CustomerInput): Promise<Customer>` | Cria cliente |
| `update(id, input)` | `(id, input): Promise<Customer>` | Atualiza cliente |
| `softDelete(id)` | `(id: string): Promise<void>` | Desativa cliente (`is_active = false`) |
| `delete(id)` | `(id: string): Promise<void>` | Remove cliente do banco |
| `search(query)` | `(query: string): Promise<Customer[]>` | Busca por nome (alias de `list({search})`) |
| `getActiveCount()` | `(): Promise<number>` | Conta clientes ativos |
| `clearCache()` | `(): void` | Limpa cache em memória |

**⚠️ Busca por:** `name`, `cpf_cnpj`, `email` (via `.or()`)
**⚠️ Usado por:** `CustomerSection` (PDV), `CustomerListPage`, `CustomerFormPage`

---

### `services/warrantyDocumentService.ts` — Documentos de Garantia
**Exporta:** `warrantyDocumentService`
**Tabela:** `warranty_documents`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `create(input)` | `(input: WarrantyDocumentInput): Promise<WarrantyDocument>` | Cria documento de garantia |
| `getBySaleId(saleId)` | `(saleId: string): Promise<WarrantyDocument \| null>` | Documento por ID de venda |
| `getById(id)` | `(id: string): Promise<WarrantyDocument \| null>` | Documento por ID |
| `list()` | `(): Promise<WarrantyDocument[]>` | Lista todos os documentos |
| `update(id, input)` | `(id, input): Promise<WarrantyDocument>` | Atualiza documento |
| `remove(id)` | `(id: string): Promise<void>` | Remove documento |

**⚠️ Usado por:** `PDVPage` (geração de garantia após venda)

---

### `services/payment-fees.ts` — Taxas de Pagamento
**Exporta:** `paymentFeesService`, `getDefaultOperatorFee`, `getDefaultAppliedFee`
**Tabela:** `payment_fees`

| Função | Assinatura | O que faz |
|--------|-----------|-----------|
| `list()` | `(): Promise<PaymentFee[]>` | Lista todas as taxas (ordenadas por método e parcelas) |
| `update(id, input)` | `(id, input): Promise<void>` | Atualiza taxa |
| `initializeDefaults()` | `(): Promise<void>` | Inicializa taxas padrão se tabela vazia |
| `getDefaultOperatorFee(n)` | `(installments: number): number` | Taxa padrão da operadora por parcelas |
| `getDefaultAppliedFee(n)` | `(installments: number): number` | Taxa aplicada padrão por parcelas |

**Taxas padrão:** débito=1%, pix=0%, crédito 1x=0%, crédito 2x-18x=6%-22%
**⚠️ Usado por:** `PaymentSection` (PDV), `PaymentFeesPage`

---

### `services/model-variants.ts` — Variantes de Modelo (Modelo+Versão+Cor)
**Exporta:** `modelVariantsService`
**Tabelas:** `model_variants`, `model_variant_images`
**Bucket Storage:** `product-images`

| Função | O que faz |
|--------|-----------|
| `getOrCreate(params)` | Busca ou cria variante por `{model_id, version_id, color_id}` |
| `getWithDetails(variantId)` | Variante com JOIN em models, versions, colors, images |
| `getByModelId(modelId)` | Todas as variantes de um modelo |
| `remove(variantId)` | Remove variante |
| `getImages(variantId)` | Imagens da variante |
| `addImage(input)` | Adiciona imagem à variante |
| `uploadImage(variantId, file, onProgress?)` | Upload para `product-images` bucket |
| `reorderImages(variantId, imageIds)` | Reordena imagens |
| `setPrimaryImage(imageId)` | Define imagem principal |
| `removeImage(imageId)` | Remove imagem do banco e do storage |

**⚠️ Bucket:** `product-images` (diferente de `catalog-banners`)
**⚠️ Usado por:** `ModelVariantsManager`, `ModelModal`

---

### `services/bulk-products.ts` — Importação em Massa via Excel
**Exporta:** `bulkProductService`
**Depende de:** `productService` (de `products.ts`), `categoryService`
**Lib:** `xlsx`

| Função | O que faz |
|--------|-----------|
| `parseExcelFile(file)` | Lê arquivo Excel e retorna array de linhas normalizadas |
| `validateBulkRows(rows)` | Valida EAN (13 dígitos), IMEI (15 dígitos), serial obrigatório, duplicatas no lote |
| `generatePreview(rows)` | Busca produto base por EAN, mescla com campos únicos |
| `createBulkProducts(previews)` | Cria produtos válidos, retorna `{total, success, failed, errors}` |

**⚠️ `generatePreview` chama `productService.searchByEAN` para cada linha**
**⚠️ Usado por:** `BulkImportPage`

---

### `services/units.ts` — Unidades de Produto
**Exporta:** `unitService`
**Tabela:** `units`

| Função | O que faz |
|--------|-----------|
| `listByProduct(productId)` | Unidades de um produto |
| `getById(id)` | Unidade por ID |
| `create(input)` | Cria unidade (`imei_1`, `imei_2`, `serial`, `status`) |
| `updateStatus(id, status)` | Atualiza status da unidade |
| `delete(id)` | Remove unidade |
| `getStatsByProduct(productId)` | Contagem por status: `{total, available, reserved, sold, rma}` |

**`UnitStatus`:** `AVAILABLE`, `RESERVED`, `SOLD`, `RMA`
**⚠️ Tabela `units` é separada de `products`** — cada produto pode ter múltiplas unidades
**⚠️ Usado por:** `UnitForm`, `UnitList`, `ProductDetailPage`

---

### `services/versions.ts` — Versões de Produto ⚠️ LEGADO localStorage
**Exporta:** `versionService`
**Persistência:** `localStorage` (chave: `antigravity_versions_v1`) — **NÃO usa Supabase**

| Função | O que faz |
|--------|-----------|
| `list()` | Lista todas as versões |
| `getById(id)` | Versão por ID |
| `create(input)` | Cria versão (salva em localStorage) |
| `update(id, input)` | Atualiza versão |
| `delete(id)` | Remove versão |
| `listActive()` | Apenas versões ativas |

**Versões padrão:** Global, China, USA, Europa, Brasil
**⚠️ LEGADO** — dados ficam no browser, não no banco. Migração para Supabase pendente.
**⚠️ Usado por:** `VersionSelect`, `ModelModal`

---

### `services/rams-supabase.ts` — RAM (Supabase) ✅ ATIVO
**Exporta:** `ramService`
**Tabela:** `rams`

| Função | O que faz |
|--------|-----------|
| `list()` | Lista RAMs ativas ordenadas por `display_order` |
| `getById(id)` | RAM por ID |
| `create(input)` | Cria RAM (`name`, `value_gb`, `display_order`) |
| `update(id, input)` | Atualiza RAM |
| `delete(id)` | Remove RAM |
| `listActive()` | Alias de `list()` (já filtra ativas) |

**⚠️ Usado por:** `RamSelect`, `CapacitySelect` (para filtragem de RAM)
**⚠️ `rams.ts` ainda existe mas NÃO é usado pelos selectors — usar `rams-supabase.ts`**

---

### `services/storages-supabase.ts` — Storage (Supabase) ✅ ATIVO
**Exporta:** `storageService`
**Tabela:** `storages`

| Função | O que faz |
|--------|-----------|
| `list()` | Lista storages ativos ordenados por `display_order` |
| `getById(id)` | Storage por ID |
| `create(input)` | Cria storage (`name`, `value_gb`, `display_order`) |
| `update(id, input)` | Atualiza storage |
| `delete(id)` | Remove storage |
| `listActive()` | Alias de `list()` |

**⚠️ Usado por:** `CapacitySelect`
**⚠️ `storages.ts` ainda existe mas NÃO é usado pelos selectors — usar `storages-supabase.ts`**

---

### `services/batteryHealths-supabase.ts` — Saúde da Bateria (Supabase) ✅ ATIVO
**Exporta:** `batteryHealthService`
**Tabela:** `battery_healths`

| Função | O que faz |
|--------|-----------|
| `list()` | Lista battery healths ativos por `display_order` |
| `getById(id)` | Battery health por ID |
| `create(input)` | Cria (`name`, `percentage`, `display_order`) |
| `update(id, input)` | Atualiza |
| `delete(id)` | Remove |
| `listActive()` | Alias de `list()` |

**⚠️ Usado por:** `BatteryHealthSelect`, `ProductSpecifications`

---

### `services/resources.ts` — Services Auxiliares ⚠️ LEGADO Mock
**Exporta:** `brandService`, `modelService`, `colorService`, `capacityService`, `versionService`, `COLOR_MAP`
**Persistência:** Mock em memória (DEV_MODE) ou dados hardcoded

**⚠️ LEGADO** — este arquivo é um stub antigo. Os services reais são:
- `services/brands.ts` → `brandService` (Supabase)
- `services/models-new.ts` → `modelService` (Supabase)
- `services/colors.ts` → `colorService` (Supabase)

**⚠️ CONFLITO DE NOMES:** `resources.ts` exporta `brandService`, `modelService`, `colorService` com os mesmos nomes dos services reais. Verificar imports antes de modificar.

---

### `services/shippingService.ts` — Sistema de Frete ✅ ATIVO
**Exporta:** `shippingService` (objeto)
**Tabelas:** `shipping_settings`, `shipping_zones`, `shipping_price_ranges`
**Arquitetura:** Single-tenant (sem `company_id`) — tabelas acessadas diretamente sem filtro de empresa
**APIs externas:** ViaCEP (busca de CEP), Melhor Envio (cálculo nacional)

| Função | O que faz |
|--------|-----------|
| `getSettings()` | Busca configurações de frete (`.limit(1).maybeSingle()`) |
| `saveSettings(input)` | Atualiza se existir, insere se não existir |
| `getZones()` | Lista todas as zonas de entrega com `price_ranges` populados |
| `createZone(input)` | Cria zona de entrega |
| `updateZone(id, input)` | Atualiza zona |
| `deleteZone(id)` | Remove zona e suas faixas de preço |
| `createPriceRange(input)` | Cria faixa de preço para uma zona |
| `updatePriceRange(id, input)` | Atualiza faixa |
| `deletePriceRange(id)` | Remove faixa |
| `calculate(input)` | Calcula opções de frete para um CEP dado (retorna `ShippingOption[]`) |

**Lógica de cálculo (`calculate`):**
1. Busca CEP via ViaCEP → obtém cidade e coordenadas
2. Calcula distância (Haversine) do CEP de origem ao destino
3. Verifica zonas `local_free`: se cidade/CEP bater → frete grátis
4. Verifica zonas `local_paid`: aplica `fixed_price` ou `price_per_km`
5. Fallback: chama Melhor Envio se `melhor_envio_enabled = true`

**RLS:** Leitura pública (`FOR SELECT USING (true)`), escrita requer autenticação
**Migration:** `supabase/shipping_system.sql` — deve ser executada antes de usar
**⚠️ Usado por:** `DeliveryOptions.tsx` (cálculo automático ao buscar CEP), `ShippingPage` (admin)

---

### `utils/whatsappMessageGenerator.ts` — Mensagem de Orçamento Individual
**Exporta:** `generateQuoteMessage`, `generateWhatsAppLink`
**Usado por:** `QuoteModal.tsx` (botão "Enviar WhatsApp" do cliente)

**Dois formatos:**
- **Admin/Equipe** (`isAdmin = true`): cabeçalho `📝 ORÇAMENTO DE PRODUTOS` + mensagem promocional `"Garanta o seu agora..."` ao final
- **Cliente** (`isAdmin = false`): cabeçalho `📱 ORÇAMENTO DE PRODUTOS`, inclui endereço de entrega completo (logradouro, número, complemento, bairro, cidade, estado, CEP), frete selecionado e observações. Encerra com `_Mercado do Vale_`

**Interface `DeliveryOption`:**
```ts
{ type: 'pickup' | 'delivery'; address?: Address; notes?: string; shippingOption?: ShippingOption; }
```

**⚠️ `DeliveryOption` é definido tanto aqui quanto em `DeliveryOptions.tsx`** — devem estar sincronizados

---

### `utils/multiProductQuoteGenerator.ts` — Mensagem de Orçamento Multi-Produto
**Exporta:** `generateMultiProductQuoteMessage`, `generateMultiProductWhatsAppLink`
**Usado por:** `QuoteCartSidebar.tsx` (carrinho de orçamentos do admin)

**Lógica de totais (respeita modo de pagamento por item):**
- Item é `parcelado` se: `showInstallment = true` E `installments > 1`
- Item é `à vista` em qualquer outro caso
- **Carrinho homogêneo à vista:** exibe `💰 Total à vista: R$ X`
- **Carrinho homogêneo parcelado:** exibe `💳 Total parcelado (Nx): R$ X`
- **Carrinho misto:** exibe subtotal à vista + subtotal parcelado + `📊 Total geral`

**Regras de exibição por item:**
- RAM/Storage só aparecem se definidos (produtos sem variantes não exibem `undefined/undefined`)
- Mensagem final: `🎯 Orçamento exclusivo Mercado do Vale! / Garanta o seu agora enquanto está disponível em estoque! 🔥`

---

### `contexts/QuoteCartContext.tsx` — Carrinho de Orçamentos (Admin)
**Exporta:** `QuoteCartProvider`, `useQuoteCart`, `QuoteCartItem`
**Persistência:** `localStorage` (chave: `mercado_do_vale_quote_cart`)

**Interface `QuoteCartItem`:**
```ts
{
  id: string;
  product: CatalogProduct;
  variant: { ram: string; storage: string };  // pode ser undefined/undefined para produtos sem variantes
  availableColors: string[];
  price: number;           // em centavos
  installmentPlan: InstallmentPlan;
  paymentOptions: { showCash: boolean; showInstallment: boolean };
}
```

**⚠️ `paymentOptions` é usado pelo `multiProductQuoteGenerator` para calcular totais corretos**
**⚠️ Usado por:** `QuoteCartSidebar`, `QuoteModal` (admin)

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

### `hooks/useCatalog.ts`
**Retorna:**
```ts
{
  products: CatalogProduct[],
  isLoading: boolean,
  error: string | null,
  filters: FilterState,
  settings: CatalogSettings,
  filterStats: {
    categories: { id, name, count }[],
    brands: { name, count }[],
    priceRange?: { min: number; max: number }  // em centavos
  },
  hasMore: boolean,
  total: number,
  setFilters: (filters) => void,
  loadMore: () => void,
  refresh: () => void,
}
```
**Usa:** `catalogService.getProducts()` + `catalogConfigService` + `catalogMetadataService`
**⚠️ Usado por:** `pages/catalog/index.tsx`

---

### `hooks/useEffectiveCustomerType.ts`
Retorna o tipo efetivo do cliente (varejo/revenda/atacado) para exibição de preços no catálogo.
**⚠️ Usado por:** `ModernProductCard`, `ProductDetailsModal`

---

### `hooks/useEnrichedCustomFields.ts`
**Parâmetro:** `categoryFields: CategoryCustomField[]`
**Retorna:** `{ fields: EnrichedField[], loading, error }`

Enriquece campos customizados da categoria com dados da biblioteca (`customFieldsService`).
Suporta dois formatos:
- **Formato antigo (inline):** `{id, name, key, type, requirement}` — usa dados diretos
- **Formato novo (referência):** `{id, field_id, requirement}` — busca dados da biblioteca pelo `field_id`

**⚠️ Usado por:** `ProductSpecifications`, `CategoryEditPage`

---

### `hooks/useShareUrl.ts`
**Retorna:** `{ generateShareUrl, shareUrl, copyToClipboard, canUseNativeShare, nativeShare }`

| Função | O que faz |
|--------|-----------|
| `generateShareUrl(platform, options)` | Gera URL para WhatsApp/Facebook/Twitter/Email |
| `shareUrl(platform, options)` | Abre janela de compartilhamento |
| `copyToClipboard(text)` | Copia para clipboard (`navigator.clipboard`) |
| `canUseNativeShare()` | Verifica se Web Share API está disponível |
| `nativeShare(options)` | Usa Web Share API nativa (mobile) |

**Plataformas:** `'whatsapp' | 'facebook' | 'twitter' | 'email' | 'copy'`
**⚠️ Usado por:** `SharePaymentDataModal`, catálogo público

---

### `hooks/useFavicon.ts`
Aplica favicon e título da empresa dinamicamente buscando de `companyService`.
**⚠️ Chamado em:** `App.tsx` (raiz da aplicação)

### `hooks/usePageTitle.ts`
Gerencia o `<title>` da página com prefixo da empresa.
**⚠️ Usado por:** páginas admin e catálogo

### `hooks/useTabUrl.ts`
Sincroniza estado de aba ativa com a URL (query params).
**⚠️ Usado por:** páginas com múltiplas abas (ex: `ProductDetailPage`)

### `hooks/useSupabaseAuth.ts`
Wrapper mínimo sobre `SupabaseAuthContext`.
**⚠️ Usado por:** componentes que precisam do usuário autenticado

---

## 🗺️ ROTAS — Mapa Completo (`routes/index.tsx`)

### Providers (App.tsx)
```
HelmetProvider → SupabaseAuthProvider → ThemeProvider → RouterProvider
```

### Rotas Públicas
| Rota | Componente |
|------|-----------|
| `/` | `CatalogPage` (homepage pública) |
| `/admin/login` | `AdminLoginPage` |
| `/cliente/login` | `ClienteLoginPage` |
| `/login` | Redirect → `/admin/login` |

### Rotas Admin (requer `requireAdmin=true` + `AdminLayout`)
| Rota | Componente |
|------|-----------|
| `/admin` | `DashboardPage` |
| `/admin/products` | `ProductListPage` |
| `/admin/products/new` | `ProductFormPage` |
| `/admin/products/:id` | `ProductDetailPage` |
| `/admin/pdv` | `PDVPage` (sem AdminLayout) |
| `/admin/customers` | `CustomerListPage` |
| `/admin/customers/new` | `CustomerFormPage` |
| `/admin/customers/:id` | `CustomerProfilePage` |
| `/admin/team` | `TeamListPage` |
| `/admin/team/new` | `TeamFormPage` |
| `/admin/team/:id/edit` | `TeamEditPage` |
| `/admin/sales` | `SalesListPage` |
| `/admin/sales/:id` | `SaleDetailPage` |
| `/admin/inventory` | `InventoryPage` |
| `/admin/catalog-editor` | `CatalogEditorPage` |
| `/admin/catalog-config` | `CatalogConfigPage` |
| `/admin/governance` | `GovernancePage` |
| `/admin/settings/categories` | `CategoriesPage` |
| `/admin/settings/categories/:id/edit` | `EditCategoryPage` |
| `/admin/settings/fields` | `FieldsManagementPage` |
| `/admin/settings/brands` | `BrandsPage` |
| `/admin/settings/models` | `ModelsPage` |
| `/admin/settings/colors` | `ColorsPage` |
| `/admin/settings/versions` | `VersionsPage` |
| `/admin/settings/rams` | `RamsPage` |
| `/admin/settings/battery-healths` | `BatteryHealthsPage` |
| `/admin/settings/company` | `CompanyPage` |
| `/admin/settings/payment-fees` | `PaymentFeesPage` |
| `/admin/settings/permissions` | `PermissionsManagementPage` |
| `/admin/settings/shipping` | `ShippingPage` (Sistema de Frete — zonas, faixas, Melhor Envio) |
| `/admin/migration` | `MigrationPage` |

### Rotas Cliente (requer autenticação de cliente)
| Rota | Componente |
|------|-----------|
| `/cliente/perfil` | `CustomerProfilePage` |

---

## 🔄 FLUXOS DE NEGÓCIO CRÍTICOS

### Fluxo 1: Entrada de Produto (ProductForm)
```
1. Usuário escaneia EAN
2. useEANAutofill → modelEANsService.getByEAN(ean)
3. Se encontrado: preenche model_id, category_id, specs do template_values
4. Usuário preenche serial, IMEI1, IMEI2 (conforme CategoryConfig)
5. Submit → productSchema.safeParse(data)
6. Se serialList > 0: cria N produtos (um por serial)
7. Valida unicidade de seriais no banco antes de salvar
8. Gera SKU: MARCA-MODELO-COR-RAM-STORAGE
9. productService.create() → salva no banco
10. updateAveragePrices() → recalcula preço médio da variação
```

### Fluxo 2: Venda no PDV (PDVPage)
```
1. Selecionar cliente (CustomerSection → customerService)
2. Buscar produto (ProductSearchSection → searchProducts)
   - Busca por: nome, SKU, serial, IMEI1, IMEI2
3. Adicionar ao carrinho (handleAddToCart)
4. Selecionar entrega (DeliverySection)
5. Selecionar pagamento (PaymentSection → paymentFeesService)
   - Calcula taxa por método e parcelas
6. Finalizar venda (handleFinalizeSale)
   → saleService.createSale() → cria sale + sale_items + atualiza stock
   → warrantyDocumentService.create() → gera documento de garantia
7. Exibir recibo (ReceiptPreview)
```

### Fluxo 3: Catálogo Público (pages/catalog/index.tsx)
```
1. useCatalog() → catalogService.getProducts(filters + searchQuery + sortBy)
2. catalogConfigService.applyVisibilityRules() → filtra produtos
3. Agrupamento por model_id + color + ram + storage (productGrouping)
4. CatalogSectionComponent (seções fixas: Mais Recentes, Destaques etc.)
   ⚠️ Seções são OCULTADAS quando: searchQuery ≠ '' OU filters.categories.length > 0
   ⚠️ Seções usam suas próprias queries independentes — NÃO são filtradas pela searchQuery
5. ProductGroupGrid → exibe productGroups (resultado filtrado do passo 1)
6. CatalogFilters → botão inline com SearchBar; dropdown com: sortBy, chips de marca, slider de preço
```

---

## 🏗️ CONTEXTOS (React Context)

| Contexto | Arquivo | O que provê |
|---------|---------|------------|
| `SupabaseAuthContext` | `contexts/SupabaseAuthContext.tsx` | `user`, `session`, `signIn`, `signOut`, `isAdmin` |
| `ThemeContext` | `contexts/ThemeContext.tsx` | `theme`, `toggleTheme` (dark/light mode) |

**⚠️ `SupabaseAuthContext`** — único contexto de auth. Havia dois antes (causava race condition com AbortError em produção). Corrigido removendo o duplicado.

---

## 🔴 SERVICES LEGADOS — localStorage

> ⚠️ RAM e Storage foram migrados para Supabase. Apenas `versions.ts` e `field-dictionary.ts` ainda usam localStorage.

| Service | Chave localStorage | Status |
|---------|-------------------|---------|
| `services/versions.ts` | `antigravity_versions_v1` | ⚠️ LEGADO — migração pendente |
| `services/rams.ts` | `antigravity_rams_v1` | ✅ **SUBSTITUÍDO** — usar `rams-supabase.ts` |
| `services/storages.ts` | `antigravity_storages_v1` | ✅ **SUBSTITUÍDO** — usar `storages-supabase.ts` |
| `config/field-dictionary.ts` | `antigravity_field_dictionary_v1` | ⚠️ LEGADO — migração pendente |

---

### `utils/saleCalculations.ts` — Cálculos de Venda
**Todas as funções trabalham com centavos (inteiros)**

| Função | O que faz |
|--------|-----------|
| `calculateItemTotal(item)` | Total do item (0 se brinde) |
| `calculateItemSubtotal(item)` | Subtotal sem desconto |
| `calculateItemDiscount(item)` | Desconto do item (100% se brinde) |
| `calculateItemCost(item)` | Custo do item |
| `calculateSaleTotals(items)` | Retorna `{subtotal, discount_total, total, cost_total, profit}` |
| `calculatePaymentFee(amount, method, installments, fees)` | Retorna `{fee_percentage, fee_amount, total_with_fee}` |
| `calculateTotalPaid(payments)` | Soma total pago (usa `total_with_fee` se existir) |
| `calculateDeliveryDiscount(type, storeCost)` | Desconto de entrega para a loja |
| `calculateDeliveryTotal(type, customerCost)` | Custo de entrega para o cliente |
| `calculateChange(total, payments)` | Troco |
| `calculateRemaining(total, payments)` | Valor restante a pagar |
| `isPaymentComplete(total, payments)` | Pagamento completo? |
| `calculateProfitMargin(profit, total)` | Margem de lucro em % |
| `formatCurrency(centavos)` | Formata centavos para `R$ X,XX` |
| `getPaymentMethodLabel(method, installments?)` | Label em português |
| `getPaymentMethodIcon(method)` | Emoji do método |
| `getDeliveryTypeLabel(type)` | Label de entrega em português |

**⚠️ Usado por:** `PDVPage`, `saleService.ts`, `ReceiptPreview`, `PaymentSection`

---

### `utils/field-standards.ts` — Enums e Padrões
**Exporta:** `ProductStatus`, `ClientType`, constantes de formatação
**⚠️ Usado por:** `useProducts`, `ProductForm`, `ProductCard`, filtros

---

### `utils/calculateAveragePrice.ts`
**Exporta:** `calculateAllAveragePrices(totalStock, currentPrices, newQty, newPrices)`
Calcula média ponderada para todos os tipos de preço.
**⚠️ Usado por:** `averagePriceService.ts`

---

### `utils/pricing.ts`
Funções de cálculo de preços para exibição no catálogo (parcelamento, desconto).
**⚠️ Usado por:** `ModernProductCard`, `ProductDetailsModal`

---

### `utils/whatsappMessageGenerator.ts`
Gera mensagem de WhatsApp com detalhes do produto/pedido.
**⚠️ Usado por:** `ProductDetailsModal`, `CartSection`

---

### `utils/warrantyTagReplacement.ts`
Substitui tags `{{campo}}` no template de garantia com dados reais da venda.
**⚠️ Usado por:** `PDVPage` (geração do documento de garantia)

---

### `utils/product-name-generator.ts`
Gera nome automático do produto baseado em modelo + specs.
**⚠️ Usado por:** `ProductForm` (sugestão de nome)

---

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

### `components/catalog/CatalogFilters.tsx` ✅ NOVO
**Props:** `filters: FilterState`, `onFiltersChange: (f: FilterState) => void`, `filterStats: { brands, priceRange? }`

**Funcionalidades:**
- Painel colapsável via botão "Filtros" (badge com contagem de filtros ativos)
- **Chips de marca** — clique seleciona/deseleciona; múltiplas marcas suportadas
- **Slider duplo de preço** — dois handles min/max visuais sobre `input[type=range]` sobrepostos; aplica filtro no `onMouseUp`/`onTouchEnd`; valores calculados de `filterStats.priceRange`
- **Chips rápidos** de marcas ativas visíveis mesmo com painel fechado
- Botão "Limpar todos os filtros" (reseta `brands` e `priceRange`)

**⚠️ Usado por:** `pages/catalog/index.tsx`
**⚠️ Depende de:** `filterStats.priceRange` provido por `useCatalog` (via `catalogMetadataService.getPriceRange`)

---

### `services/catalogMetadataService.ts` ✅ DOCUMENTADO
**Exporta:** `catalogMetadataService` (objeto)
**Tabelas:** `categories`, `products`

| Função | O que faz |
|--------|-----------|
| `getCategoryNames(ids)` | Busca nomes de categorias por IDs |
| `getAllCategories()` | Todas as categorias com contagem de produtos |
| `getAllBrands()` | Marcas únicas com contagem (ordenadas por qtd) |
| `getPriceRange()` | Faixa de preços dos produtos (`{min, max}` em centavos) |

**⚠️ Usado por:** `useCatalog.ts` (carregado via import dinâmico)



## 📐 TYPES — Interfaces Principais

### `types/product.ts`
| Tipo | O que é |
|------|---------|
| `Product` | Produto completo (lido do banco). Todos os preços em **centavos** |
| `ProductInput` | Dados para criar/atualizar produto |
| `ProductOrigin` | Enum fiscal: `'0'`=Nacional, `'1'`=Importação direta, etc. |
| `WarrantyType` | `'brand' \| 'category' \| 'custom'` |
| `ProductDimensions` | `{width_cm, height_cm, depth_cm}` |

**Campos críticos de `Product`:**
- `specs: Record<string, any>` — JSONB flexível: `{serial, imei1, imei2, color, ram, storage, version, battery_health}`
- `price_*` — sempre **inteiros em centavos**
- `images: string[]` — fotos individuais do produto (usado/seminovo)
- `eans: string[]` — array de EANs
- `track_inventory` + `stock_quantity` — controle de estoque
- `is_gift` — brinde (desconto 100% automático no PDV)

---

### `types/catalog.ts`
| Tipo | O que é |
|------|---------|
| `CatalogProduct` | Estende `Product` com campos de catálogo: `featured`, `is_new`, `is_favorite`, `category_slug` |
| `ProductGroup` | Agrupamento por Brand+Model com `variants[]` e `globalPriceRange` |
| `ProductVariant` | Combinação RAM+Storage com `colors[]` e `products[]` |
| `FilterState` | Estado dos filtros: `categories[]`, `brands[]`, `priceRange`, `storage[]`, `ram[]`, `colors[]` |
| `InstallmentPlan` | Plano de parcelamento: `{installments, value, total, label}` (centavos) |
| `QuoteRequest` | Cotação completa para WhatsApp: `{product, variant, installmentPlan, delivery}` |
| `Banner` | Banner do catálogo com `link_type`, `display_order`, contadores de cliques/views |

---

### `types/sale.ts`
| Tipo | O que é |
|------|---------|
| `PaymentMethodType` | `'money' \| 'credit' \| 'debit' \| 'pix'` |
| `PaymentMethod` | `{method, amount, installments?, fee_percentage?, fee_amount?, total_with_fee}` |
| `DeliveryType` | `'store_pickup' \| 'store_delivery' \| 'hybrid_delivery'` |
| `SaleItem` | Item do carrinho: `{product_id, quantity, unit_price, unit_cost, discount, total, is_gift}` |
| `Sale` | Venda completa com `payment_methods[]`, `delivery_*`, `promotional_discount` |
| `SaleInput` | Input para criar venda (sem `id`, `status`, `created_at`) |
| `SaleWithItems` | `Sale` + `items[]` + `customer?` + `seller?` |
| `SaleSummary` | Relatório: `{total_sales, total_revenue, total_profit, average_ticket, profit_margin}` |

**⚠️ `customer_id` é OBRIGATÓRIO em `Sale`** — PDV exige cliente selecionado

---

### `types/category.ts`
| Tipo | O que é |
|------|---------|
| `FieldRequirement` | `'off' \| 'optional' \| 'required'` — padrão semáforo |
| `CustomFieldType` | Tipos de campo: `text`, `number`, `dropdown`, `ean13`, `phone`, `cpf`, `cnpj`, `table_relation`, etc. |
| `CustomField` | Campo dinâmico: `{id, name, key, type, requirement, options?, table_config?}` |
| `CategoryConfig` | Config de campos da categoria: `imei1?`, `imei2?`, `serial?`, `color?`, `ram?`, `storage?`, `custom_fields?` |
| `Category` | Categoria com `config: CategoryConfig` e `warranty_days` |

**`CategoryConfig` controla:**
- Quais campos aparecem no `ProductForm` (off/optional/required)
- Auto-fill por EAN (`ean_autofill_config`)
- Geração automática de nome (`auto_name_template`)
- Campos únicos por produto (`unique_fields`)

---

### Outros types relevantes
| Arquivo | Tipos exportados |
|---------|-----------------|
| `types/model-architecture.ts` | `ModelEAN`, `ModelVariant`, `ModelVariantImage`, `EANSearchResult` |
| `types/inventory.ts` | `StockMovement`, `StockAdjustmentInput`, `InventoryStats`, `InventoryGroup` |
| `types/customer.ts` | `Customer`, `CustomerInput`, `CustomerFilters` |
| `types/warranty.ts` | `WarrantyTemplate`, `WarrantyTemplateInput` |
| `types/warrantyDocument.ts` | `WarrantyDocument`, `WarrantyDocumentInput` |
| `types/team.ts` | `TeamMember`, `TeamMemberInput` |
| `types/company.ts` | `Company` (dados completos: CNPJ, endereço, PIX, redes sociais) |
| `types/companySettings.ts` | `CompanySettings` (config de recibo: header, footer, largura) |
| `types/catalogSettings.ts` | `CatalogSettings`, `CategoryDisplayConfig`, `DEFAULT_CATALOG_SETTINGS` |
| `types/catalogSections.ts` | `CatalogSection`, `SectionType`, `CreateSectionData` |
| `types/payment-fees.ts` | `PaymentFee` |
| `types/unit.ts` | `Unit`, `UnitInput` |
| `types/bulk-product.ts` | `BulkProductRow`, `BulkProductValidation`, `BulkProductPreview`, `BulkUploadResult` |

---

## 📋 SCHEMAS — Validação Zod

### `schemas/product.ts`
**Exporta:** `productSchema`, `ProductSchemaType`, `validateProduct(data)`
**Usado por:** `ProductForm.tsx` (ao submeter)

**Validações críticas:**
- `name`: mínimo 3 caracteres
- `price_retail >= price_reseller >= price_wholesale` (refinements)
- `stock_quantity` obrigatório se `track_inventory = true`
- Preços: `z.coerce.number()` (aceita string e número)
- Campos logísticos: aceita `NaN`, `null`, `undefined` → transforma em `undefined`
- `meta_title`: máx 60 chars; `meta_description`: máx 160 chars

### `schemas/unit.ts`
**Exporta:** `unitSchema`, `UnitSchemaType`
**Usado por:** `UnitForm.tsx`

---

## ⚙️ CONFIG — Configurações do Sistema

### `config/field-dictionary.ts`
**Exporta:** `FIELD_DICTIONARY`, `getFieldDefinition(key)`, `applyFieldFormat(value, format)`, funções de runtime

**O que é:** Dicionário centralizado de todos os campos de formulário com labels, placeholders e regras de formatação.

**`FieldFormat`:** `'capitalize' | 'uppercase' | 'lowercase' | 'titlecase' | 'sentence' | 'slug' | 'alphanumeric' | 'numeric' | 'phone' | 'cpf' | 'cnpj' | 'cep' | 'date_br' | 'ncm' | 'ean13' | 'brl' | 'none'`

**Funções de runtime (localStorage):**
| Função | O que faz |
|--------|-----------|
| `getRuntimeFieldDictionary()` | Dicionário atual (localStorage ou padrão) |
| `getFieldDefinitionRuntime(key)` | Definição de um campo |
| `updateFieldFormat(key, format)` | Atualiza formato em runtime |
| `resetFieldDictionary()` | Restaura padrões |
| `createCustomField(key, def)` | Cria campo customizado |
| `deleteCustomField(key)` | Remove campo customizado |

**⚠️ Usado por:** `SmartInput` (componente base de todos os inputs)
**⚠️ Runtime usa localStorage** — mesma armadilha de `versions.ts`

---

### `config/category-badges.ts`
Mapeamento de categorias para badges visuais no catálogo (ícones, cores, labels).
**⚠️ Usado por:** `CatalogSection`, `ProductCard` (catálogo público)

### `config/product-fields.ts`
Configuração de campos visíveis por categoria no `ProductForm`.
**⚠️ Usado por:** `ProductSpecifications` (seção do ProductForm)

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

### `categories`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome da categoria |
| `slug` | TEXT | URL-friendly, gerado automaticamente |
| `config` | JSONB | `CategoryConfig` — campos obrigatórios/opcionais/ocultos |
| `warranty_days` | INTEGER | Prazo de garantia padrão em dias |
| `sort_order` | INTEGER | Ordem de exibição |

### `models`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome do modelo |
| `brand_id` | UUID | FK brands |
| `category_id` | UUID | FK categories |
| `template_values` | JSONB | Specs padrão para autofill (ram, storage, etc.) |
| `is_active` | BOOLEAN | Modelo ativo? |

### `model_eans`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `model_id` | UUID | FK models |
| `ean` | TEXT | Código EAN-13 |
| `is_primary` | BOOLEAN | EAN principal do modelo |
| `region` | TEXT | Região (Global, Brasil, etc.) |

**⚠️ UNIQUE:** `(ean)` — EAN não pode pertencer a dois modelos

### `customers`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome do cliente |
| `cpf_cnpj` | TEXT | CPF ou CNPJ |
| `email` | TEXT | E-mail |
| `phone` | TEXT | Telefone |
| `is_active` | BOOLEAN | Cliente ativo? |
| `client_type` | TEXT | `varejo`, `revenda`, `atacado` |

### `custom_fields`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `key` | TEXT | Chave interna (ex: `limite_credito`) |
| `label` | TEXT | Label de exibição |
| `category` | TEXT | `basic`, `spec`, `price`, `fiscal`, `logistics` |
| `field_type` | TEXT | Tipo do campo (text, number, dropdown, etc.) |
| `options` | TEXT[] | Opções para dropdown |
| `is_system` | BOOLEAN | Campo do sistema (não pode ser deletado) |
| `display_order` | INTEGER | Ordem de exibição |

---

## 📦 SERVICES ADICIONAIS

### `services/custom-fields.ts` — Campos Customizados (Biblioteca Global)
**Exporta:** `customFieldsService` (instância de classe)
**Tabela:** `custom_fields`
**Cache:** 5 minutos em memória

| Função | O que faz |
|--------|-----------|
| `list()` | Lista todos os campos da empresa |
| `getByCategory(category)` | Campos por categoria (`basic`, `spec`, `price`, `fiscal`, `logistics`) |
| `getById(id)` | Campo por ID |
| `getByKey(key)` | Campo por chave |
| `create(input)` | Cria campo (valida chave única) |
| `update(id, input)` | Atualiza campo (campos `is_system` só permitem atualizar `label`, `placeholder`, `options`, `display_order`) |
| `delete(id)` | Remove campo (campos `is_system` não podem ser deletados) |
| `reorder(fieldIds)` | Reordena campos |

**⚠️ Campos `is_system`** — criados pelo sistema, não podem ser deletados nem ter `key`/`field_type`/`category` alterados
**⚠️ Usado por:** `useEnrichedCustomFields`, `FieldsManagementPage`, `CategoryEditPage`

---

### `services/storages.ts` — Capacidades de Armazenamento ✅ SUBSTITUÍDO
**Exporta:** `storageService`
**Persistência:** `localStorage` (chave: `antigravity_storages_v1`) — **NÃO usa Supabase**

**⚠️ OBSOLETO** — `CapacitySelect` agora importa de `storages-supabase.ts`. Este arquivo não deve ser usado por novos componentes.
**⚠️ Use `storages-supabase.ts`** para qualquer acesso a capacidades de storage.

---

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
| 2026-02-18 | RLS habilitado em 37 tabelas + 21 funções com `SECURITY DEFINER + SET search_path` | Migrations Supabase |
| 2026-02-18 | RAM e Storage migrados para Supabase | `rams-supabase.ts`, `storages-supabase.ts`, `RamSelect.tsx`, `CapacitySelect.tsx` |
| 2026-02-18 | Battery Health migrado para Supabase | `batteryHealths-supabase.ts`, `BatteryHealthSelect.tsx` |
| 2026-02-18 | Leaked Password Protection habilitada no Supabase Auth |  Auth Settings |

---

## ✅ Checklist Antes de Modificar

1. Qual arquivo vou modificar?
2. Quem usa esse arquivo? (ver tabelas acima)
3. A mudança afeta alguma Zona de Risco?
4. Preciso atualizar mais de um arquivo?
5. A mudança afeta o banco de dados?
6. **Atualizar este CODEBASE.md** na seção "Histórico de Mudanças"

---

## 🎛️ COMPONENTES UI BASE (`components/ui/`)

> Estes componentes são a base de todos os formulários. **Nunca substituir por inputs HTML diretos.**

### `SmartInput` — Input Inteligente com Formatação Automática
```tsx
<SmartInput control={control} name="nome_do_campo" />
```
**Props:** `control` (React Hook Form), `name` (chave do `FIELD_DICTIONARY`), `className?`, `disabled?`

**Como funciona:**
1. Busca definição do campo em `getFieldDefinitionRuntime(name)`
2. Aplica `applyFieldFormat(value, fieldDef.format)` a cada keystroke
3. Preserva posição do cursor após formatação
4. Exibe label, placeholder, contador de caracteres e erro automaticamente

**⚠️ Se o campo não existir no `FIELD_DICTIONARY`** → retorna `null` e loga warning
**⚠️ Integra com React Hook Form via `Controller`** — não usar com `useState` direto

---

### `CurrencyInput` — Input de Moeda (Centavos)
```tsx
<CurrencyInput value={priceInCents} onChange={setPriceInCents} label="Preço Varejo" />
```
**Props:** `value` (inteiro em centavos), `onChange(cents)`, `onValueChange(cents)` (alias), `label?`, `disabled?`, `error?`

**Regras críticas:**
- **NUNCA usar `type="number"` para dinheiro** — usa `type="text"` internamente
- Aceita vírgula e ponto como separador decimal
- Converte automaticamente: `"10,50"` → `1050` (centavos)
- Exibe `R$` como prefixo fixo
- Seleciona todo o conteúdo ao focar (`e.target.select()`)

---

### `EANInput` — Input de Código de Barras (Array)
```tsx
<EANInput value={eans} onChange={setEans} onSearch={handleEANSearch} maxEANs={5} />
```
**Props:** `value: string[]`, `onChange(string[])`, `onSearch?(ean)`, `label?`, `maxEANs?` (padrão: 5)

**Comportamento:**
- Aceita apenas dígitos (remove não-numéricos)
- Limita a 13 dígitos por EAN
- **Dispara `onSearch(ean)` automaticamente quando atinge 13 dígitos** — usado para autofill do ProductForm
- Feedback visual: verde (13 dígitos), laranja (incompleto)
- Permite adicionar/remover múltiplos EANs

---

### `IMEIInput` — Input de IMEI
```tsx
<IMEIInput value={imei} onChange={setImei} label="IMEI 1" required id="imei1" />
```
**Props:** `value: string`, `onChange(string)`, `label?`, `required?`, `error?`, `onKeyDown?`, `onBlur?`, `id?`, `technicalName?`

**Comportamento:**
- Aceita apenas dígitos, limita a 15
- Auto-uppercase e trim
- Feedback visual: verde (15 dígitos), laranja (incompleto)
- `technicalName` exibe o nome técnico do campo em cinza ao lado do label

---

### `ImageUploader` — Upload de Imagens
```tsx
<ImageUploader onUpload={handleUpload} maxFiles={5} />
```
**⚠️ Usado por:** `ProductImages` (seção do ProductForm)

### `Tab` / `Tabs` — Navegação por Abas
```tsx
<Tabs activeTab={tab} onChange={setTab}>
  <Tab id="info" label="Informações" />
</Tabs>
```
**⚠️ Usado por:** `ProductDetailPage`, `CustomerProfilePage`

---

## ⚖️ REGRAS DE NEGÓCIO (`core/rules.ts`)

### `isPaymentMethodAllowed(clientType, method): boolean`
**Regra Atacado:** clientes `ATACADO` só podem pagar com `PIX` ou `DINHEIRO`.
```ts
isPaymentMethodAllowed(ClientTypes.ATACADO, PaymentMethods.CREDIT_CARD) // false
isPaymentMethodAllowed(ClientTypes.VAREJO, PaymentMethods.CREDIT_CARD)  // true
```
**⚠️ Usado por:** `PaymentSection` (PDV)

### `formatIMEI(imei): string`
Padroniza IMEI: `trim()` + `toUpperCase()`

### `isValidSystemPassword(password): boolean`
Senha do sistema deve ter **exatamente 5 dígitos numéricos**.

---

## 🔢 ENUMS — `utils/field-standards.ts`

> **Fonte de verdade para todos os enums.** Nunca usar strings mágicas.

| Enum | Valores |
|------|---------|
| `ClientTypes` | `VAREJO='varejo'`, `REVENDA='revenda'`, `ATACADO='atacado'`, `ADMIN='admin'` |
| `ProductStatus` | `ACTIVE='active'`, `INACTIVE='inactive'`, `OUT_OF_STOCK='out_of_stock'`, `DISCONTINUED='discontinued'` |
| `PaymentMethods` | `PIX='pix'`, `CASH='dinheiro'`, `CREDIT_CARD='cartao_credito'`, `DEBIT_CARD='cartao_debito'`, `BANK_SLIP='boleto'` |
| `ShippingTypes` | `STANDARD='standard'`, `EXPRESS='express'`, `PICKUP='retirada'`, `LOCAL_COURIER='moto_boy'` |
| `UnitStatus` | `AVAILABLE='available'`, `RESERVED='reserved'`, `SOLD='sold'`, `RMA='rma'` |
| `ProductCondition` | `NEW='new'`, `USED='used'`, `OPEN_BOX='open_box'` |
| `ProductCategory` | `PHONES='phones'`, `TABLETS='tablets'`, `ACCESSORIES='accessories'` |

**Constantes:**
- `CURRENCY_PRECISION = 2` — precisão monetária (centavos)
- `IMEI_MAX_LENGTH = 15` — comprimento máximo do IMEI

---

## 🏗️ LAYOUT — `AdminLayout`

**Arquivo:** `layouts/AdminLayout.tsx`
**Props:** `{ children: React.ReactNode }`

**O que injeta:**
- Sidebar esquerda fixa (w-64) com navegação completa
- `usePageTitle()` — atualiza `<title>` automaticamente por rota
- `useSupabaseAuth()` — exibe nome/email do usuário logado
- `useTheme()` — aplica `settings.company_name` no header da sidebar
- Banner amarelo de topo se `VITE_DEV_MODE=true`

**Itens de navegação (sidebar):**
Dashboard, Produtos, Vendas, Estoque, Clientes, Equipe, PDV, Migração
**Configuração:** Categorias, Campos, Marcas, Modelos, Cores, Armazenamento, RAM, Versões, Saúde Bateria, Taxas, Dados da Empresa, Documentos, Garantias, Banners, Config. Catálogo
**Admin only:** Permissões (visível apenas se `customer_type === 'ADMIN'`)
**Dev:** Governança, Diário de Dev, Teste de Abas, Ajustes Sistema

**⚠️ `PDVPage` NÃO usa `AdminLayout`** — tela cheia sem sidebar

---

## 🌍 VARIÁVEIS DE AMBIENTE

O projeto usa Vite. Variáveis devem ter prefixo `VITE_` para serem acessíveis no frontend.

| Variável | Onde é usada | Descrição |
|---------|-------------|-----------|
| `VITE_SUPABASE_URL` | `services/supabase.ts` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `services/supabase.ts` | Chave anônima do Supabase |
| `VITE_DEV_MODE` | `AdminLayout.tsx` | Se `'true'`, exibe banner de dev e ativa mock de auth |

**Arquivo:** `.env.local` (não commitado) ou `.env` (commitado sem secrets)

**⚠️ Sem `.env.local`** → app não conecta ao Supabase e fica em branco
**⚠️ `VITE_DEV_MODE=true`** → ativa autenticação mock — nunca usar em produção

---

## 🔐 AUTENTICAÇÃO — Fluxo Supabase

```
1. App monta → SupabaseAuthProvider inicializa
2. supabase.auth.getSession() → verifica sessão existente
3. supabase.auth.onAuthStateChange() → listener de mudanças
4. Se autenticado: busca customer por email → define customer_type
5. ProtectedRoute verifica: user existe? isAdmin? → redireciona se não
6. signOut() → supabase.auth.signOut() → limpa sessão
```

**`ProtectedRoute`** — wrapper de rota que verifica autenticação:
- `requireAdmin={true}` → redireciona para `/admin/login` se não autenticado
- Sem `requireAdmin` → redireciona para `/cliente/login` se não autenticado

**⚠️ Race condition histórica:** havia dois contextos de auth simultâneos causando `AbortError` em produção. Corrigido removendo o contexto duplicado — manter apenas `SupabaseAuthContext`.

---

## 🧩 SELECTORS — Dropdowns de Produto (`components/products/selectors/`)

| Componente | Service usado | O que lista |
|-----------|--------------|------------|
| `BrandSelect` | `brandService.list()` de `brands.ts` | Marcas |
| `ModelSelect` | `modelService.list()` de `models-new.ts` | Modelos (filtrado por marca) |
| `ColorSelect` | `colorService.list()` de `colors.ts` | Cores |
| `CapacitySelect` | `storageService.list()` de `storages-supabase.ts` ✅ | Capacidades de armazenamento |
| `RamSelect` | `ramService.list()` de `rams-supabase.ts` ✅ | Capacidades de RAM |
| `VersionSelect` | `versionService.list()` de `versions.ts` ⚠️ localStorage | Versões |
| `CategorySelect` | `categoryService.list()` de `categories.ts` | Categorias |
| `BatteryHealthSelect` | `batteryHealthService.list()` de `batteryHealths-supabase.ts` ✅ | Saúde da bateria |

**⚠️ Apenas `VersionSelect` usa localStorage** — demais selectors usam Supabase
**⚠️ Todos os selectors são usados em `ProductSpecifications` e/ou `ProductBasicInfo`**

---

## 🪟 MODAIS DE CONFIGURAÇÃO (`components/settings/`)

### Padrão de Modal (todos seguem este padrão)
```tsx
interface XxxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    item?: Xxx | null; // null = criar, Xxx = editar
}
```
- `isOpen=false` → retorna `null` (não renderiza)
- `useEffect([item, isOpen])` → reseta formulário ao abrir
- `handleSave()` → valida → chama `service.create()` ou `service.update()` → `onSave()` → `onClose()`

### `BrandModal`
**Campos:** `name` (obrigatório, mín. 2 chars), `warranty_days` (padrão: 90), `active`
**Service:** `brandService.create()` / `brandService.update()`
**⚠️ Campo `active` existe no modal mas `brands.ts` sempre retorna `active=true` (débito #3)**

### `ModelModal` — O mais complexo
**Abas:** `basic` (nome, marca, categoria, EANs) + `template` (valores padrão por campo)
**Sub-componente:** `TemplateFieldInput` — renderiza input adequado por tipo de campo (`text`, `number`, `dropdown`, `brl`, `table_relation`)
**Fluxo:**
1. Ao selecionar categoria → `loadCategoryConfig()` → busca campos da categoria
2. Aba Template → preenche `template_values` (JSONB) com valores padrão
3. Ao escanear EAN no ProductForm → `template_values` é aplicado automaticamente
**⚠️ `template_values` é salvo como JSONB na tabela `models`**
**⚠️ Inclui `ColorImageManager`** — gerencia fotos por cor do modelo

### `ColorModal`
**Campos:** `name`, `hex` (cor hexadecimal), `active`
**⚠️ Histórico:** tinha memory leak de `setTimeout` sem cleanup — corrigido

---

## 🎨 THEMECONTEXT — Detalhado

**Arquivo:** `contexts/ThemeContext.tsx`
**Hook:** `useTheme()` → `{ settings, isLoading }`

**`ThemeSettings`:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `company_name` | string | Nome da empresa (padrão: `'Mercado do Vale'`) |
| `theme_colors` | `Record<string, string>` | Cores CSS (padrão: `{primary: '#3b82f6', secondary: '#1e293b'}`) |
| `logo_main` | string? | URL do logo principal (favicon + header) |
| `logo_dark` | string? | URL do logo para modo escuro |

**Comportamento:**
- Inicia com valores padrão **imediatamente** (sem bloqueio de render)
- Busca `company_settings` em background (sem `isLoading=true`)
- Injeta CSS variables em `:root`: `--primary`, `--secondary`, etc.
- Aplica `<title>` e `<link rel="icon">` via `react-helmet-async`

**⚠️ Tabela:** `company_settings` (mesma que `companyService` e `companySettingsService`)
**⚠️ Campos lidos:** `company_name`, `theme_colors`, `logo_main`, `logo_dark`

---

## 🏭 `services/models.ts` — Detalhado

**Exporta:** `modelService`
**Tabela:** `models`
**⚠️ `TEMP_COMPANY_ID = 'mercado-do-vale'`** — company_id obtido via slug hardcoded (não usa auth)

| Função | O que faz |
|--------|-----------|
| `list()` | Lista todos os modelos da empresa |
| `getById(id)` | Modelo por ID |
| `listByBrand(brandId)` | Modelos filtrados por marca |
| `listActive()` | Alias para `list()` (todos são considerados ativos) |
| `listActiveByBrand(brandId)` | Alias para `listByBrand()` |
| `create(input)` | Cria modelo com `template_values`, `category_id`, `eans` |
| `update(id, input)` | Atualiza modelo (inclui `template_values`) |
| `delete(id)` | Remove modelo |

**Campos mapeados do banco:**
- `template_values` (JSONB) → valores padrão para autofill no ProductForm
- `category_id` → categoria padrão do modelo
- `eans` → EANs do modelo (legado, substituído por `model_eans`)

**⚠️ Diferença de `models-new.ts`:** `models.ts` é o service atual usado em produção. `models-new.ts` pode ser uma versão experimental — verificar antes de usar.

---

## 📝 GERADOR DE NOMES — `utils/product-name-generator.ts`

**Exporta:** `generateProductName`, `generatePreviewName`, `getAvailableFieldsForNaming`, `getSeparatorOptions`, `getTemplatePresets`

### `generateProductName(config, productData): string`
Gera nome do produto baseado na `CategoryConfig`.

**Dois modos:**
1. **Template** (novo): `config.auto_name_template = "{modelo}, {ram}/{armazenamento} - {versao}"`
2. **Campos** (legado): `config.auto_name_fields = ['model', 'ram', 'storage']` + `auto_name_separator`

**Placeholders do template:**
| Placeholder | Campo |
|------------|-------|
| `{marca}` | `brand` |
| `{modelo}` | `model` |
| `{ram}` | `specs.ram` |
| `{armazenamento}` | `specs.storage` |
| `{cor}` | `specs.color` |
| `{versao}` | `specs.version` |
| `{bateria}` | `specs.battery_health` |
| `{serial}` | `specs.serial` |
| `{imei1}` | `specs.imei1` |

**Limpeza automática:** remove vírgulas duplas, parênteses vazios, hífens duplicados quando campos estão vazios.

**⚠️ Usado por:** `ProductForm` (gera nome automaticamente ao preencher campos)

---

## 🔒 FLUXO DE GARANTIA

### Fluxo completo
```
1. Venda finalizada → saleService.createSale()
2. warrantyDocumentService.create(saleId, items)
3. Para cada item: busca WarrantyTemplate da categoria/marca
4. replaceWarrantyTags(template.content, data) → substitui {{tags}}
5. Documento salvo na tabela warranty_documents
6. Admin pode imprimir/baixar PDF via WarrantyDocumentPage
```

### Tags disponíveis (`{{tag_name}}`)
| Tag | Valor |
|-----|-------|
| `{{cliente_nome}}` | Nome do cliente |
| `{{cliente_cpf}}` | CPF/CNPJ formatado |
| `{{produto_nome}}` | Nome do produto |
| `{{produto_serial}}` | Serial do produto |
| `{{produto_imei1}}` | IMEI 1 |
| `{{produto_imei2}}` | IMEI 2 |
| `{{garantia_dias}}` | Prazo em dias |
| `{{data_venda}}` | Data da venda (DD/MM/YYYY) |
| `{{data_expiracao}}` | Data de expiração da garantia |
| `{{empresa_nome}}` | Nome da empresa |
| `{{empresa_telefone}}` | Telefone formatado |
| `{{declaracao}}` | Texto de declaração (retirada vs entrega) |

**⚠️ Funções de formatação:** `formatWarrantyDate`, `formatWarrantyPhone`, `formatWarrantyCpfCnpj`

---

## 📦 DEPENDÊNCIAS EXTERNAS

| Lib | Versão | Para que serve |
|-----|--------|---------------|
| `@supabase/supabase-js` | ^2.93.3 | Banco de dados, auth, storage |
| `react-hook-form` | ^7.71.1 | Formulários (ProductForm, etc.) |
| `@hookform/resolvers` | ^5.2.2 | Integração react-hook-form + Zod |
| `zod` | ^3.25.76 | Validação de schemas |
| `react-router-dom` | ^6.22.0 | Roteamento SPA |
| `react-helmet-async` | ^2.0.4 | SEO: `<title>`, `<meta>`, favicon |
| `sonner` | ^2.0.7 | Toast notifications (substituiu react-hot-toast) |
| `react-hot-toast` | ^2.6.0 | Toast legacy (ainda presente) |
| `lucide-react` | ^0.344.0 | Ícones |
| `react-icons` | ^5.5.0 | Ícones adicionais |
| `jspdf` + `jspdf-autotable` | ^4.1.0 | Geração de PDF (catálogo, garantia) |
| `xlsx` | ^0.18.5 | Exportação/importação Excel (bulk products) |
| `browser-image-compression` | ^2.0.2 | Compressão de imagens antes do upload |
| `react-dropzone` | ^14.4.0 | Upload de imagens via drag-and-drop |
| `qrcode.react` | ^4.2.0 | Geração de QR Code |
| `zustand` | ^4.5.0 | State management (usado em alguns lugares) |
| `clsx` + `tailwind-merge` | ^2.1.0 / ^2.2.1 | Utilitário de classes CSS (`cn()`) |
| `@google/generative-ai` | ^0.24.1 | Gemini AI (geração de SEO, descrições) |
| `tailwindcss` | ^3.4.1 | CSS utility-first |
| `vite` | ^5.1.0 | Build tool / dev server |
| `typescript` | ^5.3.3 | Tipagem estática |

**⚠️ `sonner` e `react-hot-toast` coexistem** — preferir `sonner` em novos componentes
**⚠️ `zustand`** — verificar onde está sendo usado antes de remover

---

## 🐛 ERROS CONHECIDOS E SOLUÇÕES

| Erro | Causa | Solução |
|------|-------|---------|
| `AbortError` em produção | Dois contextos de auth chamando `getSession()` simultaneamente | Removido contexto duplicado — manter apenas `SupabaseAuthContext` |
| Query retorna vazio sem erro | RLS ativo sem `company_id` no filtro | Sempre filtrar por `company_id` obtido via `companies.slug` |
| `NaN` em campos logísticos | `z.number()` não aceita string vazia | Usar `z.union([z.number(), z.nan(), z.null(), z.undefined()])` |
| Preço zerado ao salvar | `type="number"` com vírgula | Usar `CurrencyInput` — nunca `input type="number"` para dinheiro |
| `model_color_images` retorna vazio | Falta `company_id` no filtro | Buscar `company_id` via `companies.eq('slug', 'mercado-do-vale')` |
| Memory leak em modais | `setTimeout` sem cleanup em `useEffect` | Usar `clearTimeout` no return do `useEffect` |
| `Cannot read properties of undefined (reading 'showCash')` | Item antigo no carrinho sem campo `paymentOptions` | Adicionar fallback: `item.paymentOptions?.showCash ?? true` |
| Categorias sumindo do catálogo | Filtro de estoque removendo categorias com produtos zerados | Buscar categorias independente do estoque |

---

## 🧱 PADRÕES DE CÓDIGO

### Como criar um novo Service (Supabase)
```ts
import { supabase } from './supabase';

// 1. Obter company_id (padrão do projeto)
async function getCompanyId(): Promise<string> {
    const { data } = await supabase
        .from('companies').select('id')
        .eq('slug', 'mercado-do-vale').single();
    return data.id;
}

// 2. Sempre filtrar por company_id
export const meuService = {
    async list() {
        const companyId = await getCompanyId();
        const { data, error } = await supabase
            .from('minha_tabela')
            .select('*')
            .eq('company_id', companyId);
        if (error) throw new Error(error.message);
        return data || [];
    }
};
```

### Como adicionar um campo ao ProductForm
1. Adicionar campo ao `types/product.ts` (`Product` e `ProductInput`)
2. Adicionar validação ao `schemas/product.ts`
3. Adicionar ao `FIELD_DICTIONARY` em `config/field-dictionary.ts` (se for SmartInput)
4. Adicionar ao componente adequado (`ProductBasicInfo`, `ProductSpecifications`, `ProductPricing`)
5. Verificar se `CategoryConfig` deve controlar visibilidade do campo
6. Atualizar `CODEBASE.md` → seção "Histórico de Mudanças"

### Como adicionar uma nova rota
1. Criar página em `pages/admin/` ou `pages/customer/`
2. Adicionar rota em `routes/index.tsx` com `ProtectedRoute`
3. Adicionar item de navegação em `layouts/AdminLayout.tsx`
4. Atualizar `CODEBASE.md`

### Como criar um novo Modal de configuração
Seguir o padrão de `BrandModal`:
1. Props: `{ isOpen, onClose, onSave, item? }`
2. `useEffect([item, isOpen])` para resetar estado
3. `handleSave()` com validação + try/catch + `setSaving(true/false)`
4. Retornar `null` se `!isOpen`

---

## 🎨 `services/colors.ts` — Detalhado

**Exporta:** `colorService`, `COLOR_MAP`
**Tabela:** `colors`
**⚠️ `TEMP_COMPANY_ID = 'mercado-do-vale'`** — mesmo padrão de `models.ts`

| Função | O que faz |
|--------|-----------|
| `list()` | Lista todas as cores da empresa |
| `listActive()` | Apenas cores com `active=true` |
| `getById(id)` | Cor por ID |
| `create(input)` | Cria cor — auto-detecta `hex_code` do `COLOR_MAP` se não fornecido |
| `update(id, input)` | Atualiza cor |
| `delete(id)` | Remove cor |
| `getColorHex(name)` | Retorna hex do `COLOR_MAP` (síncrono, apenas fallback) |

**`COLOR_MAP`** — mapeamento nome→hex para preview visual:
```ts
{ 'Preto': '#000000', 'Branco': '#FFFFFF', 'Azul': '#3B82F6',
  'Verde': '#10B981', 'Vermelho': '#EF4444', 'Rosa': '#EC4899',
  'Dourado': '#F59E0B', 'Prata': '#9CA3AF', 'Cinza': '#6B7280',
  'Roxo': '#8B5CF6', 'Amarelo': '#EAB308', 'Laranja': '#F97316' }
```

**⚠️ `getColorHex` é síncrono** — não consulta o banco, usa apenas `COLOR_MAP`
**⚠️ Ao criar cor:** se `hex_code` não fornecido → busca no `COLOR_MAP` → fallback `'#000000'`

### `ColorModal` — Detalhado
**Campos:** `name` (formatação titlecase via `field-dictionary`), `hex_code` (color picker), `active`
**`selectKnownColor(name)`** — ao clicar em cor conhecida: preenche nome E hex automaticamente
**Preservação de cursor:** usa `useRef` para manter posição ao formatar o nome

---

## 🛒 `PDVPage` — Estado Interno

**Arquivo:** `pages/pdv/PDVPage.tsx`
**Sem `AdminLayout`** — tela cheia, sem sidebar

### Estado principal
```ts
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
const [cartItems, setCartItems] = useState<SaleItem[]>([]);
const [payments, setPayments] = useState<PaymentMethod[]>([]);
const [deliveryType, setDeliveryType] = useState<DeliveryType | undefined>();
const [deliveryPersonId, setDeliveryPersonId] = useState<string | undefined>();
const [deliveryCostStore, setDeliveryCostStore] = useState(0);
const [deliveryCostCustomer, setDeliveryCostCustomer] = useState(0);
const [paymentFees, setPaymentFees] = useState<PaymentFee[]>([]);
const [showReceipt, setShowReceipt] = useState(false);
const [lastSale, setLastSale] = useState<any>(null);
```

### Handlers principais
| Handler | O que faz |
|---------|-----------|
| `handleAddToCart(product, qty)` | Adiciona produto — se já existe, incrementa quantidade |
| `handleUpdateQuantity(itemId, qty)` | Atualiza quantidade de item |
| `handleRemoveItem(itemId)` | Remove item do carrinho |
| `handleClearCart()` | Limpa carrinho + pagamentos + entrega |
| `handleAddPayment(payment)` | Adiciona método de pagamento |
| `handleRemovePayment(index)` | Remove método de pagamento |
| `handleDeliveryChange(type, personId, costStore, costCustomer)` | Atualiza entrega |
| `handleSelectInstallment(installments, amount, feeAmount)` | Seleciona parcela com taxa |
| `handleFinalizeSale()` | Finaliza venda → cria sale + items → gera garantia |
| `generateWarrantyTerm(sale, customer, items)` | Prepara dados do termo de garantia |
| `handleWarrantyDeliveryTypeChange(type)` | Atualiza tipo de entrega no termo |
| `handleGenerateWarranty(signature)` | Salva termo com assinatura digital |

**⚠️ `handleFinalizeSale`** — fluxo crítico:
1. Valida: cliente selecionado? carrinho não vazio? pagamento completo?
2. `saleService.createSale()` → cria venda no banco
3. `generateWarrantyTerm()` → prepara dados do termo
4. `setShowReceipt(true)` → exibe recibo
5. Limpa carrinho após sucesso

---

## 📄 PADRÃO DE PÁGINAS CRUD (Settings)

Todas as páginas de configuração (`BrandsPage`, `ModelsPage`, `ColorsPage`, etc.) seguem o mesmo padrão:

```tsx
const [items, setItems] = useState<Item[]>([]);
const [loading, setLoading] = useState(true);
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

// Carrega dados ao montar
useEffect(() => { loadData(); }, []);

const loadData = async () => {
    const data = await itemService.list();
    setItems(data);
};

// Handlers
const handleAdd = () => { setSelectedItem(null); setIsModalOpen(true); };
const handleEdit = (item) => { setSelectedItem(item); setIsModalOpen(true); };
const handleDelete = async (item) => { await itemService.delete(item.id); loadData(); };
const handleSave = () => { loadData(); }; // Recarrega após salvar no modal
```

**Renderização:** tabela com colunas + botões Editar/Excluir + botão "Novo" no header
**Modal:** `<XxxModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} item={selectedItem} />`

---

## 🛠️ UTILS RESTANTES

### `utils/cn.ts` — Merge de Classes CSS
```ts
cn('px-4', condition && 'bg-blue-500', 'rounded') // → 'px-4 bg-blue-500 rounded'
```
Combina `clsx` (condicionais) + `tailwind-merge` (resolve conflitos de classes Tailwind).
**⚠️ Usado em praticamente todos os componentes** — importar de `utils/cn`, não de `clsx` diretamente.

---

### `utils/urlHelpers.ts` — Helpers de URL
| Função | O que faz |
|--------|-----------|
| `getFullUrl(path)` | `window.location.origin + path` |
| `addUrlParams(url, params)` | Adiciona query params à URL |
| `generateSlug(text)` | Texto → slug URL-friendly (remove acentos, espaços→hífens) |
| `getCurrentUrlParams()` | Retorna todos os query params da URL atual |
| `getWhatsAppShareUrl(url, text?)` | `https://wa.me/?text=...` |
| `getFacebookShareUrl(url)` | URL de share do Facebook |
| `getTwitterShareUrl(url, text?)` | URL de share do Twitter |
| `getEmailShareUrl(url, subject?, body?)` | `mailto:?subject=...&body=...` |

**⚠️ Usado por:** `useShareUrl` hook

---

### `utils/catalogPDFGenerator.ts` — Gerador de PDF do Catálogo
**Usa:** `jsPDF` + `jspdf-autotable`

| Função | O que faz |
|--------|-----------|
| `generateCatalogPDF(products, customerType, categoryName?)` | PDF completo com imagens, preços e parcelamento |
| `generateCategoryPDF(categoryId, customerType)` | PDF de uma categoria específica |
| `generateFullCatalogPDF(customerType)` | PDF de todo o catálogo |

**`CustomerType`:** `'retail' | 'reseller' | 'wholesale'`
**Agrupamento:** por variação (modelo + RAM + storage), exibe cores disponíveis
**Parcelamento:** 10x com 16% de juros (hardcoded)
**Imagens:** carrega via `loadImageAsBase64` (fetch → blob → base64)
**⚠️ Busca `company_settings`** para header do PDF (nome, telefone, email, endereço, logo)

---

### `utils/cpfCnpjValidation.ts`
Validação de CPF e CNPJ com algoritmo de dígitos verificadores.
**⚠️ Usado por:** `CustomerForm`

### `utils/cnpjHelper.ts`
Formatação e consulta de CNPJ (máscara XX.XXX.XXX/XXXX-XX).

### `utils/image-compression.ts`
Compressão de imagens antes do upload usando `browser-image-compression`.
**⚠️ Usado por:** `ImageUploader`

### `utils/multiProductQuoteGenerator.ts`
Gera mensagem de cotação para múltiplos produtos no WhatsApp.

### `utils/catalogMessageGenerator.ts`
Gera mensagem de catálogo para WhatsApp com lista de produtos.
**`CustomerType`:** `'retail' | 'reseller' | 'wholesale'`

### `utils/socialMediaHelpers.ts`
Helpers para redes sociais (formatação de URLs, validação de handles).

### `utils/customerFormUtils.ts`
Utilitários para o formulário de cliente (formatação de CPF/CNPJ, validações).

### `utils/pricing.ts`
Funções de precificação (cálculo de margem, markup, preço sugerido).
**⚠️ Usado por:** `ProductPricing` (seção do ProductForm)

---

## 🗄️ TABELAS DO BANCO — Complemento

### `colors`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome da cor |
| `slug` | TEXT | URL-friendly |
| `hex_code` | TEXT | Código hexadecimal (ex: `#3B82F6`) |
| `active` | BOOLEAN | Cor ativa? |

### `brands`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome da marca |
| `slug` | TEXT | URL-friendly |
| `warranty_days` | INTEGER | Garantia padrão em dias |
| `active` | BOOLEAN | **⚠️ Não existe no banco** — sempre `true` (débito #3) |

### `warranty_documents`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `sale_id` | UUID | FK sales |
| `customer_id` | UUID | FK customers |
| `content` | TEXT | HTML do documento com tags substituídas |
| `signature` | TEXT | Assinatura digital (base64) |
| `delivery_type` | TEXT | `store_pickup` ou `delivery` |
| `created_at` | TIMESTAMPTZ | |

### `sale_items`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `sale_id` | UUID | FK sales |
| `product_id` | UUID | FK products |
| `product_name` | TEXT | Nome no momento da venda (snapshot) |
| `quantity` | INTEGER | Quantidade |
| `unit_price` | INTEGER | Preço unitário em centavos |
| `unit_cost` | INTEGER | Custo unitário em centavos |
| `discount` | INTEGER | Desconto em centavos |
| `total` | INTEGER | Total em centavos |
| `is_gift` | BOOLEAN | Item brinde? |

### `stock_movements`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `product_id` | UUID | FK products |
| `type` | TEXT | `in` (entrada) ou `out` (saída) |
| `quantity` | INTEGER | Quantidade movimentada |
| `reason` | TEXT | Motivo do ajuste |
| `created_at` | TIMESTAMPTZ | **Imutável** — nunca deletar |

**⚠️ `stock_movements` é append-only** — nunca deletar registros, apenas adicionar

---

## 🔑 SUPABASE RLS — Resumo

| Tabela | RLS ativo? | Filtro obrigatório |
|--------|-----------|-------------------|
| `products` | ✅ | `company_id` |
| `categories` | ✅ | `company_id` |
| `models` | ✅ | `company_id` |
| `brands` | ✅ | `company_id` |
| `colors` | ✅ | `company_id` |
| `customers` | ✅ | `company_id` |
| `sales` | ✅ | `company_id` |
| `sale_items` | ✅ | via `sale_id` |
| `model_color_images` | ✅ | `company_id` |
| `custom_fields` | ✅ | `company_id` |
| `company_settings` | ✅ | usuário autenticado |
| `stock_movements` | ✅ | via `product_id` |

**⚠️ Sem `company_id` no filtro → query retorna vazio silenciosamente (sem erro)**
**⚠️ `company_id` padrão:** obtido via `companies.select('id').eq('slug', 'mercado-do-vale')`

---

## 📦 `types/model.ts` — Detalhado

```ts
interface Model {
    id: string;
    name: string;
    slug: string;
    brand_id: string;
    active: boolean;
    created: string;
    updated: string;
    // Template fields
    category_id?: string;
    description?: string;
    template_values?: Record<string, any>; // Valores padrão para autofill
    // EAN codes
    eans?: string[]; // Array de EAN/GTIN para leitura de código de barras
}

interface ModelInput {
    name: string;
    brand_id: string;
    active?: boolean;
    category_id?: string;
    description?: string;
    template_values?: Record<string, any>;
    eans?: string[];
}
```

**`template_values`** — JSONB com valores padrão por campo:
```json
{ "ram": "4GB", "storage": "128GB", "color": "Preto", "version": "Global" }
```
**⚠️ Aplicado automaticamente** quando EAN é escaneado no ProductForm

---

## 📋 `components/units/UnitList` — O que é uma "Unit"

**Conceito:** Uma `Unit` é uma **unidade física individual** de um produto — cada aparelho com seu próprio IMEI/serial.

**Diferença de `Product`:**
- `Product` = modelo/configuração (ex: "iPhone 13 128GB Preto")
- `Unit` = unidade física (ex: IMEI `352999001234567`)

**`UnitStatus`** (de `field-standards.ts`):
| Status | Cor | Significado |
|--------|-----|-------------|
| `AVAILABLE` | 🟢 Verde | Disponível para venda |
| `RESERVED` | 🟡 Amarelo | Reservado para cliente |
| `SOLD` | 🔵 Azul | Vendido |
| `RMA` | 🔴 Vermelho | Em garantia/reparo |

**`UnitList` Props:** `units: Unit[]`, `isLoading?`, `onDelete?(unit)`
**⚠️ Só permite deletar unidades com status `AVAILABLE`**
**Colunas exibidas:** IMEI 1, IMEI 2, Serial, Status, Custo

**`Unit` type** (de `types/unit.ts`):
- `imei_1: string` — IMEI principal
- `imei_2?: string` — IMEI secundário (dual SIM)
- `serial_number?: string` — número de série
- `status: UnitStatus`
- `cost_price?: number` — custo em centavos

---

## 💰 `utils/saleCalculations.ts` — Cálculos de Venda

**18 funções exportadas.** Todas trabalham com **centavos**.

### Cálculos de Item
| Função | Fórmula |
|--------|---------|
| `calculateItemSubtotal(item)` | `unit_price × quantity` |
| `calculateItemDiscount(item)` | `discount × quantity` (ou `unit_price × quantity` se `is_gift`) |
| `calculateItemTotal(item)` | `subtotal - discount` (ou `0` se `is_gift`) |
| `calculateItemCost(item)` | `unit_cost × quantity` |

### Cálculos de Venda
```ts
calculateSaleTotals(items) → { subtotal, discount_total, total, cost_total, profit }
```

### Cálculos de Pagamento
| Função | O que faz |
|--------|-----------|
| `calculatePaymentFee(amount, method, installments, fees)` | Taxa por método/parcela da tabela `payment_fees` |
| `calculateTotalPaid(payments)` | Soma `total_with_fee` de cada pagamento |
| `calculateChange(total, payments)` | Troco (totalPago - total, se positivo) |
| `calculateRemaining(total, payments)` | Restante a pagar |
| `isPaymentComplete(total, payments)` | `totalPago >= total` |
| `calculateProfitMargin(profit, total)` | `(profit / total) × 100` |

### Regras de Taxa
- `money`, `pix`, `debit` → **sem taxa**
- `credit` 1x → **sem taxa**
- `credit` 2x+ → busca taxa na tabela `payment_fees`
- Se taxa não configurada → avisa no console e aplica 0%

### Helpers de Exibição
| Função | Exemplo |
|--------|---------|
| `formatCurrency(centavos)` | `1050` → `"R$ 10,50"` |
| `getPaymentMethodLabel(method, installments?)` | `"credit", 3` → `"Cartão de Crédito 3x"` |
| `getPaymentMethodIcon(method)` | `"pix"` → `"📱"` |
| `getDeliveryTypeLabel(type)` | `"store_pickup"` → `"Retirada na Loja"` |

### Tipos de Entrega (`DeliveryType`)
| Valor | Label | Taxa |
|-------|-------|------|
| `store_pickup` | Retirada na Loja | Sem custo |
| `store_delivery` | Entrega pela Loja | `deliveryCostStore` (desconto integral) |
| `hybrid_delivery` | Entrega Híbrida | Parte loja + parte cliente |

---

## 💬 `utils/whatsappMessageGenerator.ts`

### `generateQuoteMessage(quote: QuoteRequest): string`
Gera mensagem formatada para WhatsApp.

**`QuoteRequest`:**
```ts
{
    product: CatalogProduct;
    variant: VariantSpecs;         // { ram, storage, color }
    installmentPlan: InstallmentPlan;
    delivery: DeliveryOption;      // { type: 'pickup'|'delivery', address? }
    userType?: 'ADMIN' | 'retail' | 'resale' | 'wholesale';
    availableColors?: string[];
}
```

**Dois formatos de mensagem:**
- **Admin/Staff** (`userType === 'ADMIN'`): formato interno, mostra cores disponíveis, sem endereço
- **Cliente** (outros): formato público, mostra endereço de entrega, CTA de urgência

**Regra Atacado:** se `userType === 'wholesale'` → não exibe opção de parcelamento no cartão

### `generateWhatsAppLink(message): Promise<string>`
1. Busca `phone` da tabela `company_settings`
2. Limpa dígitos não-numéricos
3. Detecta mobile vs desktop → usa `api.whatsapp.com` ou `web.whatsapp.com`
4. Retorna `https://api.whatsapp.com/send?phone=55{phone}&text={encoded}`

**⚠️ Lança erro** se `phone` não configurado nas settings da empresa

---

## 📊 `services/installmentCalculator.ts`

### `calculateInstallments(priceInCents, maxInstallments=12): Promise<InstallmentPlan[]>`
Calcula planos de parcelamento usando a tabela `payment_fees` do banco.

**`InstallmentPlan`:**
```ts
{ installments: number; value: number; total: number; label: string; highlighted?: boolean }
```

**Planos gerados:**
1. **PIX à vista** — taxa do `payment_fees` onde `method='pix' AND installments=1`
2. **Crédito 1x–12x** — taxa do `payment_fees` onde `method='credit' AND installments=N`

**⚠️ Destaca `highlighted=true` para 10x** (padrão visual)
**⚠️ Pula parcelas sem taxa configurada** (sem erro, apenas ignora)
**⚠️ Usa `paymentFeesService.list()`** — busca do banco a cada chamada

### `formatPrice(cents): string`
`1050` → `"R$ 10,50"` (usando `Intl.NumberFormat pt-BR`)

---

## 🔗 `services/table-data.ts`

**Propósito:** Carregar opções de **qualquer tabela do banco** para campos do tipo `table_relation` no `ModelModal`.

### `tableDataService.loadOptions(tableName, valueColumn='id', labelColumn='name', orderBy?)`
```ts
// Exemplo: carregar marcas para um campo table_relation
await tableDataService.loadOptions('brands', 'id', 'name', 'name ASC')
// → [{ value: 'uuid-1', label: 'Apple' }, { value: 'uuid-2', label: 'Samsung' }]
```

### `tableDataService.loadOption(tableName, value, valueColumn='id', labelColumn='name')`
Carrega uma única opção por valor (para exibir seleção atual).

**⚠️ Não filtra por `company_id`** — retorna dados de todas as empresas
**⚠️ Usado por:** `TemplateFieldInput` no `ModelModal` para campos `field_type='table_relation'`

---

## 📁 MAPA DE DIRETÓRIOS

```
mercado-do-vale/
├── components/
│   ├── catalog/          # CatalogSection, ProductCard (catálogo público)
│   ├── products/         # ProductForm, ProductCard, ProductFilters, selectors/
│   ├── settings/         # BrandModal, ModelModal, ColorModal, ColorImageManager
│   ├── ui/               # SmartInput, CurrencyInput, EANInput, IMEIInput, ImageUploader, Tab/Tabs
│   └── units/            # UnitList
├── config/               # field-dictionary.ts, category-badges.ts, product-fields.ts
├── contexts/             # SupabaseAuthContext.tsx, ThemeContext.tsx
├── core/                 # rules.ts (regras de negócio puras)
├── hooks/                # useCatalog, useProducts, useShareUrl, useEnrichedCustomFields, etc.
├── layouts/              # AdminLayout.tsx
├── pages/
│   ├── admin/            # Todas as páginas admin (products, sales, customers, settings/, etc.)
│   ├── customer/         # CustomerCatalogPage, CustomerProfilePage
│   └── pdv/              # PDVPage.tsx
├── routes/               # index.tsx (mapa completo de rotas)
├── schemas/              # product.ts, unit.ts (validação Zod)
├── services/             # Todos os services (Supabase + localStorage legados)
├── types/                # Todos os tipos TypeScript
└── utils/                # Funções utilitárias (17 arquivos)
```

---

## 📍 `services/addressLookup.ts` — Busca de CEP

**API externa:** [ViaCEP](https://viacep.com.br) — gratuita, sem autenticação

| Função | O que faz |
|--------|-----------|
| `lookupCEP(cep)` | Busca endereço pelo CEP via ViaCEP API |
| `formatCEP(cep)` | Formata CEP com máscara: `12345-678` |

**`Address`:**
```ts
{ cep, street, neighborhood, city, state, number?, complement? }
```

**⚠️ Valida 8 dígitos** antes de chamar a API
**⚠️ Lança erro** se CEP não encontrado (`data.erro === true`)
**⚠️ Usado por:** `whatsappMessageGenerator` (endereço de entrega no orçamento)

---

## 🔀 `services/productVariants.ts` — Variações do Catálogo

**Propósito:** Extrair e manipular variações de produtos no catálogo público.

| Função | O que faz |
|--------|-----------|
| `groupProductsByModel(products)` | Agrupa `CatalogProduct[]` por `model_id` → `Map<string, CatalogProduct[]>` |
| `extractVariants(products)` | Extrai RAMs, storages, cores únicas e faixa de preço |
| `findProductBySpecs(products, specs)` | Encontra produto específico por `{ram, storage, color}` |

**`VariantSpecs`:** `{ ram?, storage?, color? }`
**`ProductVariants`:** `{ rams: string[], storages: string[], colors: ColorOption[], priceRange: {min, max} }`
**`ColorOption`:** `{ name: string, hex?: string }`

**⚠️ `findProductBySpecs`** — specs vazias são ignoradas (match parcial)
**⚠️ Usado por:** `ProductCard` no catálogo para seleção de variação

---

## 🏷️ `services/model-eans.ts` — EANs por Modelo

**Exporta:** `modelEANsService`
**Tabela:** `model_eans`

| Função | O que faz |
|--------|-----------|
| `getByEAN(ean)` | Busca modelo completo por EAN (com join em `models`, `brands`, `categories`) |
| `getByModelId(modelId)` | Lista todos os EANs de um modelo (primário primeiro) |
| `add(input)` | Adiciona EAN ao modelo (valida 13 dígitos) |
| `update(id, updates)` | Atualiza EAN |
| `setPrimary(id)` | Define EAN como principal |
| `remove(id)` | Remove EAN |
| `validateEAN13(ean)` | Valida checksum EAN-13 (algoritmo oficial) |
| `checkDuplicate(ean)` | Verifica se EAN já existe no banco |

**Algoritmo EAN-13:**
```ts
// Dígitos alternados × 1 e × 3, soma, (10 - soma%10) % 10 = checksum
```

**`EANSearchResult`:** `{ found: boolean, model?, ean_record? }`
**⚠️ `getByEAN` faz join completo** — retorna modelo com marca e categoria
**⚠️ Usado por:** `EANInput` (autofill ao escanear) e `ModelModal` (aba Basic)

---

## 📦 `services/units.ts` — Unidades Físicas

**Exporta:** `unitService`
**Tabela:** `units`
**⚠️ `TEMP_COMPANY_ID = 'mercado-do-vale'`**

| Função | O que faz |
|--------|-----------|
| `listByProduct(productId)` | Lista unidades de um produto (mais recentes primeiro) |
| `getById(id)` | Unidade por ID |
| `create(input)` | Cria unidade com IMEI, serial, status inicial `AVAILABLE` |
| `updateStatus(id, status)` | Atualiza status da unidade |
| `delete(id)` | Remove unidade |
| `getStatsByProduct(productId)` | `{total, available, reserved, sold, rma}` |

**`UnitInput`:** `{ product_id, imei_1?, imei_2?, serial_number?, status?, internal_notes? }`
**⚠️ `cost_price` não existe no schema atual** — `transformFromDB` retorna `null`
**⚠️ Coluna `serial` no banco** → mapeada para `serial_number` no tipo

---

## 🖼️ `services/bannerService.ts` — Banners do Catálogo

**Exporta:** `bannerService`
**Tabela:** `catalog_banners`
**Sem filtro por `company_id`** — banners são globais

| Função | O que faz |
|--------|-----------|
| `getActiveBanners()` | Banners ativos dentro do período (`start_date`/`end_date`) |
| `getAllBanners()` | Todos os banners (admin) |
| `getBannerById(id)` | Banner por ID |
| `createBanner(banner)` | Cria banner |
| `updateBanner(id, updates)` | Atualiza banner |
| `deleteBanner(id)` | Remove banner |
| `trackBannerClick(bannerId)` | Incrementa `clicks_count` via RPC |
| `trackBannerView(bannerId)` | Incrementa `views_count` via RPC |
| `reorderBanners(bannerIds[])` | Atualiza `display_order` de todos os banners |

**`Banner`** (de `types/catalog.ts`): `{ id, title, image_url, link_url, is_active, display_order, start_date?, end_date?, clicks_count, views_count }`
**⚠️ `trackBannerClick/View` usa RPC** — requer funções `increment_banner_clicks` e `increment_banner_views` no Supabase
**⚠️ `reorderBanners` faz N updates sequenciais** (um por banner) — pode ser lento com muitos banners

---

## ☁️ `services/uploadService.ts` — Upload de Imagens

**Exporta:** `uploadService`
**Bucket Supabase Storage:** `catalog-banners`

| Função | O que faz |
|--------|-----------|
| `uploadBannerImage(file)` | Upload → retorna URL pública |
| `deleteBannerImage(imageUrl)` | Remove imagem do bucket (extrai filename da URL) |
| `validateImageFile(file)` | Valida tipo e tamanho |
| `getPublicUrl(fileName)` | URL pública de um arquivo no bucket |

**Limites:**
- Tamanho máximo: **5MB**
- Tipos permitidos: `PNG`, `JPG`, `JPEG`, `WEBP`
- Nome gerado: `{timestamp}_{random}.{ext}`

**⚠️ `deleteBannerImage` não lança erro** — falha silenciosa para não bloquear exclusão do banner
**⚠️ Usado apenas para banners** — imagens de produtos usam outro mecanismo

---

## 📋 `services/warrantyTemplates.ts` — Templates de Garantia

**Exporta:** `warrantyTemplateService`
**Tabela:** `warranty_templates`
**⚠️ `TEMP_COMPANY_ID = 'mercado-do-vale'`**

| Função | O que faz |
|--------|-----------|
| `list()` | Lista todos os templates da empresa |
| `getById(id)` | Template por ID |
| `create(input)` | Cria template |
| `update(id, input)` | Atualiza template |
| `remove(id)` | Remove template |

**`WarrantyTemplate`:**
```ts
{ id, company_id, name, description, duration_days, terms, active, created_at, updated_at }
```
**`terms`** — HTML do documento com `{{tags}}` para substituição
**⚠️ Usado por:** `warrantyDocumentService` ao gerar o termo de garantia

---

## 👥 `services/team.ts` — Membros da Equipe

**Exporta:** `teamService` (instância de `TeamService`)
**Tabela:** `team_members`
**⚠️ Sem filtro por `company_id`** — equipe é global

**Classe `TeamService` com cache de 5 minutos:**
```ts
private cache: TeamMember[] | null = null;
private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 min
```

| Método | O que faz |
|--------|-----------|
| `list(filters?)` | Lista com filtros: `search`, `role`, `employment_type`, `is_active`, datas |
| `getById(id)` | Membro por ID |
| `getByCpfCnpj(cpfCnpj)` | Membro por CPF/CNPJ |
| `getByRole(role)` | Membros por cargo |
| `create(input)` | Cria membro → limpa cache |
| `update(id, input)` | Atualiza membro → limpa cache |
| `softDelete(id)` | `is_active = false` |
| `delete(id)` | Hard delete → limpa cache |
| `search(query)` | Busca por nome/CPF/email |
| `getActiveCount()` | Conta membros ativos |
| `clearCache()` | Limpa cache manualmente |

**`TeamMember`** (de `types/team.ts`): `{ id, name, cpf_cnpj, email, phone, role, employment_type, is_active, ... }`

---

## 💹 `services/averagePriceService.ts` — Preço Médio Ponderado

**Exporta:** `averagePriceService`
**Regra crítica:** Só recalcula ao **entrar estoque**, nunca ao vender.

### Chave de variação
```ts
{ model_id: string, ram: string, storage: string }
```

### `updateAveragePrices(newProduct)` — Fluxo
1. Extrai `{model_id, ram, storage}` do novo produto
2. Se qualquer campo vazio → **pula** (log: "Skipping average price calculation")
3. Busca todos os produtos da mesma variação (`status='active'`)
4. Calcula média ponderada atual por `stock_quantity`
5. Calcula nova média incluindo o produto novo
6. **Atualiza todos os produtos existentes** da variação com os novos preços médios

**Fórmula (média ponderada):**
```
avgPrice = (sumOf(price × stock) + newPrice × newQty) / (totalStock + newQty)
```

**Preços recalculados:** `price_cost`, `price_retail`, `price_reseller`, `price_wholesale`
**⚠️ Usa `specs->>'ram'` e `specs->>'storage'`** — query JSONB no Supabase
**⚠️ Chamado por:** `productService.create()` após criar produto

---

## 📊 `services/inventory.ts` — Gestão de Estoque

**Exporta:** `inventoryService` (instância de `InventoryService`)
**Tabela principal:** `products` (com filtros de estoque) + `stock_movements`

| Método | O que faz |
|--------|-----------|
| `getInventory(filters)` | Lista produtos com filtros: `search`, `category`, `brand`, `status`, `lowStock` |
| `getInventoryGrouped(filters)` | Agrupa por variação: serializados (IMEI/serial) por brand+model+color+storage |
| `getStats()` | `{ totalProducts, totalStock, totalValue, lowStockCount, outOfStockCount }` |
| `adjustStock(adjustment)` | Ajusta estoque + cria `stock_movement` imutável |
| `getMovements(productId, limit=50)` | Histórico de movimentos de um produto |
| `getLowStockProducts(threshold=10)` | Produtos com estoque abaixo do threshold |
| `getBrands()` | Lista de marcas únicas no inventário |

**`StockAdjustmentInput`:** `{ product_id, type: 'in'|'out', quantity, reason }`
**⚠️ `adjustStock` cria `stock_movement` imutável** — nunca deletar
**⚠️ `getInventoryGrouped`** — produtos serializados (com IMEI/serial) são agrupados diferente dos não-serializados
**⚠️ `getStats` calcula `totalValue`** usando `price_cost × stock_quantity`

---

## 📋 TABELAS DO BANCO — Complemento Final

### `team_members`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `name` | TEXT | Nome completo |
| `cpf_cnpj` | TEXT | Único |
| `email` | TEXT | |
| `phone` | TEXT | |
| `role` | TEXT | Cargo |
| `employment_type` | TEXT | Tipo de contrato |
| `is_active` | BOOLEAN | Soft delete |

### `catalog_banners`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `title` | TEXT | |
| `image_url` | TEXT | URL do Supabase Storage |
| `link_url` | TEXT | Link ao clicar |
| `is_active` | BOOLEAN | |
| `display_order` | INTEGER | Ordem de exibição |
| `start_date` | TIMESTAMPTZ | Início da veiculação |
| `end_date` | TIMESTAMPTZ | Fim da veiculação |
| `clicks_count` | INTEGER | Incrementado via RPC |
| `views_count` | INTEGER | Incrementado via RPC |

### `warranty_templates`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome do template |
| `description` | TEXT | |
| `duration_days` | INTEGER | Prazo de garantia |
| `terms` | TEXT | HTML com `{{tags}}` |
| `active` | BOOLEAN | |

### `units`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `product_id` | UUID | FK products |
| `imei_1` | TEXT | IMEI principal |
| `imei_2` | TEXT | IMEI secundário |
| `serial` | TEXT | **⚠️ Mapeado para `serial_number` no tipo** |
| `status` | TEXT | `available`, `reserved`, `sold`, `rma` |
| `internal_notes` | TEXT | Notas internas |

---

## ⚠️ SERVICES LEGADOS / DUPLICADOS

| Service | Status | Observação |
|---------|--------|-----------|
| `batteryHealths.ts` | 🔴 localStorage | Legado — usar `batteryHealths-supabase.ts` |
| `batteryHealths-supabase.ts` | ✅ Supabase | Versão atual |
| `rams.ts` | 🔴 localStorage | Débito #7 |
| `rams-supabase.ts` | ✅ Supabase | Versão atual |
| `storages.ts` | 🔴 localStorage | Débito #9 |
| `storages-supabase.ts` | ✅ Supabase | Versão atual |
| `versions.ts` | 🔴 localStorage | Legado |
| `versions-supabase.ts` | ✅ Supabase | Versão atual |
| `models.ts` | ✅ Supabase | Produção |
| `models-new.ts` | ⚠️ Experimental | Verificar antes de usar |
| `models-new-backup.ts` | 🗑️ Backup | Não usar |
| `legacyAPI.ts` | 🔴 Legado | Adaptadores para API antiga |
| `legacyAdapters.ts` | 🔴 Legado | Adaptadores de tipos antigos |
| `model-color-images.ts` | ⚠️ Duplicado | Verificar vs `modelColorImages.ts` |
| `modelColorImages.ts` | ✅ Atual | Versão em uso |

**⚠️ Sempre preferir a versão Supabase** — versões localStorage perdem dados ao trocar de dispositivo/browser

---

## 🔄 SERVICES SUPABASE — TABELA COMPLETA

| Service | Tabela | Exporta | Tem company_id? |
|---------|--------|---------|----------------|
| `brands.ts` | `brands` | `brandService` | ✅ via slug |
| `categories.ts` | `categories` | `categoryService` | ✅ via slug |
| `colors.ts` | `colors` | `colorService` | ✅ via slug |
| `models.ts` | `models` | `modelService` | ✅ via slug |
| `products.ts` | `products` | `productService` | ✅ via slug |
| `customers.ts` | `customers` | `customerService` | ✅ via slug |
| `units.ts` | `units` | `unitService` | ✅ via slug |
| `saleService.ts` | `sales` + `sale_items` | `saleService` | ✅ |
| `inventory.ts` | `products` + `stock_movements` | `inventoryService` | ✅ |
| `custom-fields.ts` | `custom_fields` | `customFieldsService` | ✅ |
| `warrantyTemplates.ts` | `warranty_templates` | `warrantyTemplateService` | ✅ via slug |
| `warrantyDocumentService.ts` | `warranty_documents` | `warrantyDocumentService` | ✅ |
| `bannerService.ts` | `catalog_banners` | `bannerService` | ❌ global |
| `team.ts` | `team_members` | `teamService` | ❌ global |
| `companyService.ts` | `companies` + `company_settings` | `companyService` | ✅ |
| `companySettingsService.ts` | `company_settings` | `companySettingsService` | ✅ |
| `model-eans.ts` | `model_eans` | `modelEANsService` | ❌ (sem company_id) |
| `averagePriceService.ts` | `products` | `averagePriceService` | ❌ (filtra por model+specs) |
| `uploadService.ts` | Storage `catalog-banners` | `uploadService` | ❌ |
| `table-data.ts` | Qualquer tabela | `tableDataService` | ❌ |
| `payment-fees.ts` | `payment_fees` | `paymentFeesService` | ✅ |
| `catalogService.ts` | `products` + `categories` | `catalogService` | ✅ |

---

## 📄 MAPA COMPLETO DE PÁGINAS

### Páginas Admin — Raiz (`pages/admin/`)

| Página | Rota | O que faz |
|--------|------|-----------|
| `AdminDashboardPage` | `/admin` | Dashboard principal (stub, em desenvolvimento) |
| `CatalogConfigPage` | `/admin/catalog-config` | Configuração completa do catálogo público (seções, banners, temas) |
| `DevDiaryPage` | `/admin/dev-diary` | Diário de desenvolvimento — histórico de mudanças |
| `EntradaPage` | `/admin/entrada` | Entrada em lote de produtos via `ProductEntryWizard` |
| `GovernancePage` | `/admin/governance` | Documentação viva de padrões e auditoria de configurações |
| `SimpleEntryPage` | `/admin/simple-entry` | Entrada simplificada de produto único |
| `catalog-editor` | `/admin/catalog-editor` | Editor visual do catálogo (Draft → Published) |

### Páginas Admin — Produtos (`pages/admin/products/`)

| Página | Rota | O que faz |
|--------|------|-----------|
| `ProductsPage` | `/admin/products` | Lista de produtos com filtros e ações |
| `ProductFormPage` | `/admin/products/new` | Criação de produto |
| `ProductFormPage` | `/admin/products/:id/edit` | Edição de produto |
| `ProductDetailPage` | `/admin/products/:id` | Detalhes do produto + unidades (IMEI) |

### Páginas Admin — Configurações (`pages/admin/settings/`)

| Página | Rota | O que faz |
|--------|------|-----------|
| `BrandsPage` | `/admin/settings/brands` | CRUD de marcas |
| `ModelsPage` | `/admin/settings/models` | CRUD de modelos (com `ModelModal`) |
| `ColorsPage` | `/admin/settings/colors` | CRUD de cores |
| `RamsPage` | `/admin/settings/rams` | CRUD de RAMs |
| `StoragesPage` | `/admin/settings/storages` | CRUD de armazenamentos |
| `VersionsPage` | `/admin/settings/versions` | CRUD de versões |
| `BatteryHealthsPage` | `/admin/settings/battery-healths` | CRUD de saúdes de bateria |
| `PaymentFeesPage` | `/admin/settings/payment-fees` | Configuração de taxas por método/parcela |
| `CompanyDataPage` | `/admin/settings/company` | Dados da empresa (nome, telefone, endereço, logo) |
| `CatalogSettingsPage` | `/admin/settings/catalog` | Configurações do catálogo (cores, layout, SEO) |
| `DocumentSettingsPage` | `/admin/settings/documents` | Templates de documentos (garantia, recibo) |
| `WarrantyTemplatesPage` | `/admin/settings/warranty-templates` | CRUD de templates de garantia |
| `CustomFieldsLibraryPage` | `/admin/settings/custom-fields` | Biblioteca de campos customizados globais |
| `FieldConfigPage` | `/admin/settings/fields` | Configuração de campos por categoria |
| `BannerManagementPage` | `/admin/settings/banners` | CRUD de banners do catálogo |
| `PermissionsManagementPage` | `/admin/settings/permissions` | Gestão de permissões de usuários |
| `fields.tsx` | `/admin/settings/fields-legacy` | Configuração de campos (versão legada) |
| `categories/` | `/admin/settings/categories/*` | CRUD de categorias (3 sub-páginas) |

### Páginas Admin — Inventário (`pages/admin/inventory/`)

| Página | Rota | O que faz |
|--------|------|-----------|
| `InventoryPage` | `/admin/inventory` | Gestão de estoque com `inventoryService` |

### Páginas Customer (`pages/customer/`)

| Página | Rota | O que faz |
|--------|------|-----------|
| `CustomerCatalogPage` | `/catalog` | Catálogo público para clientes |
| `CustomerProfilePage` | `/profile` | Perfil do cliente logado |

### Páginas PDV (`pages/pdv/`)

| Página | Rota | O que faz |
|--------|------|-----------|
| `PDVPage` | `/admin/pdv` | Ponto de venda (sem sidebar, tela cheia) |

---

## 📱 `CustomerCatalogPage` — Detalhado

**Arquivo:** `pages/customer/CustomerCatalogPage.tsx`
**Rota:** `/catalog`
**Acesso:** Clientes logados (via `ProtectedRoute` com role `customer`)

### Estado
```ts
const [products, setProducts] = useState<CatalogProduct[]>([]);
const [favorites, setFavorites] = useState<string[]>([]); // IDs dos favoritos
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [searchQuery, setSearchQuery] = useState('');
```

### Handlers
| Handler | O que faz |
|---------|-----------|
| `loadProducts()` | Carrega produtos via `catalogService` |
| `loadFavorites()` | Carrega favoritos do cliente (localStorage ou banco) |
| `handleFavorite(productId)` | Toggle favorito — adiciona/remove da lista |
| `handleShare(product)` | Compartilha produto via `useShareUrl` |
| `handleLogout()` | Faz logout via `SupabaseAuthContext` |

**Componentes usados:** `ModernProductCard`, `ProductCard`, `ShareCatalogButton`
**⚠️ Dois tipos de card:** `ModernProductCard` (novo) e `ProductCard` (legado) — verificar qual está ativo

---

## 🚪 `EntradaPage` — Entrada em Lote

**Arquivo:** `pages/admin/EntradaPage.tsx`
**Rota:** `/admin/entrada`
**Componente principal:** `ProductEntryWizard`

**Fluxo:**
1. `ProductEntryWizard` coleta array de `ProductInput[]`
2. `handleComplete(products)` → salva um a um via `productService.create()`
3. Navega para `/admin/products` após sucesso

**⚠️ TODO no código:** `// TODO: implement batch insert in service` — salva sequencialmente, não em batch
**⚠️ Se um produto falhar**, toda a operação falha (sem rollback parcial)

---

## 🏛️ `GovernancePage` — Documentação Viva

**Arquivo:** `pages/admin/GovernancePage.tsx`
**Rota:** `/admin/governance`
**Propósito:** Referência de desenvolvimento — padrões Anti-NaN, matriz de configuração por categoria (semáforo)

**Conteúdo:**
- Padrões de código documentados visualmente
- Auditoria de configuração de categorias (quais campos estão ativos por categoria)
- Referência para desenvolvedores

**⚠️ Não é uma página operacional** — é documentação interna para a equipe de desenvolvimento

---

## 📓 `DevDiaryPage` — Diário de Desenvolvimento

**Arquivo:** `pages/admin/DevDiaryPage.tsx`
**Rota:** `/admin/dev-diary`

**`DiaryEntry`:**
```ts
{
    date: string;
    title: string;
    description: string;
    filesModified: string[];
    features: string[];
    status: 'completed' | 'in-progress' | 'planned';
}
```

**Propósito:** Histórico cronológico de mudanças no sistema — rastreabilidade e facilidade de handover
**⚠️ Dados hardcoded** no componente — não persiste no banco

---

## 🔐 FLUXO DE AUTENTICAÇÃO — Detalhado

### Usuários Admin
```
1. /admin/login → formulário de email/senha
2. supabase.auth.signInWithPassword()
3. SupabaseAuthContext detecta sessão → busca customer por auth.user.email
4. customer.user_type === 'admin' → redireciona para /admin
5. customer.user_type !== 'admin' → redireciona para /catalog
```

### Usuários Cliente
```
1. /login → formulário de email/senha
2. supabase.auth.signInWithPassword()
3. customer.user_type === 'customer' → redireciona para /catalog
```

### `ProtectedRoute`
```tsx
// Verifica autenticação + role
<ProtectedRoute requiredRole="admin">
    <AdminPage />
</ProtectedRoute>
```
- Sem sessão → redireciona para `/admin/login`
- Role incorreto → redireciona para página adequada

### Modo Dev (`VITE_DEV_MODE=true`)
- Pula verificação de autenticação
- Usa usuário mock
- Banner amarelo no `AdminLayout`

---

## 🗂️ TIPOS RESTANTES — Resumo

| Arquivo | Tipos principais |
|---------|----------------|
| `types/color.ts` | `Color { id, name, slug, hex_code, active }`, `ColorInput` |
| `types/brand.ts` | `Brand { id, name, slug, warranty_days, active }`, `BrandInput` |
| `types/catalog.ts` | `CatalogProduct`, `Banner`, `CatalogSection`, `CatalogSettings` |
| `types/customer.ts` | `Customer { id, name, email, phone, cpf_cnpj, user_type, client_type }` |
| `types/sale.ts` | `Sale`, `SaleItem`, `PaymentMethod`, `PaymentMethodType`, `DeliveryType` |
| `types/inventory.ts` | `StockMovement`, `InventoryStats`, `InventoryFilters`, `InventoryGroup` |
| `types/warranty.ts` | `WarrantyTemplate`, `WarrantyTemplateInput` |
| `types/warrantyDocument.ts` | `WarrantyDocument`, `WarrantyTagData`, `DeliveryTypeWarranty` |
| `types/team.ts` | `TeamMember`, `TeamMemberInput`, `TeamMemberFilters` |
| `types/company.ts` | `Company`, `CompanySettings` |
| `types/catalogSettings.ts` | Configurações detalhadas do catálogo (cores, layout, SEO, etc.) |
| `types/auth.ts` | `AuthUser`, `AuthSession` |
| `types/unit.ts` | `Unit`, `UnitInput`, `UnitStatus` |
| `types/ram.ts` | `Ram`, `RamInput` |
| `types/storage.ts` | `Storage`, `StorageInput` |
| `types/version.ts` | `Version`, `VersionInput` |
| `types/batteryHealth.ts` | `BatteryHealth`, `BatteryHealthInput` |
| `types/payment-fees.ts` | `PaymentFee { payment_method, installments, applied_fee }` |
| `types/bulk-product.ts` | `BulkProduct` (entrada em lote) |
| `types/model-architecture.ts` | `ModelEAN`, `ModelEANInput`, `EANSearchResult` |

---

## ✅ SCHEMAS DE VALIDAÇÃO (Zod)

### `schemas/product.ts` — `productSchema`

**Campos e regras:**

| Campo | Tipo Zod | Regra |
|-------|----------|-------|
| `name` | `string.min(3)` | Obrigatório |
| `price_retail` | `coerce.number.min(0)` | Obrigatório |
| `price_reseller` | `coerce.number.min(0)` | Obrigatório |
| `price_wholesale` | `coerce.number.min(0)` | Obrigatório |
| `price_cost` | `coerce.number.min(0).nullable.optional` | Opcional |
| `weight_kg` | `union([number, nan, null, undefined])` | Anti-NaN |
| `dimensions` | `object({width_cm, height_cm, depth_cm})` | Anti-NaN |
| `ncm` | `string.max(8).nullable.optional` | Fiscal |
| `cest` | `string.max(7).nullable.optional` | Fiscal |
| `track_inventory` | `boolean.default(true)` | |
| `stock_quantity` | `coerce.number.int.min(0).nullable.optional` | |
| `meta_title` | `string.max(60)` | SEO |
| `meta_description` | `string.max(160)` | SEO |

**3 `.refine()` de preço:**
```ts
price_retail >= price_reseller  // "Preço varejo deve ser >= preço revenda"
price_reseller >= price_wholesale // "Preço revenda deve ser >= preço atacado"
track_inventory=true → stock_quantity obrigatório
```

**Padrão Anti-NaN (campos de logística):**
```ts
z.union([z.number(), z.nan(), z.null(), z.undefined()])
  .optional()
  .transform(val => {
    if (val === null || val === undefined || Number.isNaN(val) || val === 0) return undefined;
    return val;
  })
```
**⚠️ Limites dos Correios:** peso máx 30kg, dimensões máx 105cm

---

### `schemas/unit.ts` — `createUnitSchema(context)` — Traffic Light

**Validação dinâmica** baseada em `CategoryConfig` + `ProductCondition`:

```ts
createUnitSchema({ categoryConfig, condition }) → ZodSchema
```

**Regras por campo:**
| Campo | `'off'` | `'optional'` | `'required'` |
|-------|---------|-------------|-------------|
| `imei_1` | permissivo | `string.optional` | `string.length(15).regex(/^\d+$/)` |
| `imei_2` | permissivo | `string.optional` | `string.optional` (sempre opcional) |
| `serial_number` | permissivo | `string.optional` | `string.min(3)` |
| `battery_health` | `number.optional` | `number.optional` | `number.min(0).max(100)` **só se `condition=USED`** |

**Schemas pré-definidos:**
```ts
// Para celulares novos (padrão)
export const unitSchema = createUnitSchema({
    categoryConfig: { imei: 'required', serial: 'optional', battery_health: 'required', ... },
    condition: ProductCondition.NEW
});

// Para atualizar só o status
export const unitStatusUpdateSchema = z.object({ status: z.nativeEnum(UnitStatus) });
```

**⚠️ `battery_health` só é obrigatório** quando `condition === ProductCondition.USED AND categoryConfig.battery_health === 'required'`

---

## 🪝 HOOKS — Mapa Completo

| Hook | Arquivo | O que faz |
|------|---------|-----------|
| `useProducts` | `hooks/useProducts.ts` | Lista produtos com filtros client-side |
| `useCatalog` | `hooks/useCatalog.ts` | Carrega catálogo público (settings + produtos + metadata) |
| `useShareUrl` | `hooks/useShareUrl.ts` | Compartilhamento em redes sociais + Web Share API |
| `useEffectiveCustomerType` | `hooks/useEffectiveCustomerType.ts` | Tipo de cliente efetivo (com suporte a preview admin) |
| `useEnrichedCustomFields` | `hooks/useEnrichedCustomFields.ts` | Campos customizados enriquecidos com valores |
| `useFavicon` | `hooks/useFavicon.ts` | Atualiza favicon dinamicamente |
| `usePageTitle` | `hooks/usePageTitle.ts` | Atualiza título da página |
| `useSupabaseAuth` | `hooks/useSupabaseAuth.ts` | Re-exporta `useSupabaseAuth` do contexto |
| `useTabUrl` | `hooks/useTabUrl.ts` | Gerencia URL de abas |

---

### `useProducts` — Detalhado

**Retorna:**
```ts
{
    products: Product[];        // filteredProducts
    allProducts: Product[];     // todos sem filtro
    isLoading: boolean;
    error: string | null;
    filters: ProductFiltersState;
    handleFilterChange(newFilters): void;
    refetch(): void;
    deleteProduct(id): Promise<boolean>;
}
```

**Filtros client-side** (aplicados após fetch):
- `search` → filtra por `name` ou `sku` (case-insensitive)
- `status` → filtra por `ProductStatus` (`'all'` = sem filtro)

**⚠️ Busca todos os produtos de uma vez** — sem paginação server-side
**⚠️ `deleteProduct` chama `refetch` automaticamente** após deletar

---

### `useCatalog` — Detalhado

**Opções:** `{ initialFilters?, pageSize? }`

**Responsabilidades:**
1. `loadSettings()` — carrega `CatalogSettings` via `catalogConfigService`
2. Carrega produtos via `catalogService` com filtros
3. `loadMetadata()` — carrega metadata do catálogo (SEO, etc.)

**⚠️ Usado pela homepage pública** e `CustomerCatalogPage`

---

### `useShareUrl` — Detalhado

**Plataformas:** `'whatsapp' | 'facebook' | 'twitter' | 'email' | 'copy'`

| Método | O que faz |
|--------|-----------|
| `generateShareUrl(platform, options)` | Gera URL sem abrir |
| `shareUrl(platform, options)` | Gera URL e abre em nova aba |
| `copyToClipboard(text)` | Copia via `navigator.clipboard` |
| `canUseNativeShare()` | Verifica se Web Share API está disponível |
| `nativeShare(options)` | Usa `navigator.share()` (mobile) |

**⚠️ `'copy'` platform** → chama `copyToClipboard` em vez de abrir janela
**⚠️ `nativeShare` só funciona em HTTPS** e mobile

---

### `useEffectiveCustomerType` — Detalhado

**Problema que resolve:** Admin pode pré-visualizar o catálogo como cliente varejo/revenda/atacado.

```ts
// customer.customer_type === 'ADMIN' && customer.admin_preview_type === 'wholesale'
// → retorna 'wholesale' (não 'ADMIN')
useEffectiveCustomerType() → 'retail' | 'resale' | 'wholesale'
```

**Funções auxiliares (não hooks):**
```ts
getPriceField('retail')    → 'price_retail'
getPriceField('resale')    → 'price_reseller'
getPriceField('wholesale') → 'price_wholesale'

getProductPrice(product, 'resale') → product.price_reseller || product.price_retail || 0
getEffectivePrice(product, customer) → preço correto baseado no customer object
```

**⚠️ `getEffectivePrice`** — use quando não pode usar hooks (ex: callbacks, funções puras)

---

## 📄 `ProductDetailPage` — Detalhado

**Arquivo:** `pages/admin/products/ProductDetailPage.tsx`
**Rota:** `/admin/products/:id`
**Propósito:** Página unificada de edição de produto + gestão de unidades físicas (IMEI)

### Abas
- **Aba "Produto"** → `ProductForm` (edição dos dados do produto)
- **Aba "Unidades"** → `UnitList` (lista de IMEIs) + `UnitForm` (adicionar nova unidade)

### Estado
```ts
const [product, setProduct] = useState<Product | null>(null);
const [units, setUnits] = useState<Unit[]>([]);
const [activeTab, setActiveTab] = useState<TabType>('product' | 'units');
const [showUnitForm, setShowUnitForm] = useState(false);
```

### Handlers
| Handler | O que faz |
|---------|-----------|
| `fetchProduct()` | Carrega produto por `params.id` |
| `fetchUnits()` | Carrega unidades via `unitService.listByProduct(id)` |
| `handleProductSubmit(data)` | Salva edições do produto |
| `handleUnitSubmit(data)` | Cria nova unidade → refetch |
| `handleDeleteUnit(unit)` | Deleta unidade → refetch |
| `handleCancel()` | Volta para `/admin/products` |

**⚠️ Só carrega unidades** quando aba "Unidades" está ativa (lazy load)

---

## 📋 `UnitForm` — Detalhado

**Arquivo:** `components/units/UnitForm.tsx`
**Props:** `{ productId, initialData?, onSubmit, onCancel, isLoading? }`

### Fluxo de inicialização
1. `loadConfig()` → busca produto por `productId` → busca categoria → obtém `CategoryConfig`
2. Cria schema dinâmico: `createUnitSchema({ categoryConfig, condition })`
3. Usa `react-hook-form` com `zodResolver(schema)`

**⚠️ Schema recriado** quando `condition` muda (campo no formulário)
**⚠️ Campos exibidos** dependem do `CategoryConfig` (Traffic Light)

---

## 📋 `ProductListPage` — Detalhado

**Arquivo:** `pages/admin/products/ProductListPage.tsx`
**Rota:** `/admin/products`

### Botões de ação
| Botão | Ação |
|-------|------|
| **Exportar Catálogo** (roxo) | Abre `ExportCatalogModal` |
| **Cadastro em Massa** (verde) | Navega para `/admin/products/bulk` |
| **Novo Produto** (azul) | Navega para `/admin/products/new` |

**Usa:** `useProducts` hook, `ProductFilters`, `ProductList`, `ExportCatalogModal`
**⚠️ Delete usa `window.confirm`** — sem modal customizado

---

## 💾 `backup-daily.ps1` — Script de Backup

**Localização:** raiz do projeto
**Como executar:** `.\backup-daily.ps1` no PowerShell

**O que faz:**
1. Verifica se há mudanças (`git status --porcelain`)
2. Se sim: `git add .` → `git commit -m "🔄 Backup Diário - YYYY-MM-DD às HH:mm"` → `git tag -a backup-YYYY-MM-DD`
3. Se não: exibe mensagem "Nenhuma mudança detectada"
4. Lista os últimos 5 backups (`git tag -l "backup-*"`)

**⚠️ Cria tag anotada** (`-a`) — inclui mensagem e data
**⚠️ Faz `git add .`** — inclui TODOS os arquivos modificados
**⚠️ Não faz `git push`** — apenas commit local

---

## 🔑 VARIÁVEIS DE AMBIENTE

| Variável | Onde usar | O que faz |
|----------|-----------|-----------|
| `VITE_SUPABASE_URL` | `.env` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Chave anônima do Supabase |
| `VITE_DEV_MODE` | `.env.local` | `true` = pula autenticação (desenvolvimento) |
| `VITE_GEMINI_API_KEY` | `.env` | Chave da API Gemini (geração de SEO) |

**⚠️ `VITE_DEV_MODE=true`** — nunca usar em produção, pula toda autenticação
**⚠️ Arquivo `.env`** — não commitar (está no `.gitignore`)

---

## 🏗️ ARQUITETURA DE COMPONENTES — Hierarquia

```
AdminLayout
└── [Página Admin]
    ├── ProductListPage
    │   ├── ProductFilters
    │   ├── ProductList
    │   │   └── ProductCard (admin)
    │   └── ExportCatalogModal
    ├── ProductDetailPage
    │   ├── ProductForm
    │   │   ├── ProductBasicInfo
    │   │   ├── ProductSpecifications
    │   │   │   ├── BrandSelect
    │   │   │   ├── ModelSelect
    │   │   │   ├── ColorSelect
    │   │   │   ├── RamSelect
    │   │   │   ├── CapacitySelect
    │   │   │   └── VersionSelect
    │   │   └── EANInput
    │   ├── UnitList
    │   └── UnitForm
    └── [Settings Pages]
        ├── BrandsPage → BrandModal
        ├── ModelsPage → ModelModal (+ ColorImageManager)
        └── ColorsPage → ColorModal

[Catálogo Público]
└── CustomerCatalogPage
    ├── ModernProductCard (novo)
    └── ProductCard (legado)

PDVPage (standalone, sem AdminLayout)
```

---

## 🛍️ `types/product.ts` — Tipo `Product` Completo

**⚠️ REGRA CRÍTICA: Todos os preços são em CENTAVOS (integer)**
```ts
// R$ 10,50 → 1050 (centavos)
// Nunca armazenar como float
```

### Interface `Product`

| Campo | Tipo | Observação |
|-------|------|-----------|
| `id` | `string` | UUID |
| `model_id` | `string` | FK → `models` (source of truth) |
| `model` | `string` | Nome denormalizado para display |
| `category_id` | `string?` | Override do modelo |
| `brand` | `string?` | Override do modelo |
| `name` | `string` | Nome do produto |
| `sku` | `string` | Código único |
| `price_cost` | `number` | Custo em centavos |
| `price_retail` | `number` | Varejo em centavos |
| `price_reseller` | `number` | Revenda em centavos |
| `price_wholesale` | `number` | Atacado em centavos |
| `images` | `string[]` | URLs ou blob URLs |
| `eans` | `string[]` | Códigos EAN-13 |
| `ncm` | `string?` | 8 dígitos — fiscal |
| `cest` | `string?` | 7 dígitos — fiscal |
| `origin` | `ProductOrigin?` | Origem da mercadoria (0-8) |
| `weight_kg` | `number?` | Peso em kg |
| `dimensions` | `ProductDimensions?` | `{width_cm, height_cm, depth_cm}` |
| `specs` | `Record<string, any>` | JSONB flexível por categoria |
| `status` | `ProductStatus` | `active`, `inactive`, `draft` |
| `track_inventory` | `boolean` | Se true, controla estoque |
| `stock_quantity` | `number?` | Null se `track_inventory=false` |
| `is_gift` | `boolean?` | Brinde → desconto 100% automático no PDV |
| `warranty_type` | `WarrantyType` | `'brand'`, `'category'`, `'custom'` |
| `warranty_template_id` | `string?` | Só quando `warranty_type='custom'` |
| `description` | `string?` | HTML/Rich Text para SEO |
| `slug` | `string?` | URL-friendly |
| `meta_title` | `string?` | Máx 60 chars |
| `meta_description` | `string?` | Máx 160 chars |
| `keywords` | `string[]?` | Tags para busca/SEO |
| `created` | `string` | ISO timestamp |
| `updated` | `string` | ISO timestamp |

### `ProductOrigin` — Enum Fiscal
```ts
enum ProductOrigin {
    NATIONAL = '0',                    // Nacional
    FOREIGN_DIRECT = '1',              // Estrangeira - Importação direta
    FOREIGN_INTERNAL = '2',            // Estrangeira - Adquirida no mercado interno
    NATIONAL_FOREIGN_40 = '3',         // Nacional com conteúdo estrangeiro > 40%
    NATIONAL_FOREIGN_70 = '4',         // Nacional com conteúdo estrangeiro <= 40%
    NATIONAL_IMPORT_NO_SIMILAR = '5',  // Nacional com importação sem similar
    FOREIGN_NO_SIMILAR = '6',          // Estrangeira sem similar nacional
    FOREIGN_INDUSTRIALIZATION = '7',   // Estrangeira - Industrialização no Brasil
    NATIONAL_FOREIGN_70_NO_SIMILAR = '8'
}
```

**⚠️ `is_gift=true`** → PDV aplica desconto de 100% automaticamente
**⚠️ `specs` é JSONB** → query com `specs->>'ram'` no Supabase
**⚠️ `model_id` é a fonte de verdade** — `brand` e `category_id` no produto são overrides

---

## 💰 `types/sale.ts` — Sistema de Vendas (PDV)

### `PaymentMethod`
```ts
{
    method: 'money' | 'credit' | 'debit' | 'pix';
    amount: number;           // Valor BASE em centavos (sem taxa)
    installments?: number;    // Apenas para 'credit'
    fee_percentage?: number;  // Taxa aplicada (%)
    fee_amount?: number;      // Valor da taxa em centavos
    total_with_fee: number;   // amount + fee_amount
}
```

### `SaleItem` (Carrinho)
```ts
{
    id: string;              // UUID temporário (gerado no frontend)
    product_id: string;
    product_name: string;
    product_sku?: string;
    quantity: number;
    unit_price: number;      // em centavos
    unit_cost: number;       // price_cost do produto (em centavos)
    discount: number;        // desconto por unidade (em centavos)
    subtotal: number;        // unit_price × quantity
    total: number;           // subtotal - (discount × quantity)
    is_gift: boolean;
    track_inventory: boolean;
    stock_quantity?: number;
}
```

### `Sale` (Venda Completa)
```ts
{
    id: string;
    customer_id: string;      // OBRIGATÓRIO
    seller_id?: string;
    subtotal: number;         // em centavos
    discount_total: number;   // em centavos
    total: number;            // em centavos
    cost_total: number;       // em centavos
    profit: number;           // em centavos
    payment_methods: PaymentMethod[];
    notes?: string;
    status: 'completed' | 'cancelled' | 'refunded';
    delivery_type?: 'store_pickup' | 'store_delivery' | 'hybrid_delivery';
    delivery_person_id?: string;
    delivery_cost_store?: number;    // custo para a loja (em centavos)
    delivery_cost_customer?: number; // custo para o cliente (em centavos)
    delivery_total?: number;         // total de entrega (em centavos)
    promotional_discount?: number;   // em centavos
    created_at: string;
    updated_at: string;
}
```

### `DeliveryCredit`
```ts
{
    id: string;
    delivery_person_id: string;
    sale_id: string;
    amount: number;           // em centavos
    delivery_type: DeliveryType;
    status: 'pending' | 'paid' | 'cancelled';
    paid_at?: string;
}
```

**⚠️ Todos os valores monetários em centavos** — nunca float
**⚠️ `SaleItem.id`** — UUID temporário gerado no frontend, não persiste no banco
**⚠️ `delivery_cost_store`** — custo que a loja paga ao entregador (vai para `delivery_credits`)
**⚠️ `delivery_cost_customer`** — custo cobrado do cliente (vai para o total da venda)

---

## 🏪 `services/saleService.ts` — Serviço de Vendas

**Exporta funções individuais** (não classe)
**Tabelas:** `sales`, `sale_items`, `delivery_credits`
**⚠️ Sem filtro por `company_id`** — vendas são globais no schema atual

### `createSale(saleInput)` — Fluxo Crítico
```
1. calculateSaleTotals(items) → {subtotal, discount_total, total, cost_total, profit}
2. INSERT em 'sales' → obtém sale.id
3. INSERT em 'sale_items' (todos de uma vez)
   ↳ Se falhar → DELETE sale (rollback manual)
4. Se delivery_person_id + delivery_total > 0:
   → INSERT em 'delivery_credits' (status='pending')
   ↳ Se falhar → apenas loga, NÃO faz rollback da venda
```

**⚠️ Rollback parcial** — se `sale_items` falhar, a venda é deletada. Mas se `delivery_credits` falhar, a venda permanece.

### Funções

| Função | O que faz |
|--------|-----------|
| `createSale(input)` | Cria venda + itens + crédito de entrega |
| `getSaleById(id)` | Venda com join em `customers` e `team_members` |
| `getSales(filters?)` | Lista vendas com join + **N+1 para items** |
| `cancelSale(id)` | `status='cancelled'` + cancela `delivery_credits` |
| `refundSale(id)` | `status='refunded'` + cancela `delivery_credits` |
| `getSalesSummary(filters?)` | `{total_sales, total_revenue, total_profit, average_ticket, profit_margin}` |

**⚠️ `getSales` tem problema N+1** — busca items de cada venda separadamente (um query por venda)
**⚠️ `getSalesSummary` só conta vendas `completed`** — cancelladas e refundadas são ignoradas

### Tabelas do banco

**`sales`:**
| Coluna | Tipo |
|--------|------|
| `id` | UUID PK |
| `customer_id` | UUID FK customers |
| `seller_id` | UUID FK team_members |
| `subtotal`, `discount_total`, `total`, `cost_total`, `profit` | INTEGER (centavos) |
| `payment_methods` | JSONB (array de PaymentMethod) |
| `status` | TEXT (`completed`, `cancelled`, `refunded`) |
| `delivery_type`, `delivery_person_id` | TEXT/UUID |
| `delivery_cost_store`, `delivery_cost_customer`, `delivery_total` | INTEGER |
| `notes` | TEXT |

**`sale_items`:**
| Coluna | Tipo |
|--------|------|
| `id` | UUID PK |
| `sale_id` | UUID FK sales |
| `product_id` | UUID FK products |
| `product_name`, `product_sku` | TEXT |
| `quantity` | INTEGER |
| `unit_price`, `unit_cost`, `discount`, `subtotal`, `total` | INTEGER (centavos) |
| `is_gift` | BOOLEAN |

---

## 👤 `services/customers.ts` — Serviço de Clientes

**Exporta:** `customerService` (instância de `CustomerService`)
**Tabela:** `customers`
**Cache:** 5 minutos (igual ao `TeamService`)
**⚠️ `TEMP_COMPANY_ID = 'mercado-do-vale'`**

| Método | O que faz |
|--------|-----------|
| `list(filters?)` | Lista com filtros: `search` (nome/CPF/email), `is_active`, datas |
| `getById(id)` | Cliente por ID |
| `getByCpfCnpj(cpfCnpj)` | Cliente por CPF/CNPJ |
| `create(input)` | Cria cliente → limpa cache |
| `update(id, input)` | Atualiza cliente → limpa cache |
| `softDelete(id)` | `is_active = false` |
| `delete(id)` | Hard delete → limpa cache |
| `search(query)` | Busca por nome/CPF/email (chama `list({search: query})`) |
| `getActiveCount()` | Conta clientes ativos |
| `clearCache()` | Limpa cache manualmente |

**`CustomerFilters`:** `{ search?, is_active?, created_after?, created_before? }`
**⚠️ `search` usa `.or(name.ilike, cpf_cnpj.ilike, email.ilike)`** — busca nos 3 campos
**⚠️ `getById` não usa `company_id`** — busca global por ID

### Tabela `customers`
| Coluna | Tipo | Observação |
|--------|------|-----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies |
| `name` | TEXT | Nome completo |
| `cpf_cnpj` | TEXT | CPF ou CNPJ |
| `email` | TEXT | |
| `phone` | TEXT | |
| `is_active` | BOOLEAN | Soft delete |
| `customer_type` | TEXT | `'retail'`, `'resale'`, `'wholesale'`, `'ADMIN'` |
| `admin_preview_type` | TEXT | Tipo de preview para admin |
| `created_at` | TIMESTAMPTZ | |

---

## 🖥️ `PDVPage` — Ponto de Venda

**Arquivo:** `pages/pdv/PDVPage.tsx`
**Rota:** `/admin/pdv`
**Layout:** Standalone (sem `AdminLayout`, tela cheia)
**Tamanho:** 497 linhas, 20KB

### Estado Principal
```ts
const [cart, setCart] = useState<SaleItem[]>([]);
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
const [paymentFees, setPaymentFees] = useState<PaymentFee[]>([]);
const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
const [warrantyData, setWarrantyData] = useState<WarrantyTagData | null>(null);
```

### Handlers Críticos

| Handler | O que faz |
|---------|-----------|
| `fetchPaymentFees()` | Carrega taxas de pagamento do banco |
| `handleAddToCart(product, qty)` | Adiciona produto ao carrinho (agrupa se já existe) |
| `handleUpdateQuantity(itemId, qty)` | Atualiza quantidade de item |
| `handleRemoveItem(itemId)` | Remove item do carrinho |
| `handleClearCart()` | Limpa carrinho + pagamentos |
| `handleAddPayment(payment)` | Adiciona método de pagamento |
| `handleRemovePayment(index)` | Remove método de pagamento |
| `handleDeliveryChange(type, personId, costStore, costCustomer)` | Atualiza dados de entrega |
| `handleSelectInstallment(installments, amount, feeAmount)` | Seleciona parcelamento no crédito |
| `handleFinalizeSale()` | **Finaliza a venda** |
| `generateWarrantyTerm(sale, customer, items)` | Gera dados para o termo de garantia |
| `handleWarrantyDeliveryTypeChange(type)` | Atualiza tipo de entrega no termo |
| `handleGenerateWarranty(signature)` | Salva termo de garantia com assinatura |

### `handleFinalizeSale()` — Fluxo
```
1. Valida: carrinho não vazio + cliente selecionado + pagamentos cobrem o total
2. createSale(saleInput) → Sale
3. generateWarrantyTerm(sale, customer, items) → WarrantyTagData
4. Exibe modal de garantia para assinatura
5. handleGenerateWarranty(signature) → salva documento
6. Limpa carrinho e navega para /admin/pdv
```

**⚠️ `handleAddToCart`** — se produto já está no carrinho, incrementa quantidade (não duplica)
**⚠️ `is_gift=true`** → `unit_price` é mantido, mas `discount = unit_price` (desconto 100%)
**⚠️ Pagamentos múltiplos** — venda pode ter vários métodos (ex: parte em dinheiro + parte no crédito)
**⚠️ `handleSelectInstallment`** — cria `PaymentMethod` com `method='credit'`, `installments`, `fee_percentage`, `fee_amount`, `total_with_fee`

---

## 🧩 `services/custom-fields.ts` — Campos Customizados

**Exporta:** `customFieldsService` (instância de `CustomFieldsService`)
**Tabela:** `custom_fields`
**Cache:** 5 minutos

### `CustomField` — Tipos de campo disponíveis

**`field_type`** (18 tipos):
| Tipo | Descrição |
|------|-----------|
| `text` | Texto simples |
| `textarea` | Texto longo |
| `capitalize` | Primeira letra maiúscula |
| `uppercase` | Tudo maiúsculo |
| `lowercase` | Tudo minúsculo |
| `titlecase` | Cada palavra maiúscula |
| `sentence` | Primeira letra de cada frase |
| `slug` | URL-friendly |
| `phone` | Telefone formatado |
| `cpf` | CPF formatado |
| `cnpj` | CNPJ formatado |
| `ncm` | NCM fiscal (8 dígitos) |
| `ean13` | EAN-13 (13 dígitos) |
| `cest` | CEST fiscal (7 dígitos) |
| `brl` | Moeda BRL |
| `select` | Seleção de opções |
| `checkbox` | Booleano |
| `table_relation` | Relação com outra tabela |

**`category`:** `'basic' | 'spec' | 'price' | 'fiscal' | 'logistics'`

### Métodos

| Método | O que faz |
|--------|-----------|
| `list()` | Lista todos os campos da empresa (com cache) |
| `getByCategory(category)` | Campos por categoria |
| `getById(id)` | Campo por ID |
| `getByKey(key)` | Campo por chave |
| `create(input)` | Cria campo → limpa cache |
| `update(id, input)` | Atualiza campo (system fields: só label/placeholder/help_text/options/display_order) |
| `delete(id)` | Remove campo (system fields NÃO podem ser deletados) |
| `reorder(fieldIds[])` | Reordena campos (atualiza `display_order`) |

**`TableConfig`** (para `table_relation`):
```ts
{ table_name: string, value_column: string, label_column: string, order_by?: string }
```

**⚠️ System fields (`is_system=true`)** — não podem ser deletados e só permitem editar label/placeholder/help_text/options/display_order
**⚠️ `getCompanyId`** — tenta auth context primeiro, fallback para primeiro registro da tabela `companies`
**⚠️ Usado por:** `ModelModal`, `ProductForm`, `CustomFieldsLibraryPage`, `FieldConfigPage`

---

## 🏢 `services/companyService.ts` — Dados da Empresa

**Exporta:** `getCompanyData`, `saveCompanyData`, `clearCompanyData`
**Tabela:** `company_settings` (registro único global)

| Função | O que faz |
|--------|-----------|
| `getCompanyData()` | Busca dados da empresa (retorna `defaultCompany` se vazio) |
| `saveCompanyData(data)` | Upsert: atualiza se existe, insere se não existe |
| `clearCompanyData()` | Deleta todos os registros (hard delete) |

**Mapeamento de campos** (`rowToCompany` / `companyToRow`):
| Banco (`snake_case`) | TypeScript (`camelCase`) |
|---------------------|------------------------|
| `razao_social` | `razaoSocial` |
| `state_registration` | `stateRegistration` |
| `situacao_cadastral` | `situacaoCadastral` |
| `data_abertura` | `dataAbertura` |
| `address_zip_code` | `address.zipCode` |
| `address_street` | `address.street` |
| `social_instagram` | `socialMedia.instagram` |
| `pix_key` | `pixKey` |
| `pix_key_type` | `pixKeyType` |
| `pix_beneficiary_name` | `pixBeneficiaryName` |
| `google_reviews_link` | `googleReviewsLink` |
| `business_hours` | `businessHours` |
| `internal_notes` | `internalNotes` |

**Campos completos da tabela `company_settings`:**
`name`, `razao_social`, `cnpj`, `state_registration`, `cnae`, `situacao_cadastral`, `data_abertura`, `porte`, `phone`, `email`, `logo`, `favicon`, `address_*` (7 campos), `address_lat/lng`, `social_*` (4 campos), `google_reviews_link`, `pix_key`, `pix_key_type`, `pix_beneficiary_name`, `bank_name`, `bank_agency`, `bank_account`, `business_hours`, `description`, `internal_notes`

**⚠️ Registro único** — `saveCompanyData` faz `SELECT id LIMIT 1` antes de decidir INSERT vs UPDATE
**⚠️ `clearCompanyData` usa `.neq('id', '00000000-...')`** — deleta todos os registros reais

---

## 📄 `services/warrantyDocumentService.ts` — Documentos de Garantia

**Exporta:** `warrantyDocumentService`
**Tabela:** `warranty_documents`
**⚠️ `TEMP_COMPANY_ID = 'mercado-do-vale'`**

| Método | O que faz |
|--------|-----------|
| `create(input)` | Cria documento de garantia |
| `getBySaleId(saleId)` | Busca documento por ID da venda |
| `getById(id)` | Busca documento por ID |
| `list()` | Lista todos os documentos da empresa |
| `update(id, input)` | Atualiza documento |
| `remove(id)` | Remove documento |

**`WarrantyDocumentInput`:**
```ts
{
    sale_id: string;
    customer_id: string;
    delivery_type: DeliveryTypeWarranty;
    customer_signature: string;  // Base64 da assinatura
    warranty_content: string;    // HTML do documento gerado
}
```

**⚠️ `customer_signature`** — imagem Base64 da assinatura digital do cliente
**⚠️ `warranty_content`** — HTML completo do termo de garantia com dados preenchidos
**⚠️ Chamado por:** `PDVPage.handleGenerateWarranty()` após assinatura

---

## 📐 `utils/calculateAveragePrice.ts` — Fórmula de Preço Médio

**Exporta:** `calculateAveragePrice`, `calculateAllAveragePrices`

### Fórmula
```
avgPrice = (currentStock × currentPrice + newQuantity × newPrice) / (currentStock + newQuantity)
```
Arredondado para 2 casas decimais: `Math.round(value * 100) / 100`

### `calculateAveragePrice(input)` → `AveragePriceResult`
```ts
// Input
{ currentStock: number, currentPrice: number, newQuantity: number, newPrice: number }

// Output
{ averagePrice: number, totalQuantity: number, priceChange: number, percentageChange: number }
```

**Caso especial:** se `currentStock === 0 || currentPrice === 0` → retorna `newPrice` diretamente (primeiro produto)

### `calculateAllAveragePrices(currentStock, currentPrices, newQuantity, newPrices)`
Aplica `calculateAveragePrice` para os 4 tipos de preço simultaneamente:
`price_cost`, `price_retail`, `price_reseller`, `price_wholesale`

**⚠️ Chamado por:** `averagePriceService.updateAveragePrices()`

---

## 📖 `config/field-dictionary.ts` — Dicionário de Campos

**Propósito:** Fonte única de verdade para metadados de campos de formulário (label, placeholder, formato)
**Usado por:** `SmartInput` component

### `FieldFormat` — 20+ formatos disponíveis

| Formato | Resultado |
|---------|-----------|
| `capitalize` | `"iphone 14"` → `"Iphone 14"` |
| `uppercase` | `"iphone"` → `"IPHONE"` |
| `lowercase` | `"IPHONE"` → `"iphone"` |
| `titlecase` | `"iphone 14 pro"` → `"Iphone 14 Pro"` |
| `sentence` | `"hello. world."` → `"Hello. World."` |
| `slug` | `"iPhone 14 Pro"` → `"iphone-14-pro"` |
| `phone` | `"11987654321"` → `"(11) 98765-4321"` |
| `cpf` | `"12345678901"` → `"123.456.789-01"` |
| `cnpj` | `"12345678000190"` → `"12.345.678/0001-90"` |
| `cep` | `"12345678"` → `"12345-678"` |
| `brl` | `"1234.56"` → `"R$ 1.234,56"` |
| `numeric` | Remove não-números |
| `alphanumeric` | Remove caracteres especiais |
| `date_br` | `"31/01/2026"` |
| `ncm` | 8 dígitos |
| `ean13` | 13 dígitos |
| `cest` | 7 dígitos |
| `currency` | Usa `CurrencyInput` (centavos) |
| `imei` | Usa `IMEIInput` (15 dígitos) |
| `selector` | Usa componente dedicado |
| `none` | Sem formatação |

### `FieldDefinition`
```ts
{ label: string, placeholder: string, format: FieldFormat, required?: boolean, description?: string, minLength?: number, maxLength?: number }
```

### `FIELD_DICTIONARY`
Objeto com 20+ campos pré-definidos: `name`, `sku`, `description`, `brand`, `model`, `color`, `storage`, `ram`, `version`, `battery_health`, `imei_1`, `imei_2`, `serial_number`, `phone`, `cpf`, `cnpj`, `cep`, `ncm`, `cest`, `slug`, `meta_title`, `meta_description`, etc.

**⚠️ `getFieldDefinitionRuntime(name)`** — busca campo no dicionário em runtime
**⚠️ `applyFieldFormat(value, format)`** — aplica formatação ao valor
**⚠️ Campos `currency`, `imei`, `selector`** — NÃO usar com SmartInput, usar componentes dedicados

---

## 📋 `config/product-fields.ts` — Campos do Produto

**Propósito:** Array de todos os campos do produto com categorias — usado para configuração de campos por categoria

### `PRODUCT_FIELDS` — Campos disponíveis

| Categoria | Campos |
|-----------|--------|
| `basic` | `category_id`, `brand`, `model`, `name`, `sku`, `description`, `images` |
| `spec` | `specs.imei1`, `specs.imei2`, `specs.serial`, `specs.color`, `specs.storage`, `specs.ram`, `specs.version`, `specs.battery_health`, `specs.battery_mah`, `specs.display` |
| `price` | `price_cost`, `price_retail`, `price_reseller`, `price_wholesale` |

### `UNIQUE_FIELDS` — Campos que NÃO são auto-preenchidos do template do modelo

```ts
// Variação (diferem por produto do mesmo modelo)
'ram', 'storage', 'color',
// Identificadores únicos por unidade
'imei1', 'imei2', 'serial', 'ean', 'sku'
```

**⚠️ Quando o EAN scanner preenche o formulário** via `template_values`, esses campos são ignorados
**⚠️ Funções auxiliares:** `getFieldsByCategory()`, `getBasicFields()`, `getSpecFields()`, `getPriceFields()`

---

## 🧠 `components/ui/SmartInput` — Input Inteligente

**Arquivo:** `components/ui/SmartInput.tsx`
**Props:** `{ control: Control<T>, name: Path<T>, className?, disabled? }`

### Como funciona
1. Busca `FieldDefinition` no `FIELD_DICTIONARY` pelo `name`
2. Se não encontrado → `console.warn` e retorna `null`
3. Integra com `react-hook-form` via `Controller`
4. Aplica `applyFieldFormat(value, fieldDef.format)` a cada keystroke
5. Preserva posição do cursor após formatação (`setSelectionRange`)

### O que renderiza
- Label com asterisco se `required`
- Input com placeholder do dicionário
- Mensagem de erro do react-hook-form
- Descrição do campo (se sem erro)
- Contador de caracteres (se `maxLength` definido)

**⚠️ Só funciona com campos cadastrados no `FIELD_DICTIONARY`**
**⚠️ Para campos `currency`, `imei`, `selector`** — usar `CurrencyInput`, `IMEIInput`, `*Select` respectivamente
**⚠️ Preserva cursor position** — usa `setTimeout(0)` para restaurar após formatação assíncrona

---

## 🔍 REVISÃO SISTEMÁTICA — Arquivos Adicionais Documentados

### `services/catalogConfigService.ts` — Configurações do Catálogo

**Exporta:** `catalogConfigService`
**Tabela:** `catalog_settings` (por `user_id`), `category_display_config`
**Cache:** 15 minutos (Map por `settings_${userId}`)

| Método | O que faz |
|--------|-----------|
| `getSettings(userId?)` | Busca settings por user_id (retorna `DEFAULT_CATALOG_SETTINGS` se não autenticado) |
| `saveSettings(settings)` | Upsert com `onConflict: 'user_id'` |
| `getCategoryConfig(categoryId)` | Config de exibição de uma categoria |
| `getAllCategoryConfigs()` | Todas as configs ordenadas por `display_order` |
| `saveCategoryConfig(config)` | Upsert com `onConflict: 'category_id'` |
| `applyVisibilityRules(products, settings)` | Filtra produtos por `hide_inactive`, `hide_out_of_stock`, `hide_zero_price`, `min_stock_to_show` |
| `applyCategoryVisibilityRules(categories, settings)` | Filtra categorias por `hide_empty_categories`, `hide_categories_no_stock` |
| `clearCache()` | Limpa todo o cache |

**⚠️ `hide_categories_no_stock`** — faz query por categoria (N queries), pode ser lento
**⚠️ `stock_quantity=null`** — produtos sem controle de estoque são tratados como disponíveis
**⚠️ Usado por:** `useCatalog` hook, `CustomerCatalogPage`

---

### `services/catalogEditorService.ts` — Editor de Catálogo (Draft/Published)

**Exporta:** `catalogEditorService`
**Tabelas:** `catalog_settings`, `catalog_banners`
**Sistema:** Draft → Published (dois estados separados)

| Método | O que faz |
|--------|-----------|
| `loadCatalogState(mode)` | Carrega banners + settings do modo `'draft'` ou `'published'` |
| `saveDraft(state)` | Salva rascunho (banners + settings com `is_draft=true`) |
| `publish()` | Copia draft para published (`is_draft=false`, seta `published_at`) |
| `discardDraft()` | Descarta rascunho (restaura estado published) |
| `copyPublishedToDraft()` | Copia versão publicada para draft (para começar nova edição) |

**⚠️ `publish()`** — copia banners do draft para published em sequência
**⚠️ `discardDraft()`** — chama `copyPublishedToDraft()` internamente
**⚠️ Usado por:** `CatalogConfigPage` (editor de catálogo admin)

---

### `services/catalogShareService.ts` — Compartilhamento do Catálogo

**Exporta:** `catalogShareService`

| Método | O que faz |
|--------|-----------|
| `generateCatalogText(options)` | Gera texto formatado do catálogo para compartilhamento |
| `shareViaWhatsApp(options)` | Gera texto + abre WhatsApp |
| `copyToClipboard(options)` | Gera texto + copia para clipboard |
| `generatePDF(options)` | Gera HTML + abre janela de impressão |
| `generatePDFHTML(products, company, options)` | Gera HTML completo do catálogo para PDF |
| `trackShare(type, scope, scopeValue?)` | Registra evento de compartilhamento no banco |

**`ShareOptions`:** `{ categoryId?, productId?, customerType?, includePrice?, includePriceRetail? }`
**⚠️ `generatePDF`** — usa `window.print()` (não gera PDF real, abre diálogo de impressão)
**⚠️ `trackShare`** — registra em tabela de analytics (não bloqueia se falhar)

---

### `services/catalogSectionsService.ts` — Seções do Catálogo

**Exporta:** `catalogSectionsService`
**Tabela:** `catalog_sections`
**Cache:** 5 minutos

| Método | O que faz |
|--------|-----------|
| `getSections(userId?)` | Lista todas as seções do usuário |
| `getActiveSections(userId?)` | Só seções habilitadas |
| `getSection(id)` | Seção por ID |
| `createSection(data)` | Cria nova seção |
| `updateSection(id, updates)` | Atualiza seção |
| `deleteSection(id)` | Remove seção |
| `reorderSections(sectionIds[])` | Reordena (N updates sequenciais) |
| `getProductsForSection(section)` | Busca produtos da seção com filtros de `SectionType` |

**`SectionType`:** `'featured'`, `'new_arrivals'`, `'on_sale'`, `'by_category'`, `'manual'`
**⚠️ `getProductsForSection`** — aplica `applySectionTypeFilter` e `applySorting` na query

---

### `services/monitoringService.ts` — Monitoramento do Sistema

**Exporta:** `monitoringService`
**Tabelas:** `system_logs`, `performance_metrics`

| Método | O que faz |
|--------|-----------|
| `getSystemStatus()` | Status completo: database + performance + errors |
| `getDatabaseStatus()` | Testa conexão com Supabase + conta registros |
| `getPerformanceMetrics()` | Métricas de performance do sistema |
| `getRecentErrors(limit=50)` | Últimos N erros do banco |
| `calculateOverallHealth(db, perf, errors)` | Retorna `'healthy'`, `'warning'` ou `'critical'` |
| `logError(error, context?)` | Registra erro com stack trace |
| `logWarning(message, context?)` | Registra warning |
| `logInfo(message, context?)` | Registra info |
| `recordMetric(type, value, metadata?)` | Registra métrica de performance |
| `cleanOldLogs()` | Remove logs com mais de 30 dias |
| `cleanOldMetrics()` | Remove métricas com mais de 7 dias |

**⚠️ Intercepta erros globais** — registra `window.addEventListener('error')` e `unhandledrejection` automaticamente
**⚠️ Usado por:** `SystemStatusPage` (admin)

---

### `services/typeUpgradeRequests.ts` — Solicitações de Upgrade de Tipo

**Exporta funções individuais**
**Tabela:** `customer_type_requests`

| Função | O que faz |
|--------|-----------|
| `createUpgradeRequest(customerId, requestedType)` | Cria solicitação (verifica se já existe pendente) |
| `getCustomerUpgradeRequest(customerId)` | Status atual da solicitação do cliente |
| `getAllUpgradeRequests(status?)` | Lista todas com join em `customers` (admin) |
| `approveUpgradeRequest(requestId, reviewerId)` | Aprova: atualiza `customer_type` + status da solicitação |
| `rejectUpgradeRequest(requestId, reviewerId, reason?)` | Rejeita com motivo opcional |
| `getUpgradeRequestStats()` | `{pending, approved, rejected, total}` |

**`RequestedCustomerType`:** `'resale'` ou `'wholesale'`
**⚠️ `createUpgradeRequest`** — lança erro se já existe solicitação `pending`
**⚠️ `approveUpgradeRequest`** — atualiza `customers.customer_type` diretamente

---

### `services/model-variants.ts` — Variantes de Modelo (Fotos)

**Exporta:** `modelVariantsService`
**Tabelas:** `model_variants`, `model_variant_images`
**Storage:** bucket `product-images`

| Método | O que faz |
|--------|-----------|
| `getOrCreate(params)` | Busca ou cria variante `(model_id, version_id, color_id)` |
| `getWithDetails(variantId)` | Variante com join completo (model, version, color, images) |
| `getByModelId(modelId)` | Todas as variantes de um modelo |
| `remove(variantId)` | Remove variante |
| `getImages(variantId)` | Imagens ordenadas por `display_order` |
| `addImage(input)` | Adiciona imagem à variante |
| `uploadImage(variantId, file, onProgress?)` | Upload para `product-images/{variantId}/{timestamp}.ext` |
| `reorderImages(variantId, imageIds[])` | N updates paralelos de `display_order` |
| `setPrimaryImage(imageId)` | Define `is_primary=true` (não desmarca as outras!) |
| `removeImage(imageId)` | Remove do storage + banco |

**⚠️ `setPrimaryImage`** — só marca a nova como primária, não desmarca as outras
**⚠️ `uploadImage`** — retorna `{success: boolean, image_url?, error?}` (nunca lança)
**⚠️ Usado por:** `ModelModal` (aba de fotos por cor)

---

### `services/bulk-products.ts` — Importação em Massa (Excel)

**Exporta:** `bulkProductService`

| Método | O que faz |
|--------|-----------|
| `parseExcelFile(file)` | Lê Excel via `XLSX`, normaliza colunas para lowercase |
| `validateBulkRows(rows)` | Valida EAN (13 dígitos), IMEI (15 dígitos), serial obrigatório, duplicatas no lote |
| `generatePreview(rows)` | Busca produto base por EAN, mescla com campos únicos |
| `createBulkProducts(previews)` | Cria produtos um a um via `productService.create()` |

**`BulkProductRow`:** `{ ean, imei1?, imei2?, serial?, ... }`
**`BulkUploadResult`:** `{ total, success, failed, errors[] }`
**⚠️ `generatePreview`** — busca produto base por EAN (deve existir no banco)
**⚠️ `createBulkProducts`** — sem rollback parcial (falhas individuais são contadas em `failed`)
**⚠️ Usado por:** `EntradaPage` (cadastro em massa)

---

### `services/documentService.ts` — Documentos da Empresa

**Exporta:** `uploadDocument`, `getDocuments`, `deleteDocument`, `getDocumentUrl`, `formatFileSize`
**Tabela:** `company_documents`
**Storage:** bucket `company-documents`
**Limites:** 10MB por arquivo, máx 20 documentos, apenas PDF

| Função | O que faz |
|--------|-----------|
| `uploadDocument(data)` | Valida + faz upload + salva metadados (rollback se DB falhar) |
| `getDocuments()` | Lista documentos do usuário autenticado |
| `deleteDocument(id)` | Remove do storage + banco |
| `getDocumentUrl(filePath)` | URL assinada válida por **1 hora** |
| `formatFileSize(bytes)` | `"1.5 MB"`, `"512 KB"`, etc. |

**⚠️ `getDocumentUrl`** — URL expira em 1 hora (não cachear)
**⚠️ `uploadDocument`** — rollback manual: se DB falhar, deleta arquivo do storage
**⚠️ Usa `user_id` do auth** — fallback para UUID zero se não autenticado (com `console.warn`)

---

### `services/companySettingsService.ts` — Settings para Recibos

**Exporta:** `companySettingsService`
**Tabela:** `company_settings`
**⚠️ Diferente de `companyService.ts`** — este é mais simples, focado em recibos/PDV

| Método | O que faz |
|--------|-----------|
| `get()` | Busca primeiro registro (retorna `null` se vazio) |
| `update(settings)` | Upsert manual (get → update ou insert) |
| `getDefaults()` | Valores padrão para recibos |

**Defaults:** `company_name='Mercado do Vale'`, `receipt_width='80mm'`, `show_company_info=true`, `footer_text='Obrigado pela preferência!'`
**⚠️ Usado por:** PDV para configurar recibos e documentos

---

### `services/productGrouping.ts` — Agrupamento de Produtos do Catálogo

**Exporta:** `groupProductsByVariants`, `filterAvailableProducts`, `findProductByVariant`, `getDefaultProductFromVariant`

| Função | O que faz |
|--------|-----------|
| `filterAvailableProducts(products)` | Filtra: `status=active` + `stock_quantity>0` (se `track_inventory`) |
| `groupProductsByVariants(products)` | Agrupa por `brand+model`, cria variantes por `ram+storage`, cores por variante |
| `findProductByVariant(group, ram, storage, color)` | Encontra produto específico dentro de um grupo |
| `getDefaultProductFromVariant(variant)` | Primeiro produto da variante |

**`normalizeRAMAndStorage`** — detecta inversão (RAM > Storage) e corrige automaticamente
**`generateGroupKey`** — `brand_model` (lowercase, espaços → hífens)
**`ProductGroup`:** `{ groupKey, brand, model, variants[], allColors[], globalPriceRange, representativeProduct }`
**`ProductVariant`:** `{ ram, storage, colors[], products[], priceRange }`
**⚠️ Usado por:** `ModernProductCard` e catálogo público para exibir variações

---

### `utils/product-name-generator.ts` — Gerador de Nome de Produto

**Exporta:** `generateProductName`, `generatePreviewName`, `getAvailableFieldsForNaming`, `getSeparatorOptions`, `getTemplatePresets`

| Função | O que faz |
|--------|-----------|
| `generateProductName(config, productData)` | Gera nome baseado em `CategoryConfig.auto_name_*` |
| `generatePreviewName(config)` | Preview com dados de exemplo (Apple iPhone 13, 4GB, 128GB...) |
| `getAvailableFieldsForNaming()` | Lista de campos disponíveis para composição do nome |
| `getSeparatorOptions()` | `' '`, `'/'`, `'-'`, `'_'`, `' - '`, `' / '` |
| `getTemplatePresets()` | 4 templates prontos (Simples, Com vírgula, Completo, Compacto) |

**Dois modos:**
1. **Template** (`auto_name_template`): `"{modelo}, {ram}/{armazenamento} - {versao}"` → `"Redmi Note 14, 6GB/256GB - Global"`
2. **Campos** (`auto_name_fields`): array de campos + separador

**Placeholders em português:** `{marca}→brand`, `{modelo}→model`, `{ram}→ram`, `{armazenamento}→storage`, `{cor}→color`, `{versao}→version`, `{bateria}→battery_health`
**⚠️ `generateFromTemplate`** — limpa separadores duplos (`,,`, `//`, `--`, `()` vazios)
**⚠️ Usado por:** `CategoryConfigPage` e `ProductForm` para auto-preencher nome

---

### `utils/cpfCnpjValidation.ts` — Validação Fiscal Brasileira

**Exporta:** `validateCPF`, `validateCNPJ`, `validateCpfCnpj`, `formatCpfCnpj`, `formatPhone`, `validateEmail`

| Função | O que faz |
|--------|-----------|
| `validateCPF(cpf)` | Algoritmo oficial com 2 dígitos verificadores |
| `validateCNPJ(cnpj)` | Algoritmo oficial com pesos `[5,4,3,2,9,8,7,6,5,4,3,2]` |
| `validateCpfCnpj(value)` | Auto-detecta CPF (11 dígitos) ou CNPJ (14 dígitos) |
| `formatCpfCnpj(value)` | `"123.456.789-01"` ou `"12.345.678/0001-90"` |
| `formatPhone(value)` | `"(11) 98765-4321"` (celular) ou `"(11) 3456-7890"` (fixo) |
| `validateEmail(email)` | Regex simples `^[^\s@]+@[^\s@]+\.[^\s@]+$` |

**⚠️ `validateCpfCnpj('')`** → retorna `true` (campo opcional)
**⚠️ Rejeita padrões inválidos** — `111.111.111-11`, `00.000.000/0000-00`, etc.

---

### `utils/warrantyTagReplacement.ts` — Substituição de Tags de Garantia

**Exporta:** `replaceWarrantyTags`, `getWarrantyDeclaration`, `formatWarrantyDate`, `formatWarrantyPhone`, `formatWarrantyCpfCnpj`

| Função | O que faz |
|--------|-----------|
| `replaceWarrantyTags(template, data)` | Substitui `{{tag_name}}` por valores de `WarrantyTagData` |
| `getWarrantyDeclaration(deliveryType)` | Texto de declaração: "retirei na loja" ou "recebi" |
| `formatWarrantyDate(date)` | `"DD/MM/YYYY"` |
| `formatWarrantyPhone(phone)` | `"(11) 98765-4321"` ou `"(11) 3456-7890"` |
| `formatWarrantyCpfCnpj(cpfCnpj)` | `"123.456.789-01"` ou `"12.345.678/0001-90"` |

**⚠️ `replaceWarrantyTags`** — usa `RegExp` com escape de caracteres especiais para cada tag
**⚠️ Usado por:** `PDVPage.generateWarrantyTerm()` para preencher o template HTML

---

### `utils/catalogMessageGenerator.ts` — Gerador de Mensagem de Catálogo

**Exporta:** `generateCatalogMessage`, `generateCategoryMessage`, `generateFullCatalogMessage`

| Função | O que faz |
|--------|-----------|
| `generateCatalogMessage(products, customerType, categoryName?)` | Gera mensagem WhatsApp formatada com emojis |
| `generateCategoryMessage(categoryId, customerType)` | Busca produtos da categoria + gera mensagem |
| `generateFullCatalogMessage(customerType)` | Busca todos os produtos ativos + gera mensagem |

**Formato da mensagem:**
```
📱 *CATÁLOGO - SMARTPHONES*
📅 Data: 18/02/2026

━━━━━━━━━━━━━━━━━━━━━━

1. *iPhone 13*
   📱 4GB/128GB
   💰 R$ 2.500,00 à vista
   💳 10x de R$ 290,00 (R$ 2.900,00)
   🎨 Cores: Azul, Preto
```

**⚠️ `calculateInstallment`** — usa 10x com 16% de juros **hardcoded** (não usa `payment_fees` do banco)
**⚠️ `groupProductsByVariant`** — agrupa por `model+ram+storage`, acumula cores
**⚠️ Diferente de `whatsappMessageGenerator.ts`** — este é para catálogo geral, aquele é para orçamentos individuais

---

## 📊 TABELA FINAL — Todos os Services (54 arquivos)

| Service | Tabela(s) | Tipo | Documentado |
|---------|-----------|------|-------------|
| `addressLookup.ts` | ViaCEP API | Util | ✅ |
| `averagePriceService.ts` | `products` | Service | ✅ |
| `bannerService.ts` | `catalog_banners` | Service | ✅ |
| `batteryHealths-supabase.ts` | `battery_healths` | Service (atual) | ✅ |
| `batteryHealths.ts` | localStorage | Service (legado) | ✅ |
| `brands.ts` | `brands` | Service | ✅ |
| `bulk-products.ts` | `products` via Excel | Service | ✅ |
| `catalogConfigService.ts` | `catalog_settings` | Service | ✅ |
| `catalogEditorService.ts` | `catalog_settings`, `catalog_banners` | Service | ✅ |
| `catalogMetadataService.ts` | `catalog_metadata` | Service | ⚠️ Básico |
| `catalogSectionsService.ts` | `catalog_sections` | Service | ✅ |
| `catalogService.ts` | `products`, `categories` | Service | ✅ |
| `catalogShareService.ts` | analytics | Service | ✅ |
| `categories.ts` | `categories` | Service | ✅ |
| `colors.ts` | `colors` | Service | ✅ |
| `companyService.ts` | `company_settings` | Service | ✅ |
| `companySettingsService.ts` | `company_settings` | Service | ✅ |
| `custom-fields.ts` | `custom_fields` | Service | ✅ |
| `customers.ts` | `customers` | Service | ✅ |
| `documentService.ts` | `company_documents` | Service | ✅ |
| `installmentCalculator.ts` | `payment_fees` | Service | ✅ |
| `inventory.ts` | `products`, `stock_movements` | Service | ✅ |
| `legacyAPI.ts` | localStorage | Legado | ⚠️ Legado |
| `legacyAdapters.ts` | localStorage | Legado | ⚠️ Legado |
| `model-color-images.ts` | `model_variant_images` | Service | ⚠️ Duplicado |
| `model-eans.ts` | `model_eans` | Service | ✅ |
| `model-variants.ts` | `model_variants` | Service | ✅ |
| `modelColorImages.ts` | `model_variant_images` | Service (atual) | ✅ |
| `models-new-backup.ts` | `models` | Backup | ⚠️ Backup |
| `models-new.ts` | `models` | Service (atual) | ✅ |
| `models.ts` | `models` | Service (legado) | ✅ |
| `monitoringService.ts` | `system_logs`, `performance_metrics` | Service | ✅ |
| `payment-fees.ts` | `payment_fees` | Service | ✅ |
| `pricing.ts` | — | Util | ⚠️ Básico |
| `productGrouping.ts` | — | Util | ✅ |
| `productService.ts` | `products` | Service (wrapper) | ✅ |
| `productVariants.ts` | — | Util | ✅ |
| `products.ts` | `products` | Service (principal) | ✅ |
| `rams-supabase.ts` | `rams` | Service (atual) | ✅ |
| `rams.ts` | localStorage | Service (legado) | ✅ |
| `resources.ts` | `resources` | Service | ⚠️ Básico |
| `saleService.ts` | `sales`, `sale_items` | Service | ✅ |
| `storages-supabase.ts` | `storages` | Service (atual) | ✅ |
| `storages.ts` | localStorage | Service (legado) | ✅ |
| `supabase.ts` | — | Config | ✅ |
| `table-data.ts` | qualquer tabela | Util | ✅ |
| `team.ts` | `team_members` | Service | ✅ |
| `typeUpgradeRequests.ts` | `customer_type_requests` | Service | ✅ |
| `units.ts` | `units` | Service | ✅ |
| `uploadService.ts` | `catalog-banners` bucket | Service | ✅ |
| `versions-supabase.ts` | `versions` | Service (atual) | ✅ |
| `versions.ts` | localStorage | Service (legado) | ✅ |
| `warrantyDocumentService.ts` | `warranty_documents` | Service | ✅ |
| `warrantyTemplates.ts` | `warranty_templates` | Service | ✅ |

## 📊 TABELA FINAL — Todos os Utils (17 arquivos)

| Util | O que faz | Documentado |
|------|-----------|-------------|
| `calculateAveragePrice.ts` | Fórmula ponderada de preço médio | ✅ |
| `catalogMessageGenerator.ts` | Mensagem WhatsApp de catálogo | ✅ |
| `catalogPDFGenerator.ts` | Gerador de PDF do catálogo (16KB) | ⚠️ Básico |
| `cn.ts` | `clsx` + `tailwind-merge` helper | ✅ |
| `cnpjHelper.ts` | Helpers de CNPJ | ⚠️ Básico |
| `cpfCnpjValidation.ts` | Validação CPF/CNPJ algoritmo oficial | ✅ |
| `customerFormUtils.ts` | Utilitários de formulário de cliente | ⚠️ Básico |
| `field-standards.ts` | `ProductStatus` enum e padrões | ✅ |
| `image-compression.ts` | Compressão de imagens antes do upload | ⚠️ Básico |
| `multiProductQuoteGenerator.ts` | Gerador de orçamento multi-produto | ⚠️ Básico |
| `pricing.ts` | Funções de formatação de preço | ⚠️ Básico |
| `product-name-generator.ts` | Gerador de nome automático por template | ✅ |
| `saleCalculations.ts` | 18 funções de cálculo de vendas | ✅ |
| `socialMediaHelpers.ts` | Helpers de redes sociais | ⚠️ Básico |
| `urlHelpers.ts` | Helpers de URL para compartilhamento | ⚠️ Básico |
| `warrantyTagReplacement.ts` | Substituição de `{{tags}}` em templates | ✅ |
| `whatsappMessageGenerator.ts` | Gerador de mensagem de orçamento | ✅ |
