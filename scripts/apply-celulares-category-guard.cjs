'use strict';

// celulares-category-guard-v1 (22/11/2026): a categoria principal "Celulares" não recebe produto.
// Produto lá some da lista do robô (que busca "Smartphones") — caso Redmi 15C 4/256, propostas #12–#17.
// Triggers no MySQL valem para todo caminho (admin, Bling, API): inserir ou MUDAR para "Celulares" dá erro
// pedindo a subcategoria. Atualizar estoque/preço de produto que já está lá não é bloqueado.
// Uso na VPS como root (pasta /var/www/mdv-api): node apply-celulares-category-guard.cjs [--apply]
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

const MSG = 'Categoria Celulares nao recebe produto: escolha a subcategoria (ex.: Smartphones, Capinhas, Peliculas).';

async function main() {
  const apply = process.argv.includes('--apply');
  const e = process.env;
  // Trigger com log binário exige root (socket), como em scripts/deploy-smartphone-moving-average.cjs.
  const db = await mysql.createConnection({ user: 'root', socketPath: '/var/run/mysqld/mysqld.sock', database: e.DB_NAME });
  try {
    const [cats] = await db.query("SELECT id FROM categories WHERE name = 'Celulares' AND parent_id IS NULL");
    if (cats.length !== 1) throw new Error(`categoria raiz Celulares: ${cats.length} encontradas`);
    const root = cats[0].id;
    if (!/^[0-9a-f-]{36}$/.test(root)) throw new Error('id inesperado');
    const [[{ n }]] = await db.query('SELECT COUNT(*) n FROM products WHERE category_id = ?', [root]);
    console.log(JSON.stringify({ root, produtosNaRaiz: n, apply }));
    if (!apply) return;
    await db.query('DROP TRIGGER IF EXISTS mdv_products_celulares_root_ins');
    await db.query('DROP TRIGGER IF EXISTS mdv_products_celulares_root_upd');
    await db.query(`CREATE TRIGGER mdv_products_celulares_root_ins BEFORE INSERT ON products FOR EACH ROW
      BEGIN IF NEW.category_id = '${root}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${MSG}'; END IF; END`);
    await db.query(`CREATE TRIGGER mdv_products_celulares_root_upd BEFORE UPDATE ON products FOR EACH ROW
      BEGIN IF NEW.category_id = '${root}' AND NOT (OLD.category_id <=> NEW.category_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${MSG}'; END IF; END`);
    // Conferência: inserir e mover para a raiz falham; transação desfeita.
    const [[prod]] = await db.query("SELECT id FROM products WHERE category_id <> ? AND status = 'active' LIMIT 1", [root]);
    const checks = {};
    await db.beginTransaction();
    try { await db.query('UPDATE products SET category_id = ? WHERE id = ?', [root, prod.id]); checks.update = 'NAO BLOQUEOU'; }
    catch (err) { checks.update = /Celulares nao recebe/.test(err.message) ? 'bloqueado' : err.message; }
    try { await db.query("INSERT INTO products (id, name, sku, category_id) VALUES (UUID(), 'teste guarda', CONCAT('TESTE-GUARDA-', UUID_SHORT()), ?)", [root]); checks.insert = 'NAO BLOQUEOU'; }
    catch (err) { checks.insert = /Celulares nao recebe/.test(err.message) ? 'bloqueado' : err.message.slice(0, 120); }
    try { await db.query('UPDATE products SET updated_at = updated_at WHERE id = ?', [prod.id]); checks.updateNormal = 'ok'; }
    catch (err) { checks.updateNormal = err.message; }
    await db.rollback();
    console.log(JSON.stringify(checks));
    if (checks.update !== 'bloqueado' || checks.insert !== 'bloqueado' || checks.updateNormal !== 'ok') process.exitCode = 1;
  } finally { await db.end(); }
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; });
