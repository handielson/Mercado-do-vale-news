import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('deploy-vps-server-only.cjs', 'utf8');
const start = source.indexOf("if (process.argv.includes('--sales-marketplaces-only'))");
const end = source.indexOf("if (process.argv.includes('--marketing-scenes-migration-only'))", start);
assert.ok(start >= 0 && end > start, 'selective sales marketplace deploy mode must exist');
const block = source.slice(start, end);

assert.match(block, /pm_exec_path/, 'selective deploy must validate the active PM2 runtime');
assert.match(block, /vps_server\.cjs/, 'selective deploy must publish the active sales API server');
assert.match(block, /mercadoLivreServicePath/, 'selective deploy must publish the Mercado Livre sales route');
assert.match(block, /\.next\.cjs/, 'selective deploy must validate staged remote files before replacing runtime files');
assert.match(block, /Sales marketplaces backup/, 'selective deploy must preserve a rollback backup');
assert.match(block, /pm2 restart mdv-api --update-env/, 'selective deploy must restart the API exactly once after both files are ready');
assert.doesNotMatch(block, /uploadAutoresponder|applyCompanyFiscalMigration|uploadSmartphonePhotoIntakeFiles/, 'selective deploy must not publish unrelated services');

console.log('selective sales marketplaces deploy static checks passed');
