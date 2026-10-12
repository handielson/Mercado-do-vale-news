const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const cents = value => value === null || value === undefined || String(value).trim() === ''
    || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Math.round(Number(value));
const money = value => value == null ? 'Não informado' : new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
}).format(value / 100);

// Units are authoritative whenever a product has unit history, even when all were sold.
export function buildInventoryCategoryRows(products, units, categoryId) {
    const categoryIds = new Set(Array.isArray(categoryId) ? categoryId : [categoryId]);
    const byProduct = new Map();
    for (const unit of units) {
        const list = byProduct.get(unit.product_id) || [];
        list.push(unit);
        byProduct.set(unit.product_id, list);
    }
    const rows = [];
    for (const product of products) {
        if (!categoryIds.has(product.category_id) || Number(product.is_parent) === 1) continue;
        const specs = product.specs || {};
        const base = {
            productId: product.id, name: String(product.name || '-'), sku: String(product.sku || '-'),
            purchaseCost: cents(product.price_cost), salePrice: cents(product.report_sale_price ?? product.price_retail),
            variation: [specs.color || specs.Cor, specs.storage || specs.Armazenamento,
                specs.ram || specs.RAM].filter(Boolean).join(' / ') || '-',
        };
        const history = byProduct.get(product.id);
        if (history) {
            for (const unit of history.filter(unit => unit.status === 'available')) {
                rows.push({ ...base, purchaseCost: cents(unit.cost_price) ?? base.purchaseCost,
                    quantity: 1, serial: unit.serial || '-',
                    imei1: unit.imei_1 || '-', imei2: unit.imei_2 || '-' });
            }
            continue;
        }
        const quantity = Math.max(0, Number(product.stock_quantity ?? specs.stock_quantity ?? 0) || 0);
        if (!quantity || (specs.unit_status && specs.unit_status !== 'available')) continue;
        rows.push({ ...base, quantity, serial: specs.serial || '-',
            imei1: specs.imei1 || '-', imei2: specs.imei2 || '-' });
    }
    const averages = new Map();
    for (const row of rows) {
        if (row.purchaseCost == null) continue;
        const average = averages.get(row.productId) || { value: 0, quantity: 0 };
        average.value += row.purchaseCost * row.quantity;
        average.quantity += row.quantity;
        averages.set(row.productId, average);
    }
    for (const row of rows) {
        const average = averages.get(row.productId);
        row.averagePurchaseCost = average ? Math.round(average.value / average.quantity) : null;
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.sku.localeCompare(b.sku));
}

export function renderInventoryCategoryReport(rows, categoryName, generatedAt = new Date(), options = {}) {
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    const date = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
    }).format(generatedAt);
    const columns = [
        ...(options.showPurchaseCost ? [{ key: 'purchaseCost', title: 'Compra (unit.)' }] : []),
        ...(options.showAverageCost ? [{ key: 'averagePurchaseCost', title: 'Compra média (unit.)' }] : []),
        ...(options.showSalePrice ? [{ key: 'salePrice', title: 'Venda à vista (unit.)' }] : []),
    ];
    return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Estoque atual - ${escapeHtml(categoryName)}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
body { font-family: Arial, sans-serif; color: #111; font-size: ${columns.length ? '9' : '11'}px; }
h1 { font-size: 20px; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th, td { border: 1px solid #aaa; padding: 5px; text-align: left; vertical-align: top; }
th { background: #eee; } thead { display: table-header-group; }
tr { break-inside: avoid; } .identifier { font-family: monospace; white-space: nowrap; }
.check { width: 30px; text-align: center; } .box { display: inline-block; width: 12px; height: 12px; border: 1px solid #555; }
.footer { margin-top: 24px; }
.money { white-space: nowrap; text-align: right; }
</style></head><body>
<h1>Mercado do Vale — Relatório de estoque atual</h1>
<p><strong>Categoria:</strong> ${escapeHtml(categoryName)}<br>
<strong>Gerado em:</strong> ${escapeHtml(date)}<br>
<strong>Total disponível:</strong> ${total} unidades</p>
<p>Somente estoque disponível. Cada unidade serializada ocupa uma linha. Marque os itens conferidos.</p>
${options.showAverageCost ? '<p>Compra média: média ponderada das unidades disponíveis do mesmo produto/variação, considerando os custos informados.</p>' : ''}
${options.showPurchaseCost ? '<p>Compra: custo da unidade; quando ausente, custo cadastrado do produto. Valores sem cadastro aparecem como “Não informado”.</p>' : ''}
<table><thead><tr><th>Produto</th><th>Variação</th><th>SKU</th><th>Qtd.</th>
<th>Serial</th><th>IMEI 1</th><th>IMEI 2</th>${columns.map(column => `<th>${column.title}</th>`).join('')}<th>Conferido</th></tr></thead><tbody>
${rows.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.variation)}</td>
<td>${escapeHtml(row.sku)}</td><td>${row.quantity}</td><td class="identifier">${escapeHtml(row.serial)}</td>
<td class="identifier">${escapeHtml(row.imei1)}</td><td class="identifier">${escapeHtml(row.imei2)}</td>
${columns.map(column => `<td class="money">${money(row[column.key])}</td>`).join('')}
<td class="check"><span class="box"></span></td></tr>`).join('')}
</tbody></table><p class="footer">Conferido por: ____________________________________ &nbsp; Data: ____/____/________</p>
</body></html>`;
}
