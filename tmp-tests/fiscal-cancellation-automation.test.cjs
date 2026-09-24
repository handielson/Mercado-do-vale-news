const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFiscalCancellationAutomation } = require('../services/fiscalCancellationAutomation.cjs');

const cnpj = '11222333000181';
const document = { id:'document-1', profile_id:'profile-1', model:'55', channel:'shopee',
  external_sale_id:'ORDER-1', access_key:`262609${cnpj}550010000006991123456780`, status:'authorized' };
const profile = { id:'profile-1', cnpj, uf:'PE' };
const authorization = { situation:'authorized', cStat:'100', authorizationProtocol:'126260000000001', authorizedAt:'2026-09-24T10:00:00-03:00' };

function fakePool() {
  const data = { state:null, documentStatus:'authorized', events:0, queries:[] };
  return { data, query:async (sql, params=[]) => {
    data.queries.push(sql);
    if (sql.includes('FROM company_fiscal_documents d JOIN company_fiscal_profiles p')) {
      return [[data.state === 'pending' && sql.includes("m.state IN ('pending','open_alert'")
        ? { ...profile, ...document, profile_id:profile.id } : undefined].filter(Boolean)];
    }
    if (sql.startsWith('SELECT state FROM company_fiscal_cancellation_monitor')) return [[data.state ? { state:data.state } : undefined].filter(Boolean)];
    if (sql.startsWith('INSERT IGNORE INTO company_fiscal_cancellation_monitor')) { data.state ||= 'pending'; return [{ affectedRows:1 }]; }
    if (sql.includes("SET state='open_alert'")) { if (['pending','open_alert'].includes(data.state)) data.state='open_alert'; return [{ affectedRows:1 }]; }
    if (sql.includes("SET state='pending'")) { if (['pending','open_alert'].includes(data.state)) data.state='pending'; return [{ affectedRows:1 }]; }
    if (sql.includes("SET state='blocked'")) { data.state='blocked'; return [{ affectedRows:1 }]; }
    if (sql.includes("SET state='sending'")) { const claim = ['pending','open_alert'].includes(data.state); if (claim) data.state='sending'; return [{ affectedRows:claim?1:0 }]; }
    if (sql.includes("SET state='uncertain'")) { data.state='uncertain'; return [{ affectedRows:1 }]; }
    if (sql.includes("SET state='confirmed'")) { data.state='confirmed'; return [{ affectedRows:1 }]; }
    if (sql.startsWith('UPDATE company_fiscal_cancellation_monitor SET state=?')) { data.state=params[0]; return [{ affectedRows:1 }]; }
    if (sql.startsWith('UPDATE company_fiscal_documents SET status=')) { const changed=data.documentStatus==='authorized'; data.documentStatus='cancelled'; return [{ affectedRows:changed?1:0 }]; }
    if (sql.startsWith('INSERT INTO company_fiscal_events')) { data.events++; return [{ affectedRows:1 }]; }
    if (sql.startsWith('SELECT 1 FROM tiktok_shop_fulfillment_jobs')) return [[]];
    throw new Error(`unexpected SQL: ${sql}`);
  } };
}

test('pedido aberto fica em alerta; CANCELLED dispara um evento e reconcilia sem duplicar', async () => {
  const pool = fakePool();
  let status='READY_TO_SHIP';
  let sefaz=authorization;
  let sends=0;
  const monitor = createFiscalCancellationAutomation({ pool, now:() => new Date('2026-09-24T11:00:00-03:00'),
    getLiveMarketplaceOrder:async () => ({ order_sn:'ORDER-1', order_status:status }),
    consult:async () => sefaz,
    transmit:async () => { sends++; return { accepted:true, protocol:'126260000000002', reason:'Evento registrado', signedXml:'<evento/>', responseXml:'<retEvento/>' }; },
  });
  assert.equal(await monitor.processDocument(document,profile),'open_alert');
  assert.equal(sends,0);
  status='CANCELLED';
  assert.equal(await monitor.processDocument(document,profile),'accepted_pending_confirmation');
  assert.equal(sends,1);
  assert.equal(await monitor.processDocument(document,profile),'accepted_pending_confirmation');
  assert.equal(sends,1);
  sefaz={ situation:'cancelled', cStat:'101' };
  assert.equal(await monitor.processDocument(document,profile),'confirmed');
  assert.equal(pool.data.documentStatus,'cancelled');
  assert.equal(pool.data.events,1);
  assert.equal(await monitor.processDocument(document,profile),'confirmed');
  assert.equal(sends,1);
});

test('falha de rede torna tentativa incerta e não reenvia o evento', async () => {
  const pool=fakePool();
  let sends=0;
  const monitor=createFiscalCancellationAutomation({ pool, now:() => new Date('2026-09-24T11:00:00-03:00'),
    getLiveMarketplaceOrder:async () => ({ order_sn:'ORDER-1', order_status:'CANCELLED' }),
    consult:async () => authorization,
    transmit:async () => { sends++; throw new Error('timeout'); },
    logger:{ error(){} },
  });
  assert.equal(await monitor.processDocument(document,profile),'uncertain');
  assert.equal(await monitor.processDocument(document,profile),'uncertain');
  assert.equal(sends,1);
});

test('TikTok aberto alerta; CANCELLED sem envio local usa o mesmo fluxo fiscal', async () => {
  const pool=fakePool();
  const tiktokDocument={ ...document, channel:'tiktok', external_sale_id:'12345678' };
  let status='AWAITING_SHIPMENT';
  let sends=0;
  const monitor=createFiscalCancellationAutomation({ pool, now:() => new Date('2026-09-24T11:00:00-03:00'),
    getLiveMarketplaceOrder:async () => ({ id:'12345678', status }), consult:async () => authorization,
    transmit:async () => { sends++; return { accepted:true, protocol:'126260000000002' }; },
  });
  assert.equal(await monitor.processDocument(tiktokDocument,profile),'open_alert');
  assert.equal(sends,0);
  status='CANCELLED';
  assert.equal(await monitor.processDocument(tiktokDocument,profile),'accepted_pending_confirmation');
  assert.equal(sends,1);
  assert(pool.data.queries.some(sql => sql.startsWith('SELECT 1 FROM tiktok_shop_fulfillment_jobs')));
});

test('status intermediário não bloqueia uma NF-e antes de CANCELLED', async () => {
  const pool=fakePool();
  let status='UNKNOWN_WAITING';
  let sends=0;
  const monitor=createFiscalCancellationAutomation({ pool, now:() => new Date('2026-09-24T11:00:00-03:00'),
    getLiveMarketplaceOrder:async () => ({ order_sn:'ORDER-1', order_status:status }),
    consult:async () => authorization,
    transmit:async () => { sends++; return { accepted:true, protocol:'126260000000002' }; },
  });
  assert.equal(await monitor.processDocument(document,profile),'pending');
  assert.equal(pool.data.state,'pending');
  status='CANCELLED';
  assert.equal(await monitor.processDocument(document,profile),'accepted_pending_confirmation');
  assert.equal(sends,1);
});

test('varredura reencontra documento pendente quando o marketplace muda para CANCELLED', async () => {
  const pool=fakePool();
  pool.data.state='pending';
  let sends=0;
  const monitor=createFiscalCancellationAutomation({ pool, now:() => new Date('2026-09-24T11:00:00-03:00'),
    getLiveMarketplaceOrder:async () => ({ order_sn:'ORDER-1', order_status:'CANCELLED' }),
    consult:async () => authorization,
    transmit:async () => { sends++; return { accepted:true, protocol:'126260000000002' }; },
  });
  const result=await monitor.tick();
  assert.deepEqual(result,[{ documentId:'document-1', state:'accepted_pending_confirmation' }]);
  assert.equal(sends,1);
});
