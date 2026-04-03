---
name: vpsskill
description: Especialista Mercado do Vale. Conhece a arquitetura completa do sistema — VPS, Supabase, Synology, Bling — e atua com contexto total em qualquer mudança solicitada.
skills: []
---

# VPSSkill — Especialista de Sistema: Mercado do Vale

## 🧠 DIRETIVA DO ESPECIALISTA

Este agente conhece **todo o sistema Mercado do Vale** e DEVE aplicar esse conhecimento em qualquer tarefa.

### Regras de atuação

1. **Sempre ativo:** Antes de qualquer mudança de código, aplique as regras de arquitetura deste documento.
2. **Aprendizagem contínua:** Toda vez que uma nova regra, padrão ou descoberta emergir durante uma sessão, este arquivo DEVE ser atualizado para refletir o novo conhecimento.
3. **Contexto total:** Não trate mudanças como isoladas — considere o impacto em VPS, Supabase, Synology e Bling.
4. **Sem regressão:** Nunca introduza consulta Supabase onde VPS é a fonte de verdade.

> 🔴 **Ao iniciar qualquer sessão de desenvolvimento, leia este arquivo primeiro.**

---

## 🏗️ ARQUITETURA 3-2-1 — VISÃO GERAL

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA 1 — FONTE DE VERDADE                            │
│  VPS MySQL (api.xiaomipetrolina.com.br)                 │
│  • Catálogo completo de produtos                        │
│  • Estoque real (sync via webhook Bling)                │
│  • Imagens físicas em /var/www/mdv-api/uploads/         │
│  • Vídeos de produtos                                   │
└────────────────────┬────────────────────────────────────┘
                     │ Backup 1 (dados estruturados)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  CAMADA 2 — SUPABASE (Backup 1 + Dados Transacionais)  │
│  • Auth / Login (fonte primária — NUNCA migrar)        │
│  • Pedidos / Checkout / Vendas                          │
│  • Carrinho (carts, cart_items)                         │
│  • Favoritos (customer_favorites)                       │
│  • Marcas completas (brands: warranty_days, etc.)      │
│  • Config de categorias (categories.config)             │
│  • Dimensões físicas (models.template_values)           │
│  • Banners, Settings, Cashback, Referral                │
│  ⚠️ NÃO armazenar imagens (caro)                        │
└────────────────────┬────────────────────────────────────┘
                     │ Backup 2 (recuperação total)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  CAMADA 3 — SYNOLOGY NAS (Backup 2)                     │
│  • CDN Imagens: imagens.xiaomipetrolina.com.br          │
│  • CDN Vídeos: videos.mercadodovale.com.br              │
│  • CDN Arquivos: arquivos.xiaomipetrolina.com.br        │
│  • Backup de código: backup-mercadodovale/db/           │
│  • Backup de imagens: backup-mercadodovale/imagens/     │
│  • Changelogs: backup-mercadodovale/db/*.txt            │
└─────────────────────────────────────────────────────────┘
```

---

## 🗺️ MAPA DEFINITIVO DE TABELAS — ONDE CADA DADO VIVE

### Tabelas de CATÁLOGO (produto)

| Tabela | Fonte de Verdade | Backup | Observação |
|---|---|---|---|
| `products` (nome, preço, estoque, sku) | **VPS MySQL** | Supabase (sync) | Nunca ler catálogo do Supabase |
| `categories` (nome) | **VPS MySQL** | Supabase (fallback) | VPS vence em caso de divergência |
| `categories.config` | **Supabase** | — | Config de template de campos — VPS não tem |
| `models.template_values` | **Supabase** | — | Dimensões físicas (peso, altura, etc.) — VPS não tem |
| `brands` (warranty_days, slug, active) | **Supabase** | — | Tabela completa só no Supabase |
| `brand` (nome no produto) | **VPS** (campo do produto) | — | Denormalizado no produto |

### Tabelas TRANSACIONAIS (cliente/vendas) — exclusivo Supabase

| Tabela | Local | Nunca migrar? |
|---|---|---|
| `profiles` / `auth.users` | Supabase | ✅ Auth — nunca migrar |
| `customers` | Supabase | ✅ Dados de cliente |
| `orders` / `order_items` | Supabase | ✅ Pedidos |
| `carts` / `cart_items` | Supabase | ✅ Carrinho |
| `customer_favorites` | Supabase | ✅ Favoritos |
| `customer_carts` | Supabase | ✅ Rastreamento de intenção |
| `warranty_templates` | Supabase | ✅ Templates de garantia |
| `cashback` / `referrals` | Supabase | ✅ Marketing/fidelidade |
| `banners` | Supabase | ✅ Marketing |

### Tabelas EXCLUSIVAS DA VPS (não existem no Supabase)

| Tabela | Descrição |
|---|---|
| `product_combos` | Relação combo pai ↔ filhos com quantidade |
| `versions` | Variações de produto (128GB, 256GB...) |
| `company_settings` | Configurações da empresa (CNPJ, etc.) |

---

## 🔴 REGRAS CRÍTICAS DE ARQUITETURA

### Regra 1 — Leitura de produto

```
✅ CORRETO:   vpsApiService.getProducts() / getProductById()
❌ ERRADO:    supabase.from('products').select(...)
```

### Regra 2 — Preço

```
Fonte:        VPS (price_retail, price_cost, price_reseller, price_wholesale)
Fallback:     Supabase (price) — só se VPS indisponível
Campo VPS:    price_retail   ← NUNCA 'price'
```

### Regra 3 — Estoque

```
Fonte:        VPS (stock_quantity)
Fallback:     Supabase (stock) — só se VPS indisponível
Campo VPS:    stock_quantity  ← NUNCA 'stock'
```

### Regra 4 — Dimensões físicas

```
Fonte:        Supabase → models.template_values
              (weight_kg → converte para weight_g)
              (dimensions.height_cm, dimensions.width_cm, dimensions.depth_cm)
VPS:          NÃO armazena dimensões — campos retornam null
```

### Regra 5 — Marcas

```
Nome da marca:         VPS (campo brand no produto — string)
Dados da marca:        Supabase (tabela brands: warranty_days, slug, active, logo)
warranty_days:         SEMPRE Supabase → brands.warranty_days
```

### Regra 6 — Categorias

```
Nome da categoria:     VPS primeiro → Supabase fallback
Config de categoria:   SEMPRE Supabase (categories.config) — VPS não tem
ID de categoria:       Compartilhado entre VPS e Supabase (mesmos IDs)
```

### Regra 7 — Auth / Login

```
SEMPRE Supabase. Nunca migrar. Nunca duplicar.
Supabase fornece JWT, RLS, OAuth — infraestrutura de segurança.
```

### Regra 8 — Imagens

```
Origem:       VPS filesystem (/var/www/mdv-api/uploads/products/{SKU}/)
CDN:          Synology (imagens.xiaomipetrolina.com.br)
Backup:       SynologyDrive/backup-mercadodovale/imagens/
NUNCA:        Supabase Storage (caro)
```

---

## 🔀 PADRÃO HÍBRIDO (VPS-first + Supabase-fallback)

Usar quando um componente precisa de dados de AMBAS as fontes:

```typescript
// Padrão correto: VPS-first com fallback gracioso
async function loadData() {
  // 1. VPS (fonte de verdade — preço, nome, estoque)
  let vpsData = null;
  try {
    vpsData = await vpsApiService.getProducts({ status: 'active' });
  } catch {
    console.warn('[Componente] VPS indisponível — usando fallback Supabase');
  }

  // 2. Supabase (sempre necessário para dados que não existem na VPS)
  const { data: sbData } = await supabase
    .from('models')
    .select('id, template_values') // dimensões — só aqui
    .in('id', modelIds);

  // 3. Merge: VPS vence em campos conflitantes
  return merged; // VPS price > Supabase price
}
```

**Exemplos implementados:**
- `FreightCalculator.tsx` → preço da VPS + dimensões do Supabase (`models.template_values`)
- `PublicProductPage.tsx` → produto da VPS + `config` de categoria do Supabase

---

## 🔧 NORMALIZER — SEMPRE USAR AO INTEGRAR FONTES

**Arquivo:** `services/productNormalizer.ts`

```typescript
import { normalizeProduct, normalizeProducts } from '@/services/productNormalizer';

// Produto de qualquer fonte → formato VPS canônico
const produto = normalizeProduct(dadosBrutos);

produto.price_retail;   // nunca undefined (fallback de 'price', 'preco', etc.)
produto.ean;            // nunca undefined (fallback de 'barcode', 'gtin')
produto.stock_quantity; // nunca undefined (fallback de 'stock')
produto.status;         // sempre 'active' | 'inactive' (nunca boolean)
produto.images;         // sempre array (parse de JSON string se necessário)
produto.image_url;      // sempre derivado de images[0]
```

**Interface canônica (`NormalizedProduct`):**

| Campo | Tipo | Nunca usar |
|---|---|---|
| `price_retail` | number | `price`, `preco`, `precoVenda` |
| `ean` | string | `barcode`, `gtin` |
| `stock_quantity` | number | `stock` |
| `status` | `'active'\|'inactive'` | `active` (boolean) |
| `image_url` | string\|null | derivado de `images[0]` |

---

## 📋 MAPEAMENTO VPS → SUPABASE (para sync)

```
VPS campo          → Supabase campo       Observação
─────────────────────────────────────────────────────
id                 → id                   UUID compartilhado
name               → name
sku                → sku
ean                → barcode              ⚠️ nome diferente!
price_retail       → price                ⚠️ nome diferente!
price_wholesale    → price_wholesale
stock_quantity     → stock                ⚠️ nome diferente!
images             → images               mesmo formato JSON
description        → description
slug               → slug
status (string)    → active (boolean)     ⚠️ tipo diferente!
category_id        → category_id          mesmo ID
specs              → specs                JSON
video_url          → video_url
```

---

## 🔌 ENDPOINTS DA VPS

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/products` | Lista com filtros (category, status, search, sku, ean, model_id, parent_id) |
| GET | `/products/:id` | Produto por ID (UUID) |
| GET | `/products/by-slug/:slug` | Produto por slug |
| GET | `/products/by-ean/:ean` | Produto por EAN |
| POST | `/products/batch` | Upsert em lote |
| PUT | `/products/:id` | Atualizar produto completo |
| PATCH | `/products/images` | Atualizar imagens por SKU |
| PATCH | `/products/stock` | Atualizar estoque por SKU |
| PATCH | `/products/name` | Atualizar nome por SKU |
| PATCH | `/products/description` | Atualizar descrição por SKU |
| GET | `/categories` | Listar categorias (id, name) |
| GET | `/check-video?sku=X` | Verificar se existe vídeo para o SKU |
| POST | `/combos` | Criar combo |
| PUT | `/combos/:id` | Atualizar combo |
| GET | `/images/list` | Listar imagens no filesystem |
| POST | `/images/upload` | Upload de imagem |
| GET | `/synology/files` | Listar arquivos no Synology CDN |
| POST | `/synology/upload` | Upload para Synology CDN |

---

## 🏷️ INTEGRAÇÃO BLING (Webhook Isolado)

- **Arquivo:** `api/bling-webhook.ts`
- **Função:** recebe eventos do Bling ERP e atualiza estoque na VPS + Supabase
- **Isolado:** não depende de `catalogService` nem `productNormalizer`
- **Escrita:** `supabase.from('products').update({ stock_quantity })` → backup Supabase
- **Escrita:** VPS via `PATCH /products/stock` → fonte de verdade

> ⚠️ **Nunca refatorar o webhook sem verificar se o token OAuth2 ainda é atualizado automaticamente.**

---

## 🗂️ ESTRUTURA DE IMAGENS

```
VPS (origem):
  /var/www/mdv-api/uploads/products/{SKU}/{arquivo}.webp
  Servido em: https://api.xiaomipetrolina.com.br/images/products/{SKU}/{arquivo}.webp

Synology CDN (produção):
  /web/imagens/{arquivo}
  Servido em: https://imagens.xiaomipetrolina.com.br/{arquivo}

Synology Backup (recuperação):
  backup-mercadodovale/imagens/products/{SKU}/{arquivo}.webp
  Local: C:\Users\Nitro\SynologyDrive\SynologyDrive\backup-mercadodovale\imagens\
```

---

## 💾 BACKUP DE CÓDIGO E IMAGENS

```bash
# Backup de código (pós-commit):
node backup-synology.cjs auto
node backup-synology.cjs manual "descricao"

# Backup de imagens (VPS → Synology):
node sync-imagens-para-synology.cjs           # incremental
node sync-imagens-para-synology.cjs --dry-run # preview
node sync-imagens-para-synology.cjs --force   # força tudo
```

**Fluxo recomendado:**
```
1. git commit -m "feat: ..."
2. node backup-synology.cjs auto
3. git add public/backup-history.json
4. git commit -m "chore: registrar backup"
5. git push origin main
```

---

## ✅ CHECKLIST ANTES DE QUALQUER MUDANÇA

Antes de escrever código que envolva produtos, pergunte:

| Pergunta | Resposta correta |
|---|---|
| Estou lendo produto? | `vpsApiService` — nunca `supabase.from('products')` |
| Estou lendo preço? | `price_retail` da VPS — nunca `price` do Supabase |
| Estou lendo estoque? | `stock_quantity` da VPS — nunca `stock` |
| Estou lendo dimensões? | `models.template_values` do Supabase — VPS não tem |
| Estou lendo warranty_days? | `brands.warranty_days` do Supabase — VPS não tem em tabela separada |
| Estou lendo auth/usuário? | Supabase — nunca VPS |
| Estou salvando imagem? | VPS filesystem — nunca Supabase Storage |
| Preciso normalizar dado? | `normalizeProduct()` de `productNormalizer.ts` |
| É dado de pedido/checkout? | Supabase exclusivo |

---

## 🔔 WEBHOOK BLING — COMPORTAMENTO E DIAGNÓSTICO

**Arquivo:** `api/bling-webhook.ts`
**URL produção:** `https://mercadodovale.com.br/api/bling-webhook`
**Eventos tratados:** `estoque`, `movimentacaoEstoque`, `stock.created`, `stock.updated`, `produto`, `product.updated`

### Fluxo de atualização de estoque

```
Bling dispara evento
  ↓
1. Extrai blingId e SKU do payload
2. Verifica/renova token OAuth automaticamente
3. Chama fetchBlingStock(blingId) → API /estoques/saldos
   ├─ OK: usa saldoFisicoTotal (total de todos os depósitos)
   └─ FALHOU: verifica payload.saldoFisicoTotal como fallback
       ├─ payload > 0: usa valor com aviso no log
       └─ payload = 0 ou null: ABORTA ← PROTEÇÃO CONTRA ZERO FALSO
4. Atualiza VPS (PATCH /products/stock)
5. Atualiza Supabase (backup)
```

### ⚠️ Bug documentado: Estoque zerado incorretamente (Corrigido 01/04/2026)

**Sintoma:** Produtos com estoque no Bling apareciam "Sem Estoque" no sistema. Sync manual corrigia.

**Causa raiz:**
1. Token OAuth expirado ou inválido → `fetchBlingStock` retornava `null` (HTTP 401/silencioso)
2. Fallback usava `saldoFisicoTotal` do payload do evento
3. O payload de eventos de movimentação pode trazer `saldoFisicoTotal=0` (saldo de um depósito específico, não o total real)
4. Sistema gravava 0 na VPS + Supabase → produto zerado

**Correção aplicada:**
- Se `fetchBlingStock` falha **E** payload = 0 → atualização **abortada** (não grava zero)
- Se `fetchBlingStock` falha **E** payload > 0 → usa valor com aviso no log
- `fetchBlingStock` agora loga o status HTTP da falha (`HTTP 401`, `HTTP 404`, etc.)

**Resposta quando proteção ativa:**
```json
{
  "ok": false,
  "sku": "ATXAI",
  "message": "API falhou e payload retornou 0 — atualização abortada para evitar estoque zerado incorretamente"
}
```

### Diagnóstico via Vercel Logs

| Log | Causa | Ação |
|---|---|---|
| `fetchBlingStock OK: saldoFisicoTotal=X` | ✅ Funcionando | Nenhuma |
| `fetchBlingStock HTTP 401` | Token OAuth expirado | Renovar token no admin → Config Bling |
| `fetchBlingStock HTTP 404` | blingId não existe na conta | Verificar produto no Bling |
| `🛑 ABORTADO: API falhou e payload=0` | Proteção ativada | Sync manual ou aguardar próximo evento |
| `⚠️ Usando payload fallback: saldoFisicoTotal=X` | API falhou mas payload tem valor positivo | Renovar token (API está falhando) |
| `⚠️ Sem token OAuth — usando payload` | Token não configurado | Configurar OAuth no admin Bling |

### Estrutura do payload Bling (evento de estoque)

```json
{
  "event": "estoque",
  "data": {
    "produto": {
      "id": 123456,
      "codigo": "ATXAI"
    },
    "saldoFisicoTotal": 5
  }
}
```

> ⚠️ `saldoFisicoTotal` no payload = saldo de **um depósito específico**, NÃO o total.
> Sempre buscar da API `/estoques/saldos` para obter o total real consolidado.

---

## 🏷️ NCM + INMETRO — SISTEMA FISCAL

**Implementado em:** 01/04/2026

### Campos fiscais do produto

| Campo | Localização na VPS | Workaround |
|---|---|---|
| `ncm` | Campo nativo em `products.ncm` (8 dígitos, sem pontos) | Nenhum — campo nativo |
| `inmetro_certificate` | `products.specs.inmetro_certificate` (JSON) | Sem migration — usa specs |

### Componentes reutilizáveis

| Componente | Arquivo | Função |
|---|---|---|
| `NcmSearchWidget` | `components/admin/NcmSearchWidget.tsx` | Busca NCM via BrasilAPI + salva na VPS |
| `InmetroWidget` | `components/admin/InmetroWidget.tsx` | Campo manual + link ProdCert + salva VPS |

### API externa — BrasilAPI NCM

```
GET https://brasilapi.com.br/api/ncm/v1?search={termo}
Resposta: [{ codigo: "8517.62.62", descricao: "De tecnologia celular", ... }]
```
- Funciona com nome do produto como termo de busca
- Retorna lista de códigos, filtrar apenas folhas (codigo sem pontos ≥ 8 dígitos)
- Sem autenticação necessária — API pública

### Fluxo VPS-first

```
Admin seleciona NCM → PATCH /products/{id}/fiscal (VPS)
  └─ Fallback: PUT /products/{id} se endpoint /fiscal não existir
Shopee: campo ncm pré-populado do VPS → salvo em tax_info.ncm
Bling: campo ncm sincronizado via BlingPage
```

### Onde os widgets estão integrados

| Página | Onde aparece | Funcionalidade |
|---|---|---|
| `ProductDetailPage.tsx` | Seção "Informações Fiscais" abaixo do ProductForm | NCM + Inmetro com save direto na VPS |
| `ShopeePage.tsx` | Painel expandido → seção Fiscal | NCM com busca + Inmetro com link ProdCert |
| BlingPage | 🚧 Pendente (Parte 6) | NCM busca + botão sync Bling |

### Endpoint VPS utilizado

- `PATCH /products/{id}/fiscal` — endpoint dedicado (criar no servidor se não existir)
- Fallback: `PUT /products/{id}` via `updateProduct()` existente

### Inmetro — sem API pública

O Inmetro **não tem API pública**. Estratégia adotada:
1. Admin consulta manualmente em `inmetro.gov.br/prodcert`
2. Preenche o número do certificado no `InmetroWidget`
3. Sistema salva em `specs.inmetro_certificate` na VPS
4. Shopee lê este campo nos atributos de categoria regulamentada

---

## 📖 APRENDIZAGENS POR SESSÃO

### Sessão 01/04/2026 — Padronização VPS-First + Correção Webhook Bling
- **Fases 1+2 concluídas:** `catalogService.ts` e `catalogSectionsService.ts` migrados para VPS + `normalizeProduct()`
- **Fase 3 concluída:** `FreightCalculator.tsx` agora é híbrido (preço VPS + dimensões Supabase)
- **PublicProductPage:** categoria busca nome na VPS; `config` ainda vem do Supabase (correto)
- **Descoberta:** VPS **não armazena dimensões físicas** — `weight_g`, `height_cm` etc. retornam null
- **Descoberta:** VPS **não tem tabela `brands` separada** — marca é string no produto; dados completos (warranty_days) ficam em `Supabase.brands`
- **Descoberta:** IDs de categorias são **compartilhados** entre VPS e Supabase (mesmos valores)
- **Regra confirmada:** Auth (login) **permanece no Supabase** para sempre — segurança gerenciada
- **Bug corrigido:** Webhook Bling zerava estoque incorretamente quando token expirado + payload=0. Proteção implementada: aborta em vez de gravar zero falso.
- **Testado em produção:** Simulação com SKU=ATXAI confirmou proteção ativa (`ok: false, message: API falhou e payload retornou 0...`)
- **Submodule git:** `mercado-do-vale/` é um submodule separado do repo pai. Push do código: `cd mercado-do-vale && git push origin main`. Repo pai usa branch `master`.
- **Backup:** 593+ imagens sincronizadas VPS → Synology (backup-mercadodovale/imagens/)
- **NCM:** Campo nativo na VPS (`products.ncm`). BrasilAPI usada para busca por nome. `NcmSearchWidget` implementado e integrado em ProductDetailPage + ShopeePage.
- **Inmetro:** Sem API pública. Armazenado em `specs.inmetro_certificate`. `InmetroWidget` com link ProdCert. Integrado em ProductDetailPage + ShopeePage.
- **Descoberta fiscal:** `ncm` já era campo nativo no `Product` e `ProductInput` (types/product.ts). Nenhuma migration necessária.


> 📝 **Atualize esta seção ao final de cada sessão com novas descobertas.**
