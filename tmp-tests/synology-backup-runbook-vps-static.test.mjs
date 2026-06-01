import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const backupScript = readFileSync('backup-synology.cjs', 'utf8');

assert.doesNotMatch(
  backupScript,
  /vercel|Vercel|npx vercel|vercel\.app/,
  'Synology backup runbook should not direct deploys, URLs, or rollback to Vercel'
);

assert.doesNotMatch(
  backupScript,
  /Supabase|SUPABASE/,
  'Synology backup runbook should describe VPS/Synology dependencies instead of Supabase'
);

assert.match(
  backupScript,
  /mercadodovale\.com\.br/,
  'Synology backup runbook should point production checks at the public VPS-backed domain'
);

assert.equal(
  existsSync('check-stock-sync.mjs'),
  false,
  'legacy stock sync diagnostic should be retired because it reads Supabase webhook logs and references Vercel'
);

console.log('Synology backup VPS runbook static checks passed');
