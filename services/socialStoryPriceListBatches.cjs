const crypto = require('node:crypto');
const { validateSelection } = require('./phonePriceListServer.cjs');
const STRIDE = 1000;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sqlDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

function priceListRecipe(input) {
  if (!input) return null;
  if (input.groups) throw Object.assign(new Error('O agendamento de tabelas usa marcas, formato e tipo de preço.'), { statusCode: 400 });
  const { brands, priceMode, layout } = validateSelection(input);
  return { brands, priceMode, layout };
}

async function ensurePriceListBatchTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS social_story_price_list_batches (
    schedule_id CHAR(36) NOT NULL,
    batch_index INT UNSIGNED NOT NULL,
    scheduled_at DATETIME NOT NULL,
    recipe JSON NOT NULL,
    delay_seconds INT UNSIGNED NOT NULL,
    generated_at DATETIME NULL,
    retry_at DATETIME NULL,
    last_error TEXT NULL,
    PRIMARY KEY (schedule_id,batch_index),
    INDEX idx_story_price_list_due (generated_at,scheduled_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

// A whole occurrence is generated once, before either destination can claim it.
// Reserved sequence ranges allow the current stock to change the page count.
async function refreshNextPriceListBatch(pool, dependencies) {
  const connection = await pool.getConnection();
  let batch;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT b.*,DATE_FORMAT(b.scheduled_at,'%Y-%m-%dT%H:%i:%sZ') AS scheduled_iso,s.destinations FROM social_story_price_list_batches b
      JOIN social_story_schedules s ON s.id=b.schedule_id
      WHERE b.generated_at IS NULL AND b.scheduled_at<=NOW()
        AND (b.retry_at IS NULL OR b.retry_at<=NOW()) AND s.status IN ('approved','processing')
      ORDER BY b.scheduled_at LIMIT 1 FOR UPDATE SKIP LOCKED`);
    batch = rows[0];
    if (!batch) { await connection.rollback(); return null; }
    const recipe = typeof batch.recipe === 'string' ? JSON.parse(batch.recipe) : batch.recipe;
    const preview = await dependencies.generatePhonePriceList(priceListRecipe(recipe));
    if (!Array.isArray(preview.items) || preview.items.length > 80) throw new Error('Quantidade de páginas da tabela inválida (máximo 80).');
    const first = Number(batch.batch_index) * STRIDE;
    const last = first + STRIDE;
    // Never replace an occurrence which has already begun sending.
    const [[started]] = await connection.query(`SELECT COUNT(*) AS total FROM social_story_deliveries d
      JOIN social_story_items i ON i.id=d.item_id WHERE i.schedule_id=? AND i.sequence_index>=? AND i.sequence_index<?
      AND d.status IN ('processing','published')`, [batch.schedule_id, first, last]);
    if (Number(started.total)) throw new Error('Tabela já iniciada sem registro de geração; requer conferência.');
    if (!preview.items.length) {
      // Keep an auditable cancelled placeholder; never send yesterday's stock.
      await connection.query(`UPDATE social_story_deliveries d JOIN social_story_items i ON i.id=d.item_id
        SET d.status='cancelled',d.last_error='Nenhum celular disponível na geração atual'
        WHERE i.schedule_id=? AND i.sequence_index>=? AND i.sequence_index<? AND d.status='pending'`, [batch.schedule_id, first, last]);
    } else {
      await connection.query(`DELETE d FROM social_story_deliveries d JOIN social_story_items i ON i.id=d.item_id
        WHERE i.schedule_id=? AND i.sequence_index>=? AND i.sequence_index<?`, [batch.schedule_id, first, last]);
      await connection.query('DELETE FROM social_story_items WHERE schedule_id=? AND sequence_index>=? AND sequence_index<?', [batch.schedule_id, first, last]);
      const destinations = typeof batch.destinations === 'string' ? JSON.parse(batch.destinations) : batch.destinations;
      const base = new Date(batch.scheduled_iso);
      for (const [index, item] of preview.items.entries()) {
        if (!/^https:\/\//i.test(item.mediaUrl || '')) throw new Error('A tabela precisa de imagem pública HTTPS.');
        const id = crypto.randomUUID();
        const sequence = first + index;
        await connection.query(`INSERT INTO social_story_items (id,schedule_id,sequence_index,media_type,media_url,label,caption,scheduled_at)
          VALUES (?,?,?,'image',?,?,?,?)`, [id, batch.schedule_id, sequence, item.mediaUrl, item.label || null, item.caption || null,
          sqlDate(new Date(base.getTime() + index * Number(batch.delay_seconds) * 1000))]);
        for (const destination of destinations) {
          await connection.query(`INSERT INTO social_story_deliveries (id,schedule_id,item_id,destination,idempotency_key,status)
            VALUES (?,?,?,?,?,'pending')`, [crypto.randomUUID(), batch.schedule_id, id, destination, hash(`${batch.schedule_id}:${sequence}:${destination}`)]);
        }
      }
    }
    await connection.query('UPDATE social_story_price_list_batches SET generated_at=NOW(),retry_at=NULL,last_error=NULL WHERE schedule_id=? AND batch_index=?', [batch.schedule_id, batch.batch_index]);
    await connection.commit();
    return { scheduleId: batch.schedule_id, itemCount: preview.items.length };
  } catch (error) {
    await connection.rollback();
    if (!batch) throw error;
    await pool.query(`UPDATE social_story_price_list_batches SET retry_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE),last_error=?
      WHERE schedule_id=? AND batch_index=? AND generated_at IS NULL`, [String(error.message).slice(0, 2000), batch.schedule_id, batch.batch_index]);
    await pool.query("UPDATE social_story_schedules SET last_error=? WHERE id=? AND status<>'cancelled'", [String(error.message).slice(0, 2000), batch.schedule_id]);
    return { scheduleId: batch.schedule_id, retry: true };
  } finally { connection.release(); }
}

module.exports = { STRIDE, priceListRecipe, ensurePriceListBatchTable, refreshNextPriceListBatch };
