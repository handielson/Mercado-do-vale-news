import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/pin-n8n-stack-version.cjs', 'utf8');
assert.match(source, /docker\.n8n\.io\/n8nio\/n8n:\$\{VERSION\}/, 'must pin the main n8n image');
assert.match(source, /n8nio\/runners:\$\{VERSION\}/, 'must pin the runner to the same version');
assert.match(source, /scale \$\{RUNNER_SERVICE\}=0[\s\S]*scale \$\{N8N_SERVICE\}=0/, 'must stop runner before n8n');
assert.match(source, /scale \$\{N8N_SERVICE\}=1[\s\S]*scale \$\{RUNNER_SERVICE\}=1/, 'must start n8n before runner');
assert.match(source, /prependListener/, 'must fail validation if the known crash remains');
assert.match(source, /restore_test=passed[\s\S]*sha256sum -c SHA256SUMS/, 'must verify a restore-tested backup before stopping services');
assert.match(source, /-mmin -30[\s\S]*inspectIngress\(conn, 'status'\)[\s\S]*ingress\.evolution\.enabled[\s\S]*ingress\.meta\.enabled/, 'recent backup and both paused ingresses are mandatory before scale-down');
for (const required of ['N8N_ENCRYPTION_KEY=', 'N8N_USER_MANAGEMENT_JWT_SECRET=', 'DB_POSTGRESDB_HOST=n8n-db', 'N8N_BLOCK_ENV_ACCESS_IN_NODE=false']) {
  assert.ok(source.includes(required), `must validate the preserved service setting ${required}`);
}
assert.doesNotMatch(source, /docker service update --env-add N8N_BLOCK_ENV_ACCESS_IN_NODE/, 'upgrade must not silently rewrite runner access policy');
assert.match(source, /status='running'[\s\S]*status='crashed'/, 'must close only the explicitly authorized stale execution');
assert.match(source, /--stale-executions=[\s\S]*runningIds\.join\(','\) !==[\s\S]*STALE_EXECUTION_IDS\.join\(','\)/, 'must require the exact explicit set of stale execution IDs');
assert.match(source, /"startedAt" < now\(\) - interval '30 minutes'/, 'must never close a recently started execution');
assert.match(source, /dropdb[\s\S]*pg_restore[\s\S]*oldN8nImage[\s\S]*oldRunnerImage/, 'failed migrations must restore the database and both previous images');
assert.match(source, /healthz[\s\S]*workflow_entity[\s\S]*workflow_history/, 'post-upgrade validation must include health and active workflow consistency');
assert.match(source, /count\(\*\) filter \(where[\s\S]*left join workflow_history[\s\S]*matchingWorkflowCount !== activeWorkflowCount/, 'all active workflows must match their published history');
const rollbackArmedAt = source.indexOf('stopped = true;', source.indexOf('async function main()'));
const firstScaleDownAt = source.indexOf('docker service scale ${RUNNER_SERVICE}=0 >/dev/null', source.indexOf('async function main()'));
const consistencyCheckAt = source.indexOf('matchingWorkflowCount !== activeWorkflowCount');
const rollbackDisarmedAt = source.indexOf('stopped = false;', rollbackArmedAt);
assert.ok(rollbackArmedAt !== -1 && rollbackArmedAt < firstScaleDownAt, 'rollback must be armed before stopping the first service');
assert.ok(consistencyCheckAt !== -1 && rollbackDisarmedAt > consistencyCheckAt, 'rollback must remain armed through all post-upgrade checks');
assert.doesNotMatch(source, /:latest/, 'must not restore mutable latest tags');
console.log('n8n stack version pin static checks passed');
