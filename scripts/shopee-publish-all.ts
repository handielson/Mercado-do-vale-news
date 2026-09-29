#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  apiRequest,
  createApiContext,
  loadAllTableRows,
  prepare,
  printPreview,
  publish,
  resolveConnection,
  type CliOptions,
} from './shopee-publish-one.ts';

type CascadeOptions = {
  connectionId: string;
  execute: boolean;
  confirmAccount: string;
  delayMs: number;
  maxItems: number;
  maxConsecutiveFailures: number;
  help: boolean;
};

type QueueEntry = {
  product: any;
  familyIds: string[];
  kind: 'simple' | 'variation';
};

type RunRecord = {
  product_id: string;
  sku: string;
  status: 'published' | 'blocked' | 'failed';
  item_id?: number;
  message?: string;
  finished_at: string;
};

const PRIMARY_CONNECTION_ID = 'primary';

function usage(): string {
  return `
Pre-visualizacao segura da fila G (nao publica):
  npm run shopee:publish-all

Envio sequencial real para G:
  npm run shopee:publish-all -- --execute --confirm-account G

Opcoes:
  --connection-id ID             Escolhe explicitamente a conexao adicional.
  --delay-ms 8000                Pausa entre anuncios (minimo 3000 ms).
  --max-items N                  Limita esta execucao; 0 envia toda a fila.
  --max-consecutive-failures N   Interrompe a cascata apos N falhas seguidas (padrao 5).
  --execute                      Autoriza gravacoes reais na Shopee G.
  --confirm-account G            Confirmacao obrigatoria para execucao real.

A fila inclui somente raizes ativas, com estoque, ja publicadas na conta M e
ainda sem qualquer vinculo da familia na conta G. A execucao e estritamente
sequencial e grava um checkpoint local depois de cada item.
`.trim();
}

function parseArgs(argv: string[]): CascadeOptions {
  const options: CascadeOptions = {
    connectionId: '',
    execute: false,
    confirmAccount: '',
    delayMs: 8000,
    maxItems: 0,
    maxConsecutiveFailures: 5,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--connection-id') options.connectionId = String(argv[++index] || '').trim();
    else if (arg === '--confirm-account') options.confirmAccount = String(argv[++index] || '').trim();
    else if (arg === '--delay-ms') options.delayMs = Number(argv[++index]);
    else if (arg === '--max-items') options.maxItems = Number(argv[++index]);
    else if (arg === '--max-consecutive-failures') options.maxConsecutiveFailures = Number(argv[++index]);
    else throw new Error(`Opcao desconhecida: ${arg}`);
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 3000) throw new Error('--delay-ms deve ser pelo menos 3000.');
  if (!Number.isInteger(options.maxItems) || options.maxItems < 0) throw new Error('--max-items deve ser inteiro maior ou igual a zero.');
  if (!Number.isInteger(options.maxConsecutiveFailures) || options.maxConsecutiveFailures < 1) {
    throw new Error('--max-consecutive-failures deve ser inteiro maior que zero.');
  }
  return options;
}

function isActive(product: any): boolean {
  return String(product?.status || '').trim().toLowerCase() === 'active'
    && !/^ARCH-/i.test(String(product?.sku || '').trim());
}

function isParent(product: any): boolean {
  return product?.is_parent === true || Number(product?.is_parent) === 1;
}

function hasStock(product: any, children: any[]): boolean {
  if (product?.track_inventory === false || Number(product?.track_inventory) === 0) return true;
  if (isParent(product)) {
    return children.some((child) => isActive(child)
      && (child?.track_inventory === false || Number(child?.track_inventory) === 0 || Number(child?.stock_quantity || 0) > 0));
  }
  return Number(product?.stock_quantity || 0) > 0;
}

async function loadAllProducts(ctx: ReturnType<typeof createApiContext>): Promise<any[]> {
  const products: any[] = [];
  const seen = new Set<string>();
  const pageSize = 500;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const page = await apiRequest<any[]>(ctx, `/products?status=all&include_parents=true&limit=${pageSize}&offset=${offset}`);
    const rows = Array.isArray(page) ? page : [];
    const sizeBefore = seen.size;
    rows.forEach((product) => {
      const id = String(product?.id || '');
      if (id && !seen.has(id)) {
        seen.add(id);
        products.push(product);
      }
    });
    if (rows.length < pageSize || seen.size === sizeBefore) break;
  }
  return products;
}

function buildQueue(products: any[], links: any[], connectionId: string): { queue: QueueEntry[]; reasons: Record<string, number> } {
  const byParent = new Map<string, any[]>();
  products.forEach((product) => {
    const parentId = String(product?.parent_id || '').trim();
    if (!parentId) return;
    byParent.set(parentId, [...(byParent.get(parentId) || []), product]);
  });
  const primaryLinks = links.filter((link) => String(link?.connection_id || PRIMARY_CONNECTION_ID) === PRIMARY_CONNECTION_ID && Number(link?.shopee_item_id) > 0);
  const primaryLinkByProductId = new Map(primaryLinks.map((link) => [String(link.product_id), link]));
  const primaryFamilyIdsByItem = new Map<string, string[]>();
  primaryLinks.forEach((link) => {
    const itemId = String(Number(link.shopee_item_id));
    primaryFamilyIdsByItem.set(itemId, [...new Set([...(primaryFamilyIdsByItem.get(itemId) || []), String(link.product_id)])]);
  });
  const targetLinkedIds = new Set(links
    .filter((link) => String(link?.connection_id || PRIMARY_CONNECTION_ID) === connectionId && Number(link?.shopee_item_id) > 0)
    .map((link) => String(link.product_id)));
  const reasons: Record<string, number> = {
    inactive_or_archived: 0,
    variation_child: 0,
    combo: 0,
    missing_sku: 0,
    no_stock: 0,
    not_published_in_m: 0,
    already_linked_in_g: 0,
  };
  const queue: QueueEntry[] = [];
  const queuedSourceItems = new Set<string>();
  const productById = new Map(products.map((product) => [String(product?.id || ''), product]));
  for (const product of products) {
    const productId = String(product?.id || '').trim();
    const children = byParent.get(productId) || [];
    const primaryLink = primaryLinkByProductId.get(productId);
    const sourceItemId = String(Number(primaryLink?.shopee_item_id || 0));
    const sourceFamilyIds = sourceItemId !== '0' ? (primaryFamilyIdsByItem.get(sourceItemId) || []) : [];
    const familyIds = [...new Set([productId, ...children.map((child) => String(child.id)), ...sourceFamilyIds])];
    const sourceFamilyProducts = sourceFamilyIds.map((id) => productById.get(id)).filter(Boolean);
    if (!isActive(product)) { reasons.inactive_or_archived += 1; continue; }
    if (String(product?.parent_id || '').trim()) { reasons.variation_child += 1; continue; }
    if (product?.is_combo === true || Number(product?.is_combo) === 1) { reasons.combo += 1; continue; }
    if (!String(product?.sku || '').trim()) { reasons.missing_sku += 1; continue; }
    const sourceFamilyHasStock = sourceFamilyProducts.length > 1 && sourceFamilyProducts.some((entry) =>
      isActive(entry) && (entry?.track_inventory === false || Number(entry?.track_inventory) === 0 || Number(entry?.stock_quantity || 0) > 0)
    );
    if (!(sourceFamilyHasStock || hasStock(product, children))) { reasons.no_stock += 1; continue; }
    if (!primaryLink) { reasons.not_published_in_m += 1; continue; }
    if (familyIds.some((id) => targetLinkedIds.has(id))) { reasons.already_linked_in_g += 1; continue; }
    if (queuedSourceItems.has(sourceItemId)) { reasons.variation_child += 1; continue; }
    queuedSourceItems.add(sourceItemId);
    queue.push({ product, familyIds, kind: isParent(product) || sourceFamilyProducts.length > 1 ? 'variation' : 'simple' });
  }
  return { queue, reasons };
}

function checkpointPath(): string {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(base, 'MercadoDoVale', 'shopee-publish-all-g.json');
}

function saveCheckpoint(payload: Record<string, unknown>): void {
  const destination = checkpointPath();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function loadCheckpointRecords(connectionId: string): RunRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(checkpointPath(), 'utf8'));
    if (String(parsed?.connection_id || '') !== connectionId || !Array.isArray(parsed?.records)) return [];
    return parsed.records;
  } catch {
    return [];
  }
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function printProgress(params: {
  total: number;
  previousPublished: number;
  records: RunRecord[];
  runStartedAt: number;
}): { remaining: number; estimatedFinishedAt: string | null; errorProducts: string[] } {
  const currentPublished = params.records.filter((record) => record.status === 'published').length;
  const errors = params.records.filter((record) => record.status === 'blocked' || record.status === 'failed');
  const processed = params.records.length;
  const published = params.previousPublished + currentPublished;
  const remaining = Math.max(0, params.total - published - errors.length);
  const elapsedSeconds = Math.max(1, (Date.now() - params.runStartedAt) / 1000);
  const averageSeconds = processed > 0 ? elapsedSeconds / processed : 0;
  const remainingSeconds = averageSeconds * remaining;
  const estimatedFinishedAt = averageSeconds > 0
    ? new Date(Date.now() + remainingSeconds * 1000).toISOString()
    : null;
  const errorProducts = errors.map((record) => `${record.sku}: ${record.message || record.status}`);

  console.log('\n================ PROGRESSO SHOPEE G ================');
  console.log(`Publicados com sucesso: ${published}/${params.total}`);
  console.log(`Erros/bloqueados: ${errors.length}`);
  console.log(`Ainda faltam: ${remaining}`);
  if (averageSeconds > 0) {
    console.log(`Tempo medio por anuncio: ${Math.round(averageSeconds)}s`);
    console.log(`Previsao restante: ${formatDuration(remainingSeconds)}`);
    console.log(`Termino estimado: ${estimatedFinishedAt}`);
  }
  console.log('Produtos com erros:');
  if (errorProducts.length === 0) console.log('(nenhum)');
  else errorProducts.forEach((entry) => console.log(`- ${entry}`));
  console.log('=====================================================\n');

  return { remaining, estimatedFinishedAt, errorProducts };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPermanentShopeeValidationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return !normalized.includes('foi criado') && (
    normalized.includes('attribute')
    || normalized.includes('atributo')
    || normalized.includes('registration id')
    || normalized.includes('mandatory required')
    || normalized.includes('inmetro')
    || normalized.includes('anvisa')
  );
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  if (options.help) { console.log(usage()); return; }
  if (options.execute && options.confirmAccount !== 'G') {
    throw new Error('Para iniciar a cascata real, informe exatamente --confirm-account G.');
  }

  const ctx = createApiContext();
  const connection = await resolveConnection(ctx, options.connectionId);
  ctx.connectionId = String(connection.id);
  const connectionQuery = `connection_id=${encodeURIComponent(ctx.connectionId)}`;
  const [products, links, shopInfoData] = await Promise.all([
    loadAllProducts(ctx),
    loadAllTableRows(ctx, 'shopee_products'),
    apiRequest<any>(ctx, `/api/shopee-catalog?action=shop_info&${connectionQuery}`),
  ]);
  const shopInfo = shopInfoData?.response || shopInfoData || {};
  const built = buildQueue(products, links, ctx.connectionId);
  const selectedQueue = options.maxItems > 0 ? built.queue.slice(0, options.maxItems) : built.queue;
  const simpleCount = selectedQueue.filter((entry) => entry.kind === 'simple').length;
  const variationCount = selectedQueue.filter((entry) => entry.kind === 'variation').length;
  const preview = {
    mode: options.execute ? 'EXECUCAO REAL SEQUENCIAL' : 'PRE-VISUALIZACAO (nenhuma gravacao)',
    account: {
      code: 'G',
      connection_id: ctx.connectionId,
      shop_id: connection.shopee_shop_id,
      region: shopInfo.region || null,
      item_limit: shopInfo.item_limit ?? null,
      item_count: shopInfo.item_count ?? null,
    },
    local_products: products.length,
    existing_links: links.length,
    queue: { total: selectedQueue.length, simple: simpleCount, variation_families: variationCount },
    exclusions: built.reasons,
    first_skus: selectedQueue.slice(0, 25).map((entry) => String(entry.product.sku)),
    checkpoint: checkpointPath(),
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!options.execute) {
    console.log('\nPre-visualizacao concluida. Nenhum anuncio foi criado.');
    return;
  }

  const targetLinkByProductId = new Map(links
    .filter((link) => String(link?.connection_id || PRIMARY_CONNECTION_ID) === ctx.connectionId && Number(link?.shopee_item_id) > 0)
    .map((link) => [String(link.product_id), link]));
  const checkpointByProductId = new Map<string, RunRecord>();
  loadCheckpointRecords(ctx.connectionId).forEach((record) => checkpointByProductId.set(String(record.product_id), record));
  const priorPublishedRecords = [...checkpointByProductId.values()].flatMap((record) => {
    const currentLink = targetLinkByProductId.get(String(record.product_id));
    if (record.status !== 'published' && !currentLink) return [];
    return [{
      ...record,
      status: 'published' as const,
      item_id: Number(currentLink?.shopee_item_id || record.item_id),
      message: undefined,
    }];
  });
  const priorPublishedIds = new Set(priorPublishedRecords.map((record) => record.product_id));
  const previousPublished = priorPublishedIds.size;
  const progressTotal = previousPublished + selectedQueue.length;
  const records: RunRecord[] = [];
  const runStartedAt = Date.now();
  let consecutiveFailures = 0;
  for (let index = 0; index < selectedQueue.length; index += 1) {
    const entry = selectedQueue[index];
    const sku = String(entry.product.sku || '').trim();
    const productId = String(entry.product.id || '').trim();
    console.log(`\n[${index + 1}/${selectedQueue.length}] Preparando ${sku} (${entry.kind})...`);
    try {
      const oneOptions: CliOptions = {
        productId,
        sku: '',
        connectionId: ctx.connectionId,
        execute: true,
        confirmSku: sku,
        help: false,
      };
      const prepared = await prepare(ctx, oneOptions);
      printPreview(prepared, true);
      if (prepared.blockers.length) {
        records.push({ product_id: productId, sku, status: 'blocked', message: prepared.blockers.join(' | '), finished_at: new Date().toISOString() });
        consecutiveFailures = 0;
        console.error(`[BLOQUEADO] ${sku}: ${prepared.blockers.join(' | ')}`);
      } else {
        const itemId = await publish(ctx, prepared);
        records.push({ product_id: productId, sku, status: 'published', item_id: itemId, finished_at: new Date().toISOString() });
        consecutiveFailures = 0;
        console.log(`[PUBLICADO] ${sku} -> item ${itemId}`);
      }
    } catch (error: any) {
      const message = String(error?.message || error);
      const validationBlocked = isPermanentShopeeValidationError(message);
      records.push({ product_id: productId, sku, status: validationBlocked ? 'blocked' : 'failed', message, finished_at: new Date().toISOString() });
      consecutiveFailures = validationBlocked ? 0 : consecutiveFailures + 1;
      console.error(`[${validationBlocked ? 'BLOQUEADO' : 'FALHA'}] ${sku}: ${message}`);
    }

    const progress = printProgress({
      total: progressTotal,
      previousPublished,
      records,
      runStartedAt,
    });
    saveCheckpoint({
      account: 'G',
      connection_id: ctx.connectionId,
      started_queue_size: progressTotal,
      updated_at: new Date().toISOString(),
      processed: records.length,
      published: previousPublished + records.filter((record) => record.status === 'published').length,
      blocked: records.filter((record) => record.status === 'blocked').length,
      failed: records.filter((record) => record.status === 'failed').length,
      remaining: progress.remaining,
      estimated_finished_at: progress.estimatedFinishedAt,
      error_products: progress.errorProducts,
      records: [...priorPublishedRecords, ...records],
    });
    if (consecutiveFailures >= options.maxConsecutiveFailures) {
      throw new Error(`Cascata interrompida apos ${consecutiveFailures} falhas consecutivas. Revise o checkpoint antes de retomar.`);
    }
    if (index + 1 < selectedQueue.length) await wait(options.delayMs);
  }

  console.log(`\nCASCATA CONCLUIDA: ${records.filter((record) => record.status === 'published').length} publicados, ${records.filter((record) => record.status === 'blocked').length} bloqueados e ${records.filter((record) => record.status === 'failed').length} falhas.`);
}

main().catch((error) => {
  console.error(`\nERRO: ${error?.message || error}`);
  process.exitCode = 1;
});
