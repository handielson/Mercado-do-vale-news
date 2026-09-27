const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseUrl = process.env.PRINT3D_TEST_BASE_URL || 'http://127.0.0.1:3000';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const checkoutRequests = []; let confirmed = 0; let paymentRequests = 0; let demoCalls = 0;
    let refunded = false;
    const order = () => ({ id: '00000000-0000-4000-8000-000000000001', order_number: '3D-LOCAL-1', status: 'awaiting_payment', payment_status: refunded ? 'refunded' : 'pending', created_at: new Date().toISOString(), subtotal_cents: 100000, shipping_cents: 2000, total_cents: 102000, confirmed_cents: confirmed, outstanding_cents: 102000 - confirmed, items: [{ product_id: 'product-local', product_name: 'Peça de teste', product_sku: 'LOCAL', quantity: 100, unit_price_cents: 1000, subtotal_cents: 100000, ready_quantity: 0, preorder_quantity: 100, production_days: 5 }], payment_schedule: { initial_cents: 50000, balance_cents: 52000 }, shipping_option: { carrier: 'Teste', name: 'PAC' } });
    const coverage = () => ({ confirmed_cents: confirmed, outstanding_cents: 102000 - confirmed, initial_payment_covered: confirmed >= 50000, fully_paid: false });
    const charge = () => ({ id: 'charge-local', stage: 'initial', amount_cents: 50000, status: confirmed ? 'approved' : 'pending', pix_code: confirmed ? null : 'PIX-SIMULADO-SEM-VALOR', pix_qr_base64: null, expires_at: null });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url()); const decoded = decodeURIComponent(url.href); const method = route.request().method();
      if (!url.pathname.includes('vps-proxy') && !url.pathname.startsWith('/api/')) return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
      const respond = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (route.request().frame().url().includes('demo=1') && /print3d|storefronts/.test(decoded)) demoCalls++;
      if (decoded.includes('/print3d/auth/me')) return respond({ customer: { id: 'customer-local', name: 'Cliente local', email: null } });
      if (decoded.includes('/print3d/checkout')) {
        if (method === 'GET') return respond({ enabled: true, payment_mode: 'pix' });
        checkoutRequests.push(route.request().postDataJSON());
        return checkoutRequests.length === 1 ? respond({ error: 'Falha simulada; tente novamente.' }, 500) : respond({ order: order(), replayed: true });
      }
      if (decoded.includes('/storefronts/loja_3d/shipping/quote')) return respond({ quote_token: 'local-token', subtotal_cents: 100000, production_days: 5, handling_business_days: 1, options: [{ id: 'pac', carrier: 'Teste', name: 'PAC', price_cents: 2000, transport_business_days: 7 }] });
      if (decoded.includes('/storefronts/loja_3d/quote')) return respond({ items: [{ product_id: 'product-local', name: 'Peça de teste', quantity: 100, ready_quantity: 0, preorder_quantity: 100, subtotal: 100000, status: 'available' }], subtotal: 100000, payment_schedule: { preorder_amount: 100000, ready_amount: 0, due_on_confirmation: 50000, due_before_shipping: 50000 } });
      if (decoded.includes('/payment/refresh')) { confirmed = 50000; return respond({ charge: charge(), coverage: coverage() }); }
      if (decoded.includes('/payment')) { if (method === 'POST') { paymentRequests++; return respond({ charge: charge(), coverage: coverage() }); } return respond({ charges: paymentRequests ? [charge()] : [], coverage: coverage() }); }
      if (decoded.includes('/print3d/orders')) return respond({ orders: [order()] });
      return respond({ maintenance_mode: false });
    });
    await context.addInitScript(() => {
      sessionStorage.setItem('print3d_customer_session_v1', 'LOCAL-FAKE-SESSION');
      if (!sessionStorage.getItem('initialized')) { sessionStorage.setItem('initialized', '1'); sessionStorage.setItem('print3d_checkout_cart_v1', JSON.stringify([{ product_id: 'product-local', quantity: 100 }])); }
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/loja-3d/checkout`);
    for (const [label, value] of [['CEP', '56300000'], ['Rua / avenida', 'Rua Exemplo'], ['Número ou S/N', '10'], ['Bairro', 'Centro'], ['Cidade', 'Petrolina'], ['Estado (UF)', 'PE']]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Conferir produtos e entrega' }).click();
    await page.getByRole('radio').first().check();
    await page.getByTestId('balance-payment').filter({ hasText: 'R$ 520,00' }).waitFor();
    const percentage = page.getByLabel('Percentual de entrada nos produtos', { exact: true });
    for (const [percent, later, now, split] of [['50', 50000, 52000, 51000], ['70', 70000, 72000, 71400], ['100', 100000, 102000, 102000]]) {
      await percentage.fill(percent);
      for (const [label, expected] of [['Frete no saldo', later], ['Frete inteiro agora', now], ['Dividir o frete', split]]) {
        await page.getByRole('radio', { name: new RegExp(label) }).check();
        const price = Number(expected) / 100;
        assert.equal((await page.getByTestId('initial-payment').innerText()).replace(/\s/g, ''), price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ''));
      }
    }
    await percentage.fill('49');
    assert.equal(await page.getByRole('button', { name: 'Criar pedido e continuar para pagamento' }).isDisabled(), true);
    await page.getByText('Informe de 50% a 100%, com até duas casas decimais.').waitFor();
    await percentage.fill('50'); await page.getByRole('radio', { name: /Frete no saldo/ }).check();
    await page.screenshot({ path: 'C:/Users/Nitro/.codex/visualizations/2026/09/25/01a0d7e9-06df-7743-aa77-6b4637f66647/checkout-3d-mobile.png', fullPage: true });
    assert.equal(await page.getByRole('button', { name: 'Comparar', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Criar pedido e continuar para pagamento' }).click();
    await page.getByRole('alert').filter({ hasText: 'Falha simulada' }).waitFor();
    await page.getByRole('button', { name: 'Criar pedido e continuar para pagamento' }).click();
    await page.getByRole('heading', { name: 'Meus pedidos' }).waitFor();
    assert.equal(checkoutRequests.length, 2); assert.equal(checkoutRequests[0].idempotency_key, checkoutRequests[1].idempotency_key);
    assert.deepEqual(checkoutRequests[0].payment_terms, { initial_payment_bps: 5000, shipping_payment_mode: 'later' });
    assert.equal(checkoutRequests[0].shipping_option_id, 'pac'); assert.equal(Object.hasOwn(checkoutRequests[0], 'total_cents'), false);
    await page.getByRole('button', { name: 'Gerar PIX' }).click();
    await page.getByLabel('PIX copia e cola').waitFor();
    await page.getByRole('button', { name: 'Já paguei: verificar confirmação' }).click();
    await page.getByText('Entrada confirmada', { exact: true }).first().waitFor();
    assert.equal(paymentRequests, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: 'C:/Users/Nitro/.codex/visualizations/2026/09/25/01a0d7e9-06df-7743-aa77-6b4637f66647/pedidos-3d-mobile.png', fullPage: true });
    refunded = true;
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await page.getByText('O pagamento está em revisão após estorno.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Gerar PIX' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Já paguei: verificar confirmação' }).count(), 0);
    await page.goto(`${baseUrl}/loja-3d/pedidos?demo=1`);
    await page.getByText('20 de 100 unidades aprovadas · 80 pendentes').waitFor();
    assert.equal(demoCalls, 0);
    console.log('PASS: mobile checkout server quote, freight in balance, retry same key, isolated PIX, provider-confirmed entry, demo zero store API.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
