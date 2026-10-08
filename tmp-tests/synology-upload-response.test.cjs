const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Fastify = require('fastify');

for (const entry of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
    test(`${entry}: upload receipt survives asynchronous serialization hooks`, async t => {
        const app = Fastify();
        t.after(() => app.close());
        const queued = [];
        app.addHook('preSerialization', async (_req, _reply, payload) => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return payload;
        });
        const source = fs.readFileSync(path.join(__dirname, '..', entry), 'utf8');
        const start = source.indexOf("fastify.post('/synology/upload',");
        const end = source.indexOf('// DELETE /synology/file', start);
        assert.ok(start > 0 && end > start);
        function authenticate(req, _reply, done) {
            req.customerAccess = { isAdmin: true };
            req.parts = async function* () {
                yield { type: 'file', fieldname: 'file', filename: 'test.jpg',
                    file: (async function* () { yield Buffer.from('test-file'); })() };
            };
            done();
        }
        vm.runInNewContext(source.slice(start, end), {
            fastify: app, URL, Buffer, console,
            SYNO_FOLDERS: { imagens: '/images' }, SYNO_CDN: { imagens: 'https://media.example/images' },
            SYNO_USER: 'test', SYNO_PASS: 'test', SYNO_URL: 'https://nas.example',
            getSynologyRequestPort: () => 443,
            createSynologyUploadStatus: () => ({ id: 'upload-test', status: 'queued', debug: {} }),
            requireSyncKeyOrCustomer: authenticate,
            requireSyncKeyOrAdmin: authenticate,
            setImmediate: callback => queued.push(callback),
        });
        const response = await app.inject({ method: 'POST', url: '/synology/upload?folder=imagens' });
        assert.equal(response.statusCode, 200);
        assert.match(response.headers['content-type'], /application\/json/);
        const receipt = response.json();
        assert.equal(receipt.ok, true);
        assert.equal(receipt.uploadId, 'upload-test');
        assert.equal(receipt.url, 'https://media.example/images/test.jpg');
        assert.equal(queued.length, 1, 'upload stays in background and is queued once');
        const rejected = await app.inject({ method: 'POST', url: '/synology/upload?folder=invalid' });
        assert.equal(rejected.statusCode, 400);
        assert.equal(rejected.json().error, 'Invalid folder');
        assert.equal(queued.length, 1);
    });
}
