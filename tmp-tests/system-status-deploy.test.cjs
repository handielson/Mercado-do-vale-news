const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { deploySystemStatus, patchSystemStatus, REGISTRATION } = require('../scripts/deploy-system-status.cjs');
const source = "// preserve production\r\nasync function requireAdminBearerToken(req) {}\r\nfastify.get('/status', async (req, reply) => { return 'unchanged'; });\r\n";
const appDir = '/var/www/mdv-api';
function fakeRuntime() {
  const files = new Map(['server.js', 'vps_server.js', 'vps_server.cjs'].map(file => [`${appDir}/${file}`, source]));
  const commands = []; const writes = [];
  return { files, commands, writes, args: {
    appDir, apiProc: { name: 'mdv-api', pm2_env: { pm_exec_path: `${appDir}/server.js` } },
    root: path.resolve(__dirname, '..'),
    read: async file => files.get(file) || '',
    write: async (file, content) => { writes.push(file); files.set(file, content); },
    exec: async command => { commands.push(command); if (command.startsWith('mv ')) {
      const [, from, to] = command.split(' '); files.set(to, files.get(from)); files.delete(from);
    } else if (command.startsWith('rm -f ')) files.delete(command.slice(6)); return ''; },
  } };
}
test('remote patch preserves every unrelated byte and is idempotent', () => {
  const patched = patchSystemStatus(source);
  assert.equal(patched.replace(`${REGISTRATION}\r\n\r\n`, ''), source);
  assert.equal(patchSystemStatus(patched), patched);
  assert.throws(() => patchSystemStatus(source + source), /ambiguous/);
  assert.throws(() => patchSystemStatus(source.replace('async function requireAdminBearerToken(', 'function unsafe(')), /authentication/);
  assert.throws(() => patchSystemStatus(patched + REGISTRATION), /Duplicate/);
});
test('full deploy ships the required module before any entry registers it', () => {
  const deploy = fs.readFileSync(path.resolve(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
  const defaultDeploy = deploy.slice(deploy.indexOf('console.log(`Uploading server to'));
  assert.ok(defaultDeploy.indexOf("await upload(path.join(__dirname, 'services/whatsappStatusHealth.cjs')") < defaultDeploy.indexOf('await upload(localServer,'));
  assert.ok(deploy.includes("process.argv.includes('--system-status-check')"));
});
test('check mode reads the planned production files without writes or restart', async () => {
  const runtime = fakeRuntime();
  const result = await deploySystemStatus({ ...runtime.args, checkOnly: true });
  assert.equal(result.files.length, 4);
  assert.deepEqual(runtime.writes, []); assert.deepEqual(runtime.commands, []);
});
test('unexpected target or modified production module stops before mutation', async () => {
  const runtime = fakeRuntime();
  await assert.rejects(deploySystemStatus({ ...runtime.args, appDir: '/other' }), /target/);
  runtime.files.set(`${appDir}/services/whatsappStatusHealth.cjs`, '// remote unreviewed');
  await assert.rejects(deploySystemStatus(runtime.args), /baseline/);
  assert.deepEqual(runtime.writes, []); assert.deepEqual(runtime.commands, []);
});
test('syntax failure does not promote files or restart the running API', async () => {
  const runtime = fakeRuntime(); const originalExec = runtime.args.exec;
  runtime.args.exec = async command => { if (command.startsWith('node --check')) throw new Error('invalid syntax'); return originalExec(command); };
  await assert.rejects(deploySystemStatus(runtime.args), /invalid syntax/);
  assert.equal(runtime.files.get(`${appDir}/server.js`), source);
  assert.equal(runtime.files.has(`${appDir}/services/whatsappStatusHealth.cjs`), false);
  assert.equal(runtime.commands.some(command => command.startsWith('mv ') || command.startsWith('pm2 ')), false);
  assert.equal([...runtime.files.keys()].some(file => file.endsWith('.release-check.cjs')), false);
});
test('restart failure restores original entries and removes a previously absent module', async () => {
  const runtime = fakeRuntime(); const originalExec = runtime.args.exec; let restarts = 0;
  runtime.args.exec = async command => { if (command === 'pm2 restart mdv-api' && ++restarts === 1) throw new Error('restart failed'); return originalExec(command); };
  await assert.rejects(deploySystemStatus(runtime.args), /restart failed/);
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) assert.equal(runtime.files.get(`${appDir}/${file}`), source);
  assert.equal(runtime.files.has(`${appDir}/services/whatsappStatusHealth.cjs`), false);
  assert.equal(restarts, 2);
});
