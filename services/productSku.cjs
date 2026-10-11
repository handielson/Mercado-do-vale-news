'use strict';

function productSkuPrefix(name) {
  const words = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().match(/[A-Z]+/g) || [];
  const significant = words.filter(word => !['DE', 'DA', 'DO', 'DAS', 'DOS', 'PARA', 'COM', 'E'].includes(word));
  if (!significant.length) throw new Error('Informe o nome do produto para gerar o SKU.');
  // Acrônimos técnicos tornam suportes reconhecíveis: Suporte para LNB → SLNB.
  const acronym = significant.find(word => ['LNB', 'LNBF', 'USB', 'LED'].includes(word));
  const letters = acronym && significant[0] !== acronym
    ? significant[0][0] + acronym : significant[0];
  return (letters + significant.slice(1).join('') + 'XXXX').slice(0, 4);
}

function nextProductSku(name, existingSkus) {
  const prefix = productSkuPrefix(name);
  const pattern = new RegExp(`^${prefix}(\\d{4})$`, 'i');
  let sequence = 0;
  for (const sku of existingSkus) {
    const match = String(sku || '').trim().match(pattern);
    if (match) sequence = Math.max(sequence, Number(match[1]));
  }
  if (sequence >= 9999) throw new Error(`A sequência de SKUs ${prefix} esgotou os 4 números. Informe um SKU manual único.`);
  return prefix + String(sequence + 1).padStart(4, '0');
}

function assignAutomaticProductSku(product, existingSkus) {
  const sku = nextProductSku(product.name, existingSkus);
  product.sku = sku;
  // Nome e SKU são persistidos juntos, como texto simples, somente no cadastro automático.
  const name = String(product.name || '').trim();
  product.name = name.endsWith(` - ${sku}`) ? name : `${name} - ${sku}`;
}

// O lock permanece na mesma conexão até o INSERT/COMMIT terminar.
// Sem tabela nova ou geração antecipada no navegador.
async function withProductSku(pool, product, write) {
  const connection = await pool.getConnection();
  const lockName = 'mdv:product-auto-sku';
  let locked = false;
  try {
    const [locks] = await connection.query('SELECT GET_LOCK(?, 15) AS acquired', [lockName]);
    locked = Number(locks[0]?.acquired) === 1;
    if (!locked) throw new Error('Não foi possível reservar o SKU. Tente salvar novamente.');
    const [registered] = await connection.query('SELECT sku FROM products WHERE id=? LIMIT 1', [product.id]);
    if (registered.length) {
      product.sku = registered[0].sku;
    } else if (!String(product.sku || '').trim()) {
      const prefix = productSkuPrefix(product.name);
      const [rows] = await connection.query('SELECT sku FROM products WHERE sku LIKE ?', [prefix + '%']);
      assignAutomaticProductSku(product, rows.map(row => row.sku));
    }
    if (!registered.length && /^[A-Z]{4}\d{4}$/i.test(String(product.sku || '').trim())) {
      const [conflicts] = await connection.query('SELECT id FROM products WHERE sku=? LIMIT 1', [product.sku]);
      if (conflicts.length) throw new Error(`SKU ${product.sku} já está em uso. O cadastro não foi gravado; o SKU não será alterado automaticamente.`);
    }
    // Reutiliza a conexão reservada também na transação de preços/estoque.
    // Abrir outra conexão aqui poderia esgotar o pool com cadastros concorrentes.
    const transactionConnection = new Proxy(connection, {
      get(target, key) {
        if (key === 'release') return () => {};
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return await write({
      query: connection.query.bind(connection),
      getConnection: async () => transactionConnection,
    });
  } finally {
    try { if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]); }
    finally { connection.release(); }
  }
}

module.exports = { productSkuPrefix, nextProductSku, assignAutomaticProductSku, withProductSku };
