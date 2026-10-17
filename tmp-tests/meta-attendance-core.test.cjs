'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { sameSecret, verifySignature, normalizeEnvelope, conversationKey, MAX_EVENTS } = require('../services/metaAttendanceCore.cjs');

const assets = { instagramAccountId: 'ig:loja/01', pageId: 'page:loja/01' };
const message = (mid = 'mid:opaco/001', extra = {}) => ({
  sender: { id: '00012345678901234567890' }, recipient: { id: assets.instagramAccountId },
  timestamp: 1792200000000, message: { mid, text: 'Olá, tem este aparelho?' }, ...extra,
});
const envelope = (object, entry) => ({ object, entry: [entry] });
const instagram = (messaging = [], changes = []) => envelope('instagram', { id: assets.instagramAccountId, time: 1792200000, messaging, changes });
const igComment = (id = 'comment:01', parent = undefined) => ({ field: 'comments', value: {
  id, from: { id: 'cliente:opaco/01' }, text: 'Qual o valor?', media: { id: 'post:01' },
  ...(parent ? { parent_id: parent } : {}),
} });

test('segredos exigem strings não vazias e igualdade exata de bytes', () => {
  assert.equal(sameSecret('segredo-ç', 'segredo-ç'), true);
  for (const [actual, expected] of [['', ''], [undefined, 'x'], ['x', null], [1, '1'], ['abc', 'abd'], ['abc ', 'abc'], ['á', 'a']]) {
    assert.equal(sameSecret(actual, expected), false);
  }
});

test('assinatura autentica o corpo bruto, incluindo espaços, UTF-8 e quebras de linha', () => {
  const secret = 'synthetic-app-secret';
  const raw = Buffer.from('{ "text": "Olá 🌿" }\r\n', 'utf8');
  const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  assert.equal(verifySignature(raw, signature, secret), true);
  assert.equal(verifySignature(Buffer.from(JSON.stringify(JSON.parse(raw))), signature, secret), false);
  assert.equal(verifySignature(Buffer.concat([raw, Buffer.from(' ')]), signature, secret), false);
  assert.equal(verifySignature(raw, signature, 'wrong-secret'), false);
  for (const invalid of ['', signature.slice(0, -1), signature.toUpperCase(), `sha1=${'0'.repeat(64)}`, null]) {
    assert.equal(verifySignature(raw, invalid, secret), false);
  }
  assert.equal(verifySignature(raw.toString(), signature, secret), false);
  assert.equal(verifySignature(raw, signature, ''), false);
});

test('lote Instagram preserva mensagens, IDs opacos, comentários e contexto de anúncio', () => {
  const raw = instagram([
    message(), message('mid:02', { referral: { ad_id: 'ad:0001' } }),
  ], [igComment(), igComment('comment:02', 'thread:01')]);
  const { events, foreignEntries } = normalizeEnvelope(raw, assets);
  assert.equal(foreignEntries, 0);
  assert.equal(events.length, 4);
  assert.deepEqual(events.map(e => e.status), Array(4).fill('captured'));
  assert.equal(events[0].participantId, '00012345678901234567890');
  assert.equal(events[0].providerEventId, 'mid:opaco/001');
  assert.equal(events[0].channel, 'instagram');
  assert.equal(events[0].surface, 'dm');
  assert.equal(events[1].adId, 'ad:0001');
  assert.equal(events[2].postId, 'post:01');
  assert.equal(events[3].parentCommentId, 'thread:01');
  assert.equal(events[0].occurredAt, new Date(1792200000000).toISOString());
  assert.equal('phone' in events[0], false);
  assert.equal(JSON.stringify(raw).includes('@s.whatsapp.net'), false);
});

test('lote Messenger processa todas as entradas e comentários de feed', () => {
  const raw = { object: 'page', entry: [
    { id: assets.pageId, messaging: [message('fb-mid', { recipient: { id: assets.pageId } })] },
    { id: assets.pageId, changes: [{ field: 'feed', value: { item: 'comment', comment_id: 'fb-comment', from: { id: 'fb-user' }, message: 'Está disponível?', post_id: 'fb-post', verb: 'add' } }] },
  ] };
  const { events } = normalizeEnvelope(raw, assets);
  assert.deepEqual(events.map(e => [e.channel, e.surface, e.status]), [
    ['messenger', 'dm', 'captured'], ['messenger', 'comment', 'captured'],
  ]);
  assert.equal(events[1].text, 'Está disponível?');
  assert.equal(events[1].postId, 'fb-post');
});

test('identidade de conversa separa canal, conta, participante e thread sem colisões de separadores', () => {
  const keys = [
    conversationKey('instagram', 'conta', 'cliente', 'dm'),
    conversationKey('messenger', 'conta', 'cliente', 'dm'),
    conversationKey('instagram', 'outra', 'cliente', 'dm'),
    conversationKey('instagram', 'conta', 'outro', 'dm'),
    conversationKey('instagram', 'conta', 'cliente', 'comment', 'thread:1'),
    conversationKey('instagram', 'conta', 'cliente', 'comment', 'thread:2'),
    conversationKey('instagram', 'a:b', 'c', 'dm'),
    conversationKey('instagram', 'a', 'b:c', 'dm'),
  ];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(conversationKey('instagram', 'a', 'b', 'comment'), null);
  assert.equal(conversationKey('whatsapp', 'a', 'b', 'dm'), null);
});

test('reentrega mantém eventKey; evento igual em outra conta/canal permanece distinto', () => {
  const raw = instagram([message()]);
  const first = normalizeEnvelope(raw, assets).events[0];
  assert.equal(normalizeEnvelope(JSON.parse(JSON.stringify(raw)), assets).events[0].eventKey, first.eventKey);
  const otherAccount = { ...assets, instagramAccountId: 'outra-conta' };
  const other = normalizeEnvelope(envelope('instagram', { id: otherAccount.instagramAccountId, messaging: [message('mid:opaco/001', { recipient: { id: otherAccount.instagramAccountId } })] }), otherAccount).events[0];
  const facebook = normalizeEnvelope(envelope('page', { id: assets.pageId, messaging: [message('mid:opaco/001', { recipient: { id: assets.pageId } })] }), assets).events[0];
  assert.equal(new Set([first.eventKey, other.eventKey, facebook.eventKey]).size, 3);
  assert.ok([first, other, facebook].every(e => e.status === 'captured'));
  const a = normalizeEnvelope(instagram([], [igComment('same-comment', 'thread:A')]), assets).events[0];
  const b = normalizeEnvelope(instagram([], [igComment('same-comment', 'thread:B')]), assets).events[0];
  assert.notEqual(a.eventKey, b.eventKey);
  assert.notEqual(a.conversationKey, b.conversationKey);
  const reordered = { field: 'comments', value: { media: { id: 'post:01' }, text: 'Qual o valor?', from: { id: 'cliente:opaco/01' }, id: 'comment:01' } };
  assert.equal(normalizeEnvelope(instagram([], [igComment()]), assets).events[0].eventKey,
    normalizeEnvelope(instagram([], [reordered]), assets).events[0].eventKey);
});

test('ecos, leituras, entregas e alterações de comentário não entram para resposta', () => {
  const echo = message('echo', { sender: { id: assets.instagramAccountId }, recipient: { id: 'cliente' } });
  const flagged = message('flagged', { sender: { id: assets.instagramAccountId }, recipient: { id: 'cliente' }, message: { mid: 'flagged', is_echo: true } });
  const ownComment = igComment('own'); ownComment.value.from.id = assets.instagramAccountId;
  const edited = igComment('edited'); edited.value.verb = 'edit';
  const { events } = normalizeEnvelope(instagram([
    echo, flagged, { sender: { id: 'cliente' }, read: { watermark: 10 } },
    { sender: { id: 'cliente' }, delivery: { mids: ['mid'] } },
  ], [ownComment, edited]), assets);
  assert.equal(events.length, 6);
  assert.ok(events.every(e => e.status === 'ignored'));
  assert.equal(events[0].participantId, 'cliente');
  assert.deepEqual(events.slice(0, 4).map(e => e.eventType), ['message_echo', 'message_echo', 'read', 'delivery']);
});

test('ativos estrangeiros e ativos não configurados não produzem eventos', () => {
  const raw = instagram([message()]);
  raw.entry.push({ id: 'foreign', messaging: [message('foreign-message')] });
  const result = normalizeEnvelope(raw, assets);
  assert.equal(result.events.length, 1);
  assert.equal(result.foreignEntries, 1);
  assert.deepEqual(normalizeEnvelope(raw, {}), { events: [], foreignEntries: 2 });
  const wrongRecipient = normalizeEnvelope(instagram([message('wrong-recipient', { recipient: { id: 'foreign' } })]), assets).events[0];
  assert.equal(wrongRecipient.status, 'unsupported');
});

test('eventos desconhecidos e mensagens sem identidade não são capturados', () => {
  const noSender = message('missing-sender', { sender: {} });
  const noMid = message('unused', { message: { text: 'Sem id' } });
  const { events } = normalizeEnvelope(instagram([noSender, noMid, { sender: { id: 'cliente' }, postback: { payload: 'x' } }], [{ field: 'unknown', value: { id: 'x' } }]), assets);
  assert.equal(events.length, 4);
  assert.ok(events.every(e => e.status === 'unsupported'));
  for (const raw of [null, {}, { object: 'user', entry: [] }, { object: 'page', entry: {} }]) {
    assert.throws(() => normalizeEnvelope(raw, assets), e => e.statusCode === 400);
  }
});

test('limites rejeitam IDs numéricos/inválidos e lotes acima do máximo', () => {
  for (const invalid of [123, '', 'with space', 'a\nb', 'a'.repeat(256)]) {
    assert.equal(conversationKey('instagram', 'conta', invalid, 'dm'), null);
    const event = normalizeEnvelope(instagram([message('id', { sender: { id: invalid } })]), assets).events[0];
    assert.equal(event.status, 'unsupported');
  }
  assert.ok(conversationKey('instagram', 'conta', 'a'.repeat(255), 'dm'));
  const messages = Array.from({ length: MAX_EVENTS }, (_, i) => message(`mid-${i}`));
  assert.equal(normalizeEnvelope(instagram(messages), assets).events.length, MAX_EVENTS);
  assert.throws(() => normalizeEnvelope(instagram([...messages, message('overflow')]), assets), e => e.statusCode === 413);
});

test('anexos preservam somente URLs HTTPS sem credenciais', () => {
  const attachments = ['https://cdn.example/image.jpg', 'http://cdn.example/file', 'https://user:pass@cdn.example/file', 'javascript:alert(1)', 'not-url'].map(url => ({ type: 'image', payload: { url, attachment_id: 'opaque-media' } }));
  const event = normalizeEnvelope(instagram([message('media', { message: { mid: 'media', attachments } })]), assets).events[0];
  assert.equal(event.status, 'captured');
  assert.equal(event.attachments[0].url, attachments[0].payload.url);
  assert.ok(event.attachments.slice(1).every(a => a.url === null));
  assert.ok(event.attachments.every(a => a.providerId === 'opaque-media'));
});
