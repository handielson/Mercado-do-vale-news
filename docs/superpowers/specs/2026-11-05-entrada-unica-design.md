# Entrada única de produtos e estoque — design

- Data: 05/11/2026
- Autor: Claude (com Handielson)
- Status: aguardando revisão
- Skill: superpowers:brainstorming → próximo passo superpowers:writing-plans

## 1. Objetivo

Hoje um produto (principalmente celular) entra no sistema por pelo menos seis caminhos, cada um com regra própria de família, SKU, preço, IMEI e estoque. Isso gerou erros reais em 05/11/2026:

- IMEI digitado no pai da família (MILI0001) sem virar aparelho;
- cores fantasmas na edição da família (C17 Plus);
- preço em texto travando o salvamento.

**Resultado esperado:** tudo que for **cadastro ou entrada** segue um padrão único, numa tela única, gravando por uma porta única no servidor. Todas as formas de entrada de hoje são mantidas: manual, em massa (planilha ou cadastro rápido) e por foto.

### Decisões do usuário
- Vale para **todos os produtos**: celular, acessório, 3D e combo.
- A tela única é **só para entrada**: produto novo, cor ou configuração nova, aparelho ou quantidade no estoque. Editar continua na Página do Produto.
- Os atalhos ("+ peças", "Adicionar Unidade", "Adicionar nova variação" e a importação do Bling) **continuam onde estão**, mas abrem a tela única já preenchida.
- Abordagem escolhida: **tela nova "Entrada" + porta única no servidor** (opção 1 de 3).

### Fora do escopo
- Edição de produto existente: continua no formulário atual e na Página do Produto.
- Sincronização automática de preço e estoque com Bling e marketplaces, que só atualiza o que já existe.
- Venda, troca e devolução (PDV), que são saída de estoque.

## 2. Caminhos de hoje (levantamento)

| # | Caminho | Grava por | Problema |
|---|---|---|---|
| 1 | `/admin/products/new`, produto simples | `ProductForm` → `productService.create` + `unitService.create` | Celular fica fora da família do modelo |
| 2 | `/admin/products/new`, com variações | `saveFamilyRegistration` (+ `createUnit` na linha) | Pai aceitava IMEI (corrigido na v1.2.794); rascunhos de cor |
| 3 | `/admin/products/bulk` (planilha e cadastro rápido) | `bulk-products.ts`, `QuickRegisterForm` → `productService.create` + `unitService.create` | Regras repetidas em outro código |
| 4 | `/admin/products/photo-intake` | `smartphonePhotoIntakeServer.cjs` (`ensureSmartphoneModelFamily`, `inheritSmartphonePrices`, `INSERT INTO units`) | O mais completo, mas só para celular |
| 5 | "Adicionar Unidade" (aba Estoque) e "+ peças" | `POST /units` | O servidor aceita aparelho até em produto pai |
| 6 | Importação de produto do Bling | `blingService` → `vpsApiService.createProduct` | Não passa pelas regras de celular da tela |

Código morto, sem rota: `pages/admin/EntradaPage.tsx` e `pages/admin/products/ProductEntryPage.tsx`.

Preço de celular já tem fonte única: `smartphone_price_groups`, aplicado por `withSmartphonePriceWrite`/`inheritSmartphonePrices`. Isso é mantido.

## 3. Porta única no servidor

### 3.1 Módulos
- `services/catalogEntryCore.cjs`: regras puras, sem banco, 100% testáveis.
  - normalizar item;
  - chave de configuração (reusa `smartphonePriceGroupsCore`);
  - plano por item: família, variação, preço, estoque;
  - validações: IMEI com 15 dígitos e Luhn, duplicados dentro do lote, campos mínimos.
- `services/catalogEntryServer.cjs`: rotas e transação. Reusa e generaliza:
  - `ensureSmartphoneModelFamily` → `ensureModelFamily` para qualquer categoria com modelo;
  - `reserveAvailableSku`;
  - `inheritSmartphonePrices`;
  - a inserção de unidade e de estoque por local que já existe (`units`, `product_stock_locations`, `stock_location_movements`).

### 3.2 Rotas (`requireSyncKeyOrAdmin`)
- `POST /catalog-entries/preview` → `{ items: Item[] }` (até 500) e devolve um plano por linha: `{ line, family: 'new'|'existing', variation: 'new'|'existing', sku, price_source, stock: {...}, errors: string[] }`. Não grava nada.
- `POST /catalog-entries` → `{ items: Item[], preview_hash }` — `preview_hash` é o `hash` devolvido pela prévia; cobre o plano e os itens normalizados (identidade, local, quantidade, preços, custo), então a confirmação precisa mandar exatamente os itens conferidos. Grava tudo numa transação. Se o plano mudou desde a prévia (outra pessoa deu entrada), devolve 409 e pede para conferir de novo.
- `GET /catalog-entries/:id` → lote registrado: quem, quando, origem, linhas e IDs criados.

### 3.3 Item
```json
{
  "source": "manual|bipar|planilha|foto|bling|atalho",
  "model_id": "uuid (obrigatório para celular; para outros, model_id OU category_id + name)",
  "category_id": "uuid",
  "name": "texto (sem modelo)",
  "configuration": { "ram": "6GB", "storage": "128GB", "version": "Global", "network": "", "condition": "new|seminovo|used|open_box" },
  "color": "Verde",
  "condition_note": "texto",
  "battery_health": "100",
  "identity": { "imei1": "", "imei2": "", "serial": "" },
  "quantity": 1,
  "cost_cents": 95000,
  "location_id": "uuid",
  "prices": { "price_retail": 130000, "price_reseller": 125000, "price_wholesale": 115000 },
  "photo_intake_id": "uuid (aba Foto)",
  "bling": { "id": "", "parent_id": "" }
}
```
- Celular (categoria de smartphone): `identity` obrigatório (IMEI 1, ou serial quando não houver IMEI) e `quantity = 1`.
- Outros produtos: `quantity ≥ 1`; `identity` opcional (eletrônico com serial vira unidade).
- `prices`: só é exigido quando a configuração do celular ainda não tem preço (grupo novo) ou quando o produto não é celular e a variação é nova. Valores em centavos inteiros; a ordem varejo ≥ revenda ≥ atacado é validada.

### 3.4 Ordem de resolução (por item, dentro da transação do lote)
1. **Família:** trava o modelo (`SELECT … FOR UPDATE`) e acha ou cria o pai (`is_parent=1`, SKU do modelo), reaproveitando pai importado do Bling.
2. **Variação:** acha por modelo + configuração (inclui condição) + cor. Se não existir, cria com SKU `<SKU-DO-PAI>-NN`, fotos e características do modelo (cor via `model_color_images`).
3. **Preço:**
   - celular: `inheritSmartphonePrices`. Grupo novo exige `prices` e grava o grupo.
   - outros: `prices` do item na criação. Em variação existente o preço não é alterado (edição é na Página do Produto).
4. **Estoque:**
   - celular/serializado: `INSERT INTO units` (status `available`, condição, custo, local). Conflito de IMEI ou serial em `units` → erro da linha.
   - quantidade: entrada em `product_stock_locations` + `stock_location_movements` (motivo `entrada`, lote) e recálculo de `products.stock_quantity`.
5. **Registro:** `catalog_entry_batches` (id, user, source, created_at, preview_hash) e `catalog_entry_lines` (batch_id, line, product_id, unit_id, created_flags). Criadas no boot com `CREATE TABLE IF NOT EXISTS`.

### 3.5 Regras de segurança
- Tudo ou nada por lote: qualquer erro faz rollback e devolve as linhas com problema.
- Duplicado dentro do lote (mesmo IMEI duas vezes) é bloqueado já na prévia.
- Aparelho nunca em produto pai. Nova trava imediata também em `POST /units` e `POST /units/batch`: `is_parent=1` → 409.
- O pai nunca recebe IMEI, serial, estoque nem preço de venda.

## 4. Tela "Entrada" (`/admin/entrada`)

### 4.1 Estrutura
- Menu: Produtos → **Entrada**.
- Abas: **Manual · Bipar · Planilha · Foto**.
- Abaixo das abas, a **Lista de entrada** comum: um único lote, que mistura linhas de abas diferentes.
- Rodapé: **Conferir** (prévia) e **Confirmar entrada** (habilitado só com todas as linhas ✅ e plano conferido).
- A lista fica salva no navegador (rascunho local, com `try/catch`) para não se perder se a página recarregar.

### 4.2 Abas
- **Manual:**
  - busca de modelo ou categoria + nome;
  - configuração (RAM, armazenamento, versão, rede, condição + observação);
  - cor (chips das cores com foto no modelo);
  - IMEI 1/2/serial **ou** quantidade;
  - custo e local;
  - preços só se a prévia disser que faltam.
  - Botão "Adicionar à lista".
- **Bipar:** trava modelo, configuração, cor, custo e local; cada leitura (leitor USB, câmera ou par IMEI 1/2 pelo `IMEIInput`) adiciona uma linha. Substitui o `QuickRegisterForm`.
- **Planilha:** o modelo de arquivo atual (`BulkUploadForm`), em que cada linha do arquivo vira linha da lista. Erros de leitura aparecem na própria linha.
- **Foto:** captura, análise e revisão atuais (`PhotoCapturePanel`, `PhotoIntakeReviewCard`). Ao aprovar, vira linha da lista com `photo_intake_id`. A finalização passa a ser pela porta única.

### 4.3 Linha da lista
- Mostra o produto com selo **família nova / cor nova / já existe**, o SKU previsto, IMEI ou quantidade, custo, local e origem.
- Mostra o status da prévia: ✅ ou ⚠️ com o motivo.
- Ações: editar e remover.

### 4.4 Produto ou família nova
- A entrada pede o mínimo: modelo ou nome, categoria, cor e preços (quando faltam).
- Fotos, descrição e características vêm do modelo.
- SEO, canais e fiscal são completados depois na **Página do Produto**. Depois de confirmar, a tela mostra link para cada produto criado.

## 5. Atalhos, Bling e telas antigas

- **"+ peças"** (vitrine e lista) e **"Adicionar Unidade"** (aba Estoque) → `/admin/entrada?aba=bipar&variacao=<id>`. A janela própria de unidade é retirada.
- **"Adicionar nova variação"** (Página do Produto) → `/admin/entrada?aba=manual&modelo=<model_id>`.
- **Importação de produto do Bling** → monta itens com `source: 'bling'` e abre a Lista de entrada. A sincronização automática de preço e estoque continua como está.
- **Telas antigas** (última etapa):
  - `/admin/products/new`, `/admin/products/bulk` e `/admin/products/photo-intake` redirecionam para `/admin/entrada` na aba correspondente;
  - o formulário grande perde o modo cadastro e fica só para edição;
  - `EntradaPage` e `ProductEntryPage` são apagadas.
- **Servidor** (última etapa):
  - criar produto **novo** (id inexistente) por `POST /products/batch` ou `vpsDbInsert('products')` passa a responder 409 com "use a Entrada", exceto quando o corpo traz `sync_origin` ∈ {`bling`, `shopee`, `mercado_livre`, `tiktok`} (rotinas de sincronização);
  - `POST /units` e `POST /units/batch` param de criar unidade (409 "use a Entrada"); a Entrada grava unidades pela função interna do `catalogEntryServer.cjs`;
  - atualização (`PUT /products/:id`, `PUT /units/:id`, `PATCH …`) continua igual.

## 6. Etapas de entrega
Cada etapa sai como versão própria, publicada pelo `publicar.md`, com testes:

1. **Porta única no servidor:** core, rotas, tabelas de lote e trava de unidade em pai. Testes de unidade do core e de integração da transação, com banco em memória ou mock e os cenários abaixo.
2. **Tela Entrada com Manual e Bipar**, lista, prévia e confirmação.
3. **Aba Planilha.**
4. **Aba Foto:** a finalização da entrada por foto passa a usar a porta única.
5. **Atalhos e Bling** apontando para a tela.
6. **Retirada:** redirecionamentos, fim do modo cadastro do formulário grande, apagar telas mortas e travar a criação fora da porta.

### Cenários de teste obrigatórios
- Modelo sem família → cria pai + variação + unidade; SKU `PAI-01`.
- Mesma configuração e cor já existente → só cria unidade.
- Cor nova numa configuração com preço → cria variação com o preço do grupo, sem pedir preço.
- Configuração nova sem preço → prévia pede `prices`; sem eles, erro na linha.
- Seminovo da mesma memória do novo → variação separada (condição na chave), preço próprio.
- IMEI repetido no lote ou já em `units` → erro na linha; nada gravado.
- Lote com uma linha ruim → rollback total.
- Duas entradas simultâneas do mesmo modelo → um pai e SKUs sem colisão.
- Produto sem modelo (acessório) com quantidade → cria ou acha produto e soma estoque no local.
- `POST /units` em produto pai → 409.
- Plano mudou entre prévia e confirmação → 409 e nova prévia.

## 7. Riscos
- **Tamanho:** são seis etapas. A última só é feita quando a tela nova estiver em uso.
- **Bling:** pais importados sem `model_id` são reaproveitados (regra existente de `ensureSmartphoneModelFamily`); conflito de modelo é erro da linha, não criação de outro pai.
- **Formulário grande:** continua para edição; não ganha mais funções de cadastro.
