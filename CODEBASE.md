# CODEBASE.md — Planta Completa: Mercado do Vale

> **LEITURA OBRIGATÓRIA antes de qualquer modificação.**
> Fonte de verdade sobre dependências, funções e zonas de risco.
> **ATUALIZAR SEMPRE** que criar, mover, remover arquivos ou funções.

---

## 🔴 DÉBITOS TÉCNICOS — Corrigir no Final

> Problemas identificados durante o mapeamento. Não causam bugs críticos agora, mas devem ser corrigidos.

| # | Problema | Arquivo(s) | Impacto | Prioridade |
|---|---------|-----------|---------|-----------|
| 1 | `versions.ts` usa **localStorage** em vez de Supabase — dados não persistem entre dispositivos | `services/versions.ts` | Versões de produto perdidas ao trocar browser/dispositivo | Média |
| 2 | `resources.ts` é um **stub legado mock** que exporta `brandService`, `modelService`, `colorService` com os mesmos nomes dos services reais de Supabase — risco de import errado | `services/resources.ts` | Se importado por engano, retorna dados mock em vez do banco | Alta |
| 3 | `brands.ts` — campo `active` **não existe no banco** — sempre retorna `true` hardcoded | `services/brands.ts` | Impossível desativar marcas | Baixa |
| 4 | `productService.ts` (PDV) **não filtra por `company_id`** — queries sem RLS completo | `services/productService.ts` | Em ambiente multi-tenant, poderia retornar produtos de outras empresas | Alta |
| 5 | `modelColorImages.ts` — interface TypeScript diz `image_url` mas banco usa `images TEXT[]` — interface desatualizada | `services/modelColorImages.ts` | Confusão ao usar o service — `ProductCard` contorna isso com query direta | Média |
| 6 | `companyService.ts` e `companySettingsService.ts` acessam a **mesma tabela** `company_settings` com lógicas diferentes — risco de sobrescrever dados | `services/companyService.ts`, `services/companySettingsService.ts` | Dados da empresa podem ser sobrescritos por config de recibo | Alta |

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

### `services/resources.ts` — Services Auxiliares ⚠️ LEGADO Mock
**Exporta:** `brandService`, `modelService`, `colorService`, `capacityService`, `versionService`, `COLOR_MAP`
**Persistência:** Mock em memória (DEV_MODE) ou dados hardcoded

**⚠️ LEGADO** — este arquivo é um stub antigo. Os services reais são:
- `services/brands.ts` → `brandService` (Supabase)
- `services/models-new.ts` → `modelService` (Supabase)
- `services/colors.ts` → `colorService` (Supabase)

**⚠️ CONFLITO DE NOMES:** `resources.ts` exporta `brandService`, `modelService`, `colorService` com os mesmos nomes dos services reais. Verificar imports antes de modificar.

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
  categories: string[],
  brands: string[],
  hasMore: boolean,
  total: number,
  setFilters: (filters) => void,
  loadMore: () => void,
  refresh: () => void,
  metadata: { categories, brands }
}
```
**Usa:** `catalogService.getProducts()` + `catalogConfigService`
**⚠️ Usado por:** `CustomerCatalogPage`, `CatalogSection`

---

### `hooks/useEffectiveCustomerType.ts`
Retorna o tipo efetivo do cliente (varejo/revenda/atacado) para exibição de preços no catálogo.
**⚠️ Usado por:** `ModernProductCard`, `ProductDetailsModal`

---

## 🛠️ UTILS — Funções Exportadas

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
