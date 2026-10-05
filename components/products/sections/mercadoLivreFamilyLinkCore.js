export function parseMercadoLivreItemId(value) {
    const match = String(value || '').trim().match(/\bMLB[-\s]?(\d+)\b/i);
    if (!match) throw new Error('Cole o link do anúncio ou seu código MLB.');
    return `MLB${match[1]}`;
}

export async function findFamilyListing(value, discover, onProgress = () => {}) {
    const itemId = parseMercadoLivreItemId(value);
    const visited = new Set();
    let cursor = '', sellerId = '';
    for (let page = 1; ; page++) {
        if (visited.has(cursor)) throw new Error('A consulta repetiu uma página. Tente novamente.');
        visited.add(cursor);
        onProgress(page);
        const result = await discover(cursor);
        if (sellerId && sellerId !== result.sellerId) throw new Error('A conta conectada mudou. Consulte novamente.');
        sellerId = result.sellerId;
        const failure = result.errors?.find(error => error.itemId === itemId);
        if (failure) throw new Error(failure.error);
        const rows = result.items.filter(row => row.itemId === itemId);
        if (rows.length) return rows;
        if (!result.nextCursor) throw new Error('Anúncio não encontrado na conta conectada. Confira o link e a conta do vendedor.');
        cursor = result.nextCursor;
    }
}

export function validateFamilySelection(children, rows, selections) {
    const used = new Set();
    return children.filter(child => selections[child.id] !== undefined && selections[child.id] !== '').map(child => {
        const row = rows.find(option => `${option.itemId}:${option.variationId}` === selections[child.id]);
        if (!row) throw new Error(`Escolha uma opção válida para ${child.sku}.`);
        const key = `${row.itemId}:${row.variationId}`;
        if (used.has(key)) throw new Error('A mesma opção do anúncio não pode ser ligada a dois filhos.');
        used.add(key);
        if (row.existing.some(link => link.productId !== child.id)) throw new Error(`A opção ${row.variation || row.title} já pertence a outro produto.`);
        return { child, row };
    });
}
