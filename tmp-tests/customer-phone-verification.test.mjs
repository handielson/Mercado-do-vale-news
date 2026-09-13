import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import Fastify from 'fastify';
import verification from '../services/customerPhoneVerificationServer.cjs';

const { createCustomerPhoneVerification, normalizeVerificationPhone, pendingPhoneVerification, verificationClientIp } = verification;
const validPhone = '11987654321';

test('publicação envia o módulo obrigatório da confirmação e Google novo exige completar o telefone', () => {
    assert.match(readFileSync('deploy-vps-server-only.cjs', 'utf8'),
        /await upload\(path.join\(__dirname, 'services\/customerPhoneVerificationServer.cjs'\)/);
    assert.match(readFileSync('services/customerGoogleAuthServer.cjs', 'utf8'), /"whatsapp_verification_required":true/);
});

// Adapter transacional em memória: sem rede, sem MySQL ou mensagens reais.
// A fila serializa FOR UPDATE e snapshots reproduzem commit/rollback.
function fixture({ sendOk = true } = {}) {
    let state = { codes: {}, limits: {} };
    let tail = Promise.resolve();
    let at = 1800000000000;
    const messages = [];
    const query = async (rawSql, values = []) => {
        const sql = rawSql.replace(/\s+/g, ' ').trim();
        if (sql.startsWith('CREATE TABLE')) return [{ affectedRows: 0 }];
        if (sql.startsWith('INSERT IGNORE INTO customer_phone_verification_limits')) {
            state.limits[values[0]] ||= { bucket_key: values[0], window_start: values[1], last_request: 0, requests: 0 };
        } else if (sql.startsWith('SELECT * FROM customer_phone_verification_limits')) {
            return [[structuredClone(state.limits[values[0]])]];
        } else if (sql.startsWith('UPDATE customer_phone_verification_limits')) {
            Object.assign(state.limits[values[3]], { window_start: values[0], last_request: values[1], requests: values[2] });
        } else if (sql.startsWith('INSERT INTO customer_phone_verifications')) {
            state.codes[values[0]] = { phone: values[0], challenge_id: values[1], owner_key: values[2],
                code_hash: values[3], expires_at: values[4], sent: 0, attempts: 0, consumed: 0, proof_hash: null };
        } else if (sql.startsWith('SELECT * FROM customer_phone_verifications')) {
            const row = sql.includes('WHERE phone =') ? state.codes[values[0]]
                : Object.values(state.codes).find(row => row.challenge_id === values[0]);
            return [row ? [structuredClone(row)] : []];
        } else if (sql.startsWith('UPDATE customer_phone_verifications')) {
            const key = values.at(-1);
            const row = sql.includes('WHERE phone =') ? state.codes[key]
                : Object.values(state.codes).find(row => row.challenge_id === key);
            if (row) {
                if (sql.includes('SET sent = 1')) row.sent = 1;
                else if (sql.includes('SET consumed = 1')) row.consumed = 1;
                else if (sql.includes('SET attempts = attempts + 1')) row.attempts++;
                else if (sql.includes('SET proof_hash =')) Object.assign(row, { proof_hash: values[0], proof_expires_at: values[1] });
                else throw new Error('Unhandled UPDATE');
            }
        } else throw new Error('Unexpected query: ' + sql);
        return [{ affectedRows: 1 }];
    };
    const pool = {
        query,
        async getConnection() {
            let releaseLock;
            let snapshot;
            let active = false;
            return {
                query,
                async beginTransaction() {
                    const previous = tail;
                    tail = new Promise(resolve => { releaseLock = resolve; });
                    await previous;
                    snapshot = structuredClone(state);
                    active = true;
                },
                async commit() { active = false; releaseLock?.(); },
                async rollback() { if (active) { state = snapshot; active = false; releaseLock?.(); } },
                release() {},
            };
        },
    };
    const deps = { pool, secret: 'test-secret-only', now: () => at,
        getAuth: async request => ({ customerId: request.customerId || null }),
        send: async (phone, message) => { messages.push({ phone, message }); return { ok: sendOk }; } };
    const service = createCustomerPhoneVerification(deps);
    const request = (body = {}, extra = {}) => ({ ip: '192.0.2.1', headers: {}, body: { purpose: 'registration', phone: validPhone, ...body }, ...extra });
    async function issue(body = {}, extra = {}) {
        const challenge = await service.requestCode(request(body, extra));
        const code = messages.at(-1).message.match(/\b\d{6}\b/)[0];
        return { challenge, code };
    }
    async function confirm(body = {}, extra = {}) {
        const { challenge, code } = await issue(body, extra);
        return service.verifyCode(request({ ...body, challenge_id: challenge.challenge_id, code }, extra));
    }
    async function consume(token, phone = validPhone, owner = 'registration', fail = false) {
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            await service.consume(conn, token, phone, owner);
            if (fail) throw new Error('simulated customer write failure');
            await conn.commit();
        } catch (error) { await conn.rollback(); throw error; }
        finally { conn.release(); }
    }
    return { pool, service, deps, request, issue, confirm, consume, messages, advance: ms => { at += ms; }, state: () => state };
}

test('validação brasileira aceita DDI e rejeita DDD, comprimento e números malformados', () => {
    assert.equal(normalizeVerificationPhone('+55 (11) 98765-4321'), '5511987654321');
    assert.equal(normalizeVerificationPhone('(87) 3861-2345'), '558738612345');
    for (const phone of ['', '119876543210', '00987654321', '11999999999', '11887654321', 'abc11987654321']) {
        assert.equal(normalizeVerificationPhone(phone), '');
    }
    assert.equal(pendingPhoneVerification({ custom_data: '{"whatsapp_verification_required":true}' }), true);
    assert.equal(pendingPhoneVerification({ custom_data: '{}' }), false);
    assert.equal(verificationClientIp({ ip: '192.0.2.1', headers: { 'x-forwarded-for': '198.51.100.9' } }), '192.0.2.1');
    assert.equal(verificationClientIp({ ip: '127.0.0.1', headers: { 'x-forwarded-for': 'forged, 192.0.2.9' } }), '192.0.2.9');
});

test('prova é opaca e não pode ser reutilizada ou usada em outro número/conta', async () => {
    const f = fixture();
    const proof = await f.confirm();
    assert.equal(proof.phone_verification_token.length, 64);
    assert.equal(JSON.stringify(proof).includes(f.messages[0].message.match(/\b\d{6}\b/)[0]), false);
    assert.notEqual(f.state().codes['5511987654321'].proof_hash, proof.phone_verification_token);
    await assert.rejects(f.consume(proof.phone_verification_token, '21987654321'), /inválida/);
    await assert.rejects(f.consume(proof.phone_verification_token, validPhone, 'profile:other'), /inválida/);
    await f.consume(proof.phone_verification_token);
    await assert.rejects(f.consume(proof.phone_verification_token), /inválida/);
});

test('cinco tentativas erradas bloqueiam inclusive o código correto; reenvio invalida o anterior', async () => {
    const f = fixture();
    const { challenge, code } = await f.issue();
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) await assert.rejects(f.service.verifyCode(f.request({ challenge_id: challenge.challenge_id, code: wrong })));
    await assert.rejects(f.service.verifyCode(f.request({ challenge_id: challenge.challenge_id, code })));
    await assert.rejects(f.issue(), error => error.statusCode === 429);
    f.advance(61000);
    const second = await f.issue();
    assert.notEqual(second.challenge.challenge_id, challenge.challenge_id);
    await assert.rejects(f.service.verifyCode(f.request({ challenge_id: challenge.challenge_id, code })));
    await f.service.verifyCode(f.request({ challenge_id: second.challenge.challenge_id, code: second.code }));
});

test('expiração vale para o código e também para a prova confirmada', async () => {
    const f = fixture();
    const { challenge, code } = await f.issue();
    f.advance(600001);
    await assert.rejects(f.service.verifyCode(f.request({ challenge_id: challenge.challenge_id, code })));
    const proof = await f.confirm();
    f.advance(600001);
    await assert.rejects(f.consume(proof.phone_verification_token), /expirada/);
});

test('falha de envio não libera confirmação e não vaza corpo da integração', async () => {
    const f = fixture({ sendOk: false });
    await assert.rejects(f.issue(), error => error.statusCode === 503);
    assert.equal(f.state().codes['5511987654321'].consumed, 1);
    await assert.rejects(f.consume('a'.repeat(64)));
});

test('consumo volta no rollback e confirmação concorrente libera apenas uma prova', async () => {
    const f = fixture();
    const { challenge, code } = await f.issue();
    const results = await Promise.allSettled([
        f.service.verifyCode(f.request({ challenge_id: challenge.challenge_id, code })),
        f.service.verifyCode(f.request({ challenge_id: challenge.challenge_id, code })),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const token = results.find(result => result.status === 'fulfilled').value.phone_verification_token;
    await assert.rejects(f.consume(token, validPhone, 'registration', true), /simulated/);
    await f.consume(token);
});

test('limites persistem após recriar o serviço e bloqueiam abuso por telefone e IP', async () => {
    const f = fixture();
    await f.issue();
    const restarted = createCustomerPhoneVerification(f.deps);
    await assert.rejects(restarted.requestCode(f.request()), error => error.statusCode === 429);
    for (let i = 1; i < 5; i++) { f.advance(61000); await f.issue(); }
    f.advance(61000);
    await assert.rejects(f.issue(), error => error.statusCode === 429);
    for (let i = 0; i < 5; i++) await f.issue({ phone: '2198765432' + i });
    await assert.rejects(f.issue({ phone: '31987654321' }), error => error.statusCode === 429);
});

test('perfil exige sessão e prova restrita à conta', async () => {
    const f = fixture();
    await assert.rejects(f.issue({ purpose: 'profile' }), error => error.statusCode === 401);
    const proof = await f.confirm({ purpose: 'profile' }, { customerId: 'customer-1' });
    await assert.rejects(f.consume(proof.phone_verification_token), /inválida/);
    await f.consume(proof.phone_verification_token, validPhone, 'profile:customer-1');
});

test('HTTP expõe request/verify e devolve erro de validação sem enviar para número inválido', async () => {
    const f = fixture();
    const app = Fastify();
    f.service.register(app);
    const response = await app.inject({ method: 'POST', url: '/auth/phone/request', payload: { phone: '000', purpose: 'registration' } });
    assert.equal(response.statusCode, 400);
    assert.equal(f.messages.length, 0);
    await app.close();
});

for (const file of ['vps_server.cjs', 'vps_server.js']) {
    const source = readFileSync(file, 'utf8');
    test(file + ': cadastro confirmado grava em transação e nunca aceita perfil admin do visitante', async () => {
        let handler;
        const events = [];
        const customer = { id: 'new-customer', name: 'Ana Silva' };
        const connection = {
            beginTransaction: async () => events.push('begin'),
            commit: async () => events.push('commit'),
            rollback: async () => events.push('rollback'),
            release: () => events.push('release'),
            query: async (sql, values) => {
                if (sql.includes('INSERT INTO customers')) {
                    assert.equal(values[8], 'CUSTOMER');
                    assert.equal(values[3], 'Ana Silva');
                    events.push('insert');
                }
                return [[]];
            },
        };
        const context = {
            fastify: { post: (_path, fn) => { handler = fn; } },
            pool: { getConnection: async () => connection },
            ensureCustomerAuthTable: async () => {},
            normalizeAuthEmail: value => String(value || ''),
            normalizeAuthDocument: value => String(value || ''),
            normalizeAuthCustomerName: value => String(value || '').trim(),
            normalizeVerificationPhone, isValidAuthEmail: () => true,
            customerPhoneVerification: { ensure: async () => {}, consume: async (conn, token) => {
                assert.equal(conn, connection); assert.equal(token, 'verified-token'); events.push('proof');
            } },
            findCustomerForAuth: async (query, conn) => {
                assert.equal(conn, connection);
                return query.customerId ? customer : null;
            },
            crypto: { randomUUID: () => 'new-customer' },
            normalizeAuthCustomerType: value => value.toUpperCase(),
            process: { env: { DEFAULT_COMPANY_ID: 'company' } },
            hashVpsPassword: async () => ({ salt: 'salt', hash: 'hash' }),
            syncCustomerGoogleContactRecord: async () => events.push('sync'),
            notifyCustomerRegisteredWhatsApp: async () => {},
            authResponseForCustomer: value => value,
        };
        vm.createContext(context);
        vm.runInContext(source.slice(source.indexOf("fastify.post('/auth/register'"), source.indexOf("fastify.get('/auth/me'")), context);
        const reply = { code(status) { this.status = status; return this; }, send(body) { return body; } };
        await handler({ body: { name: ' Ana Silva ', password: 'secret123', cpf_cnpj: '12345678901',
            phone: validPhone, phone_verification_token: 'verified-token', customer_type: 'admin' } }, reply);
        assert.equal(reply.status, 201);
        assert.deepEqual(events, ['begin', 'proof', 'insert', 'commit', 'release', 'sync']);
    });
    test(file + ': cadastro sem prova não grava cliente e sessão Google pendente só acessa conclusão', async () => {
        const routes = {};
        let mutations = 0;
        const pool = {
            query: async sql => {
                if (sql.startsWith('SELECT id, user_id')) return [[{ id: 'google-pending', custom_data: '{"whatsapp_verification_required":true}' }]];
                throw new Error('unexpected pool query');
            },
            getConnection: async () => ({
                beginTransaction: async () => {}, rollback: async () => {}, release() {},
                query: async () => { mutations++; throw new Error('must not write customer'); },
            }),
        };
        const context = {
            fastify: { post: (path, handler) => { routes[path] = handler; } }, pool,
            ensureCustomerAuthTable: async () => {},
            normalizeAuthEmail: value => String(value || '').trim().toLowerCase(),
            normalizeAuthDocument: value => String(value || '').replace(/\D/g, ''),
            normalizeAuthCustomerName: value => String(value || '').trim(),
            normalizeVerificationPhone, isValidAuthEmail: () => true,
            customerPhoneVerification: { ensure: async () => {}, consume: async () => { throw new Error('phone proof required'); } },
            getBearerToken: () => 'test-token', verifyVpsAuthToken: () => ({ customerId: 'google-pending' }),
            pendingPhoneVerification, normalizeAuthCustomerType: () => 'CUSTOMER', console,
        };
        vm.createContext(context);
        const route = source.slice(source.indexOf("fastify.post('/auth/register'"), source.indexOf("fastify.get('/auth/me'"));
        vm.runInContext(route, context);
        const reply = { code(status) { this.status = status; return this; }, send(body) { return body; } };
        await routes['/auth/register']({ body: { name: 'Ana Silva', password: 'secret123', cpf_cnpj: '12345678901', email: 'test@example.test' } }, reply);
        assert.equal(reply.status, 400, 'e-mail não dispensa telefone');
        await assert.rejects(routes['/auth/register']({ body: { name: 'Ana Silva', password: 'secret123', cpf_cnpj: '12345678901', phone: validPhone } }, reply), /proof required/);
        assert.equal(mutations, 0);
        const authFn = source.slice(source.indexOf('async function getVpsBearerAuthContext('), source.indexOf('async function isAdminBearerToken('));
        vm.runInContext(authFn, context);
        assert.equal((await context.getVpsBearerAuthContext({ url: '/customer/checkin' })).customerId, null);
        assert.equal((await context.getVpsBearerAuthContext({ url: '/auth/profile' })).customerId, 'google-pending');
    });
}
