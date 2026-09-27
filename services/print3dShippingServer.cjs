'use strict';
const { validateQuoteItems } = require('./print3dStorefrontQuote.cjs');
const { signShippingQuote } = require('./print3dShippingQuoteToken.cjs');

function configuration(env, settings = {}) {
  const number = key => env[key] == null || String(env[key]).trim() === '' ? NaN : Number(env[key]);
  const config = {
    origin: String(settings.origin_cep || '').replace(/\D/g, ''),
    tare: number('MDV_PRINT3D_SHIPPING_PACKAGE_TARE_G'),
    padding: number('MDV_PRINT3D_SHIPPING_PACKAGE_PADDING_CM'),
    handling: number('MDV_PRINT3D_SHIPPING_HANDLING_DAYS'),
    providers: [],
  };
  if (env.MDV_PRINT3D_SHIPPING_ENABLED !== '1') throw new Error('Cálculo de frete ainda não ativado.');
  if (!/^\d{8}$/.test(config.origin) || !Number.isFinite(config.tare) || config.tare < 0
    || !Number.isFinite(config.padding) || config.padding < 0 || !Number.isInteger(config.handling) || config.handling < 0) {
    throw new Error('Frete aguardando configuração de origem, embalagem e preparação.');
  }
  if (Number(settings.melhor_envio_enabled) === 1 && settings.melhor_envio_token) config.providers.push({
    provider: 'melhor-envio', token: settings.melhor_envio_token,
    sandbox: Number(settings.melhor_envio_sandbox) === 1,
    allowedServices: String(settings.melhor_envio_allowed_services || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean),
  });
  if (Number(settings.frenet_enabled) === 1 && settings.frenet_token) config.providers.push({ provider: 'frenet', token: settings.frenet_token });
  if (!config.providers.length) throw new Error('Transportadoras ainda não configuradas.');
  return config;
}

// Mesmo empilhamento do FreightCalculator: soma alturas e usa maior largura/comprimento.
// Peso líquido do cadastro recebe a tara da caixa; medidas recebem folga total por eixo.
function packageFor(rows, items, config) {
  const byId = new Map(rows.map(row => [String(row.id), row]));
  const box = { weight_g: config.tare, height_cm: 0, width_cm: 0, length_cm: 0 };
  for (const item of items) {
    const row = byId.get(item.product_id);
    let dimensions = row?.dimensions;
    if (typeof dimensions === 'string') { try { dimensions = JSON.parse(dimensions); } catch { dimensions = null; } }
    const values = [Number(row?.weight_kg), Number(dimensions?.height_cm), Number(dimensions?.width_cm), Number(dimensions?.depth_cm)];
    if (!values.every(n => Number.isFinite(n) && n > 0)) throw new Error('Há produto sem peso ou medidas. Entre em contato para cotar o frete.');
    box.weight_g += values[0] * 1000 * item.quantity;
    box.height_cm += values[1] * item.quantity;
    box.width_cm = Math.max(box.width_cm, values[2]);
    box.length_cm = Math.max(box.length_cm, values[3]);
  }
  for (const key of ['height_cm', 'width_cm', 'length_cm']) box[key] = Math.ceil(box[key] + config.padding);
  box.weight_g = Math.ceil(box.weight_g);
  if (!Object.values(box).every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Embalagem inválida para cotação.');
  return box;
}

function normalizeOptions(provider, response) {
  if (response?.status !== 200) return [];
  const rows = provider === 'frenet' ? response.body?.ShippingSevicesArray : response.body;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    if (!row || row.error || row.Error || (provider === 'frenet' ? row.ServiceCode == null : row.id == null)) return [];
    const rawPrice = provider === 'frenet' ? row.ShippingPrice : row.custom_price ?? row.price;
    const rawDays = provider === 'frenet' ? row.DeliveryTime : row.custom_delivery_time ?? row.delivery_time;
    if (rawPrice == null || rawPrice === '' || rawDays == null || rawDays === '') return [];
    const price = Number(rawPrice), days = Number(rawDays), cents = Math.round(price * 100);
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(cents) || !Number.isInteger(days) || days < 0) return [];
    return [{
      id: provider + ':' + String(provider === 'frenet' ? row.ServiceCode : row.id),
      carrier: String(provider === 'frenet' ? row.Carrier || 'Transportadora' : row.company?.name || 'Transportadora').slice(0, 100),
      name: String(provider === 'frenet' ? row.ServiceDescription || 'Entrega' : row.name || 'Entrega').slice(0, 100),
      price_cents: cents, transport_business_days: days,
    }];
  });
}

function registerPrint3dShipping(fastify, { pool, loadQuote, calculateShipping, env = process.env }) {
  const attempts = new Map();
  fastify.post('/storefronts/loja_3d/shipping/quote', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip || 'unknown', previous = attempts.get(key) || { count: 0, until: now + 60000 };
    if (previous.count >= 10 || !attempts.has(key) && attempts.size >= 10000) {
      return reply.code(429).send({ error: 'Aguarde um minuto para calcular novamente.' });
    }
    previous.count++; attempts.set(key, previous);
    let requested, destination, config;
    try {
      requested = validateQuoteItems(req.body?.items);
      destination = String(req.body?.cep || '').replace(/\D/g, '');
      if (!/^\d{8}$/.test(destination) || /^0+$/.test(destination)) throw new Error('Informe um CEP válido com 8 dígitos.');
    } catch (error) { return reply.code(400).send({ error: error.message }); }
    try {
      if (env.MDV_PRINT3D_SHIPPING_ENABLED !== '1') return reply.code(503).send({ error: 'Cálculo de frete ainda não ativado.' });
      let settings;
      try {
        [settings] = await pool.query(`SELECT origin_cep, melhor_envio_enabled, melhor_envio_token,
          melhor_envio_sandbox, melhor_envio_allowed_services, frenet_enabled, frenet_token
          FROM shipping_settings LIMIT 1`);
      } catch { return reply.code(503).send({ error: 'Configuração de frete temporariamente indisponível.' }); }
      config = configuration(env, settings[0]);
    }
    catch (error) { return reply.code(503).send({ error: error.message }); }
    try {
      const quote = await loadQuote(pool, requested);
      if (!quote.paymentSchedule) return reply.code(409).send({ error: 'Revise a disponibilidade dos produtos antes de calcular o frete.' });
      let box;
      try { box = packageFor(quote.rows, requested, config); }
      catch (error) { return reply.code(422).send({ error: error.message }); }
      const settled = await Promise.allSettled(config.providers.map(async provider => {
        const result = await calculateShipping({ provider: provider.provider, action: 'calculate' }, {
          ...box, ...provider, from_cep: config.origin, to_cep: destination,
          order_value: quote.paymentSchedule.subtotal, signal: AbortSignal.timeout(15000),
        });
        const options = normalizeOptions(provider.provider, result);
        return provider.allowedServices?.length
          ? options.filter(option => provider.allowedServices.some(name => option.name.toLowerCase().includes(name) || option.carrier.toLowerCase().includes(name)))
          : options;
      }));
      const options = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []).sort((a,b) => a.price_cents - b.price_cents);
      if (!options.length) return reply.code(503).send({ error: 'Não foi possível obter opções de entrega para este CEP. Tente novamente ou entre em contato.' });
      const productionDays = Math.max(0, ...quote.items.map(item => Number(item.production_days) || 0));
      const secret = env.VPS_AUTH_SECRET || env.AUTH_SECRET || env.JWT_SECRET || env.SYNC_SECRET;
      const quoteToken = typeof secret === 'string' && secret.length >= 32 ? signShippingQuote({
        items: requested, quote, cep: destination, options, origin_cep: config.origin, parcel: box,
        production_days: productionDays, handling_business_days: config.handling,
      }, secret) : null;
      return {
        quote_token: quoteToken,
        storefront: 'loja_3d', cep: destination, subtotal_cents: quote.paymentSchedule.subtotal,
        production_days: Math.max(0, ...quote.items.map(item => Number(item.production_days) || 0)),
        handling_business_days: config.handling, options, can_checkout: false,
        notice: 'Estimativa para envio conjunto. O prazo de transporte começa após a produção e preparação. No checkout, escolha a entrada a partir de 50% e quando pagar o frete. Valores sujeitos à conferência da embalagem.',
      };
    } catch {
      return reply.code(503).send({ error: 'Frete temporariamente indisponível. Tente novamente.' });
    }
  });
}
module.exports = { configuration, packageFor, normalizeOptions, registerPrint3dShipping };
