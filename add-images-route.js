#!/usr/bin/env node
// add-images-route.js
// Adiciona o endpoint PATCH /products/images ao server.js da VPS
// Executar na VPS: node add-images-route.js

const fs = require('fs');
const path = '/var/www/mdv-api/server.js';

const content = fs.readFileSync(path, 'utf8');

const newRoute = `

// PATCH /products/images — Atualiza imagens de um produto por SKU (sync de imagens)
fastify.patch('/products/images', async (req, reply) => {
  const syncKey = req.headers['x-sync-key'];
  if (!syncKey || syncKey !== process.env.SYNC_KEY) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const { sku, images } = req.body;
  if (!sku || !Array.isArray(images)) {
    return reply.code(400).send({ error: 'sku and images[] required' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE products SET images = ?, updated_at = NOW() WHERE sku = ?',
      [JSON.stringify(images), sku]
    );
    return { affectedRows: result.affectedRows };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: err.message });
  }
});

`;

// Inserir antes da linha do fastify.listen
if (content.includes('PATCH /products/images')) {
  console.log('✅ Rota PATCH /products/images já existe — nada a fazer');
  process.exit(0);
}

const marker = 'fastify.listen(';
const idx = content.indexOf(marker);
if (idx === -1) {
  console.error('❌ Marcador fastify.listen não encontrado');
  process.exit(1);
}

const updated = content.slice(0, idx) + newRoute + content.slice(idx);
fs.writeFileSync(path, updated, 'utf8');
console.log('✅ Rota PATCH /products/images adicionada ao server.js');
