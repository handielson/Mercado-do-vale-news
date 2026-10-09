// Explicit release repair: only future, unstarted occurrences of these verified table schedules.
const TARGETS = ['fb15a96c-3bee-464a-b5e8-87dcaace4d60', '619aed6a-6282-486c-8872-82f485be54b1'];
function automaticRecipe(value) {
  const recipe = typeof value === 'string' ? JSON.parse(value) : value;
  if (!recipe || recipe.brandMode !== undefined || !Array.isArray(recipe.brands)
    || [...new Set(recipe.brands)].sort().join('|') !== 'POCO|Xiaomi|realme') return null;
  return { ...recipe, brandMode: 'all', brands: null };
}
async function promotePending(db, { apply = false, backup } = {}) {
  await db.beginTransaction();
  try {
    const [rows] = await db.query(`SELECT b.schedule_id,b.batch_index,b.scheduled_at,b.recipe
      FROM social_story_price_list_batches b JOIN social_story_schedules s ON s.id=b.schedule_id
      WHERE b.schedule_id IN (?,?) AND s.status IN ('approved','processing')
        AND b.generated_at IS NULL AND b.scheduled_at>NOW()
        AND NOT EXISTS (SELECT 1 FROM social_story_items i JOIN social_story_deliveries d ON d.item_id=i.id
          WHERE i.schedule_id=b.schedule_id AND i.sequence_index>=b.batch_index*1000
            AND i.sequence_index<(b.batch_index+1)*1000 AND d.status IN ('processing','published'))
      ORDER BY b.schedule_id,b.batch_index FOR UPDATE`, TARGETS);
    const changes = rows.flatMap(row => {
      const recipe = automaticRecipe(row.recipe);
      return recipe ? [{ ...row, next_recipe: recipe }] : [];
    });
    if (!apply) { await db.rollback(); return { dryRun: true, occurrences: changes.length, schedules: [...new Set(changes.map(r => r.schedule_id))] }; }
    if (changes.length) {
      if (!backup) throw Error('Backup obrigatório antes da alteração');
      await backup(changes);
      for (const row of changes) {
        const [result] = await db.query(`UPDATE social_story_price_list_batches SET recipe=?
          WHERE schedule_id=? AND batch_index=? AND generated_at IS NULL AND scheduled_at>NOW()`,
        [JSON.stringify(row.next_recipe), row.schedule_id, row.batch_index]);
        if (result.affectedRows !== 1) throw Error('Ocorrência mudou durante o reparo');
        const [[saved]] = await db.query('SELECT recipe FROM social_story_price_list_batches WHERE schedule_id=? AND batch_index=?', [row.schedule_id, row.batch_index]);
        const actual = typeof saved.recipe === 'string' ? JSON.parse(saved.recipe) : saved.recipe;
        if (JSON.stringify(actual) !== JSON.stringify(row.next_recipe)) {
          // MySQL JSON object key order is not stable.
          require('node:assert/strict').deepEqual(actual, row.next_recipe);
        }
      }
    }
    await db.commit();
    return { applied: true, occurrences: changes.length, schedules: [...new Set(changes.map(r => r.schedule_id))] };
  } catch (error) { await db.rollback(); throw error; }
}
async function main() {
  if (process.argv.includes('--remote')) {
    require('dotenv').config({ path: '.env', quiet: true });
    const fs = require('node:fs/promises');
    const db = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    try {
      let backupPath;
      const result = await promotePending(db, { apply: process.argv.includes('--apply'), backup: async rows => {
        const directory = '/var/www/mdv-api/backups';
        await fs.mkdir(directory, { recursive: true });
        backupPath = `${directory}/phone-brands-recipes-${Date.now()}.json`;
        await fs.writeFile(backupPath, JSON.stringify(rows, null, 2), { mode: 0o600, flag: 'wx' });
      } });
      console.log(JSON.stringify({ ...result, backupPath }));
    } finally { await db.end(); }
    return;
  }
  const { Client } = require('ssh2');
  const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
  const source = require('node:fs').readFileSync(__filename, 'utf8');
  const command = `cd /var/www/mdv-api && node -e "process.argv.push('--remote'${process.argv.includes('--apply') ? ",'--apply'" : ''});eval(Buffer.from('${Buffer.from(source).toString('base64')}','base64').toString())"`;
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('error', reject).on('ready', () => conn.exec(command, (error, stream) => {
      if (error) { conn.end(); reject(error); return; }
      let output = '';
      stream.on('data', data => { output += data; });
      stream.stderr.on('data', () => {});
      stream.on('close', code => { conn.end(); code === 0 ? (console.log(output.trim()), resolve()) : reject(Error('Reparo falhou; alterações revertidas.')); });
    })).connect(getVpsSshConfig());
  });
}
module.exports = { automaticRecipe, promotePending };
if (require.main === module || process.argv.includes('--remote')) main().catch(error => { console.error(error.message); process.exitCode = 1; });
