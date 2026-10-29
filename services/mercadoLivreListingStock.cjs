const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const userProductIdPattern = /^ML[A-Z]{2}\d{1,30}$/;

function quantity(value) {
  if (!(typeof value === 'number' || (typeof value === 'string' && value.trim()))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function responseHeader(response, name) {
  if (typeof response.headers?.get === 'function') return response.headers.get(name);
  const entry = Object.entries(response.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] == null ? null : String(entry[1]);
}

function createListingStockHandlers({ pool, settings, request }) {
  async function read(req) {
    const itemId = String(req.params?.itemId || '').toUpperCase();
    const parentId = String(req.query?.parentId || '');
    if (!/^MLB\d{1,30}$/.test(itemId) || !/^[0-9a-f-]{36}$/i.test(parentId))
      throw fail('Anúncio ou família inválidos.', 400);

    const seller = String((await settings()).user_id || '');
    if (!/^\d+$/.test(seller)) throw fail('Conecte a conta do Mercado Livre.');
    const [linked] = await pool.query(`SELECT p.id,p.sku,COALESCE(ml.variation_id,'') variation_id FROM mercado_livre_products ml
      JOIN products p ON p.id COLLATE utf8mb4_unicode_ci=ml.product_id COLLATE utf8mb4_unicode_ci
      WHERE ml.item_id=? AND (p.id=? OR p.parent_id=?) ORDER BY ml.variation_id`, [itemId, parentId, parentId]);
    if (!linked.length) throw fail('Este anúncio não está vinculado à família selecionada.', 404);

    const itemResponse = await request(`/items/${itemId}?include_attributes=all`);
    const item = await itemResponse.json();
    if (String(item.seller_id) !== seller || String(item.id) !== itemId)
      throw fail('Anúncio não pertence à conta conectada.');
    if (!Array.isArray(item.tags) || item.tags.length > 100 ||
        item.tags.some(tag => typeof tag !== 'string' || tag.length > 120))
      throw fail('Não foi possível classificar com segurança o modelo de estoque do anúncio.');
    const variations = item.variations || [];
    if (!Array.isArray(variations) || variations.length > 100
        || variations.some(row => !/^\d{1,30}$/.test(String(row.id || ''))))
      throw fail('Não foi possível validar as variações do anúncio.');
    const linksByVariation = new Map(linked.map(row => [String(row.variation_id || ''), String(row.sku || '')]));
    const userResponse = await request(`/users/${seller}`);
    const user = await userResponse.json();
    if (String(user.id) !== seller || !Array.isArray(user.tags) || user.tags.length > 100 ||
        user.tags.some(tag => typeof tag !== 'string' || tag.length > 120))
      throw fail('Não foi possível confirmar o modelo de estoque da conta.');

    if (user.tags.includes('warehouse_management')) {
      const userProductId = String(item.user_product_id || '').toUpperCase();
      if (!userProductIdPattern.test(userProductId))
        throw fail('Anúncio multiorigem sem user_product_id válido; saldo remoto não identificado.');
      const stockResponse = await request(`/user-products/${userProductId}/stock`);
      const stock = await stockResponse.json();
      if (String(stock.id || '').toUpperCase() !== userProductId || String(stock.user_id) !== seller
          || !Array.isArray(stock.locations) || stock.locations.length > 100)
        throw fail('Resposta de estoque multiorigem incompatível com o anúncio.');
      const locations = stock.locations.map(location => {
        const qty = quantity(location.quantity);
        const type = String(location.type || '');
        if (qty === null || !['seller_warehouse', 'meli_facility'].includes(type))
          throw fail('O Mercado Livre retornou uma localização ou quantidade inválida.');
        return { type, storeId: String(location.store_id || ''), networkNodeId: String(location.network_node_id || ''), quantity: qty };
      });
      const version = responseHeader(stockResponse, 'x-version');
      return { itemId, parentId, sellerId: seller, status: String(item.status || ''),
        subStatus: Array.isArray(item.sub_status) ? item.sub_status.map(String) : [],
        mode: 'warehouse_management', userProductId,
        stockVersion: version && /^\d{1,30}$/.test(version) ? version : null,
        quantityByVariation: false,
        reason: variations.length ? 'O endpoint retorna saldo por localização do User Product, não por variação; não atribua esses valores a um SKU.' : '',
        locations, variations: variations.map(row => ({ id: String(row.id), sku: linksByVariation.get(String(row.id)) || '' })) };
    }

    const quantities = variations.length
      ? variations.map(row => ({ variationId: String(row.id), sku: linksByVariation.get(String(row.id)) || '', quantity: quantity(row.available_quantity) }))
      : [{ variationId: '', sku: linksByVariation.get('') || '', quantity: quantity(item.available_quantity) }];
    if (quantities.some(row => row.quantity === null))
      throw fail('O Mercado Livre não informou quantidade válida para todos os itens/variações.');
    return { itemId, parentId, sellerId: seller, status: String(item.status || ''),
      subStatus: Array.isArray(item.sub_status) ? item.sub_status.map(String) : [],
      mode: 'item_available_quantity', userProductId: '',
      stockVersion: null, quantityByVariation: true, reason: '', locations: [], quantities };
  }

  async function update(req) {
    const input = req.body || {};
    const itemId = String(req.params?.itemId || '').toUpperCase();
    const parentId = String(req.query?.parentId || input.parentId || '');
    const variationId = String(input.variationId || '');
    const desired = input.quantity;
    const expected = input.expectedQuantity;
    if (input.confirm !== true) throw fail('Confirme explicitamente a atualização do saldo.', 400);
    if (!Number.isSafeInteger(desired) || desired < 0 || desired > 1_000_000_000
        || !Number.isSafeInteger(expected) || expected < 0 || expected > 1_000_000_000
        || !/^\d{0,30}$/.test(variationId))
      throw fail('Informe quantidades inteiras válidas e o ID exato da variação.', 400);

    const current = await read({ params: { itemId }, query: { parentId } });
    if (current.mode !== 'item_available_quantity' || current.userProductId)
      throw fail('Escrita bloqueada para User Products ou warehouse_management; é necessário mapear localizações e usar x-version.');
    if (!['active', 'paused'].includes(current.status)) throw fail('Somente anúncio ativo ou pausado pode receber saldo.');
    const isOutOfStockPaused = current.status === 'paused' && current.subStatus.includes('out_of_stock');
    if (current.status === 'paused' && !isOutOfStockPaused)
      throw fail('Anúncio pausado manualmente; reative-o no Mercado Livre antes de sincronizar saldo.');
    if (isOutOfStockPaused && desired > 0 && input.confirmReactivation !== true)
      throw fail('Confirme explicitamente que aumentar o saldo pode reativar o anúncio pausado por falta de estoque.');

    const itemResponse = await request(`/items/${itemId}?include_attributes=all`);
    const item = await itemResponse.json();
    const seller = String((await settings()).user_id || '');
    const sellerResponse = await request(`/users/${seller}`);
    const user = await sellerResponse.json();
    if (String(item.id) !== itemId || String(item.seller_id) !== seller ||
        String(user.id) !== seller || !Array.isArray(user.tags) ||
        user.tags.includes('warehouse_management') || item.user_product_id ||
        (Array.isArray(item.tags) && item.tags.some(tag => ['user_product_listing', 'user_product_seller'].includes(tag))))
      throw fail('O anúncio mudou de modelo/conta. A escrita tradicional foi bloqueada; consulte novamente.');
    if (item.status !== current.status ||
        JSON.stringify(Array.isArray(item.sub_status) ? item.sub_status : []) !== JSON.stringify(current.subStatus))
      throw fail('A situação do anúncio mudou durante a conferência. Consulte novamente.');

    const variations = item.variations || [];
    if (!Array.isArray(variations) || variations.length > 100 ||
        variations.some(row => !row || !/^\d{1,30}$/.test(String(row.id || '')) ||
          !Number.isSafeInteger(row.available_quantity) || row.available_quantity < 0) ||
        new Set(variations.map(row => String(row.id))).size !== variations.length)
      throw fail('A lista completa de variações/saldos não é válida; nenhuma escrita foi feita.');
    let oldQuantity;
    let body;
    if (variations.length) {
      if (!variationId) throw fail('Informe a variação exata; o anúncio tem múltiplas variações.', 400);
      const selected = variations.find(row => String(row.id) === variationId);
      if (!selected) throw fail('A variação vinculada não existe mais no anúncio.', 409);
      oldQuantity = selected.available_quantity;
      body = { variations: variations.map(row => ({ ...row,
        available_quantity: String(row.id) === variationId ? desired : row.available_quantity })) };
    } else {
      if (variationId) throw fail('O anúncio não possui essa variação.', 409);
      if (!Number.isSafeInteger(item.available_quantity) || item.available_quantity < 0)
        throw fail('O anúncio não informou quantidade atual válida.');
      oldQuantity = item.available_quantity;
      body = { available_quantity: desired };
    }
    if (oldQuantity !== expected) throw fail('O saldo remoto mudou desde a conferência. Consulte novamente.');
    if (desired === 0 && (item.condition === 'used' || item.listing_type_id === 'free'))
      throw fail('A API não permite zerar estoque para esta condição/tipo de anúncio.');
    if (desired === oldQuantity)
      return { ok: true, itemId, quantity: desired, alreadyCurrent: true,
        reactivated: false, affectedSkus: current.quantities.filter(row => !variationId || row.variationId === variationId).map(row => row.sku).filter(Boolean) };

    await request(`/items/${itemId}`, { method: 'PUT', body: JSON.stringify(body) });
    const verifyResponse = await request(`/items/${itemId}?include_attributes=all`);
    const verified = await verifyResponse.json();
    if (String(verified.id) !== itemId || String(verified.seller_id) !== seller)
      throw fail('A resposta de verificação não corresponde ao anúncio; consulte antes de repetir.');
    let actual;
    if (variations.length) {
      const after = Array.isArray(verified.variations) && verified.variations.find(row => String(row.id) === variationId);
      actual = after?.available_quantity;
    } else actual = verified.available_quantity;
    if (actual !== desired)
      throw fail('O Mercado Livre não confirmou o saldo solicitado. Consulte o anúncio antes de repetir.');
    return { ok: true, itemId, quantity: actual, alreadyCurrent: false,
      reactivated: isOutOfStockPaused && desired > 0,
      affectedSkus: current.quantities.filter(row => !variationId || row.variationId === variationId).map(row => row.sku).filter(Boolean) };
  }

  async function updateWarehouse(req) {
    const input = req.body || {};
    const itemId = String(req.params?.itemId || req.query?.itemId || input.itemId || '').toUpperCase();
    const parentId = String(req.query?.parentId || input.parentId || '');
    const userProductId = String(req.params?.userProductId || input.userProductId || '').toUpperCase();
    if (input.confirm !== true) throw fail('Confirme explicitamente a atualização dos depósitos seller_warehouse.', 400);
    if (!userProductIdPattern.test(userProductId) || !/^\d{1,30}$/.test(String(input.expectedVersion || '')))
      throw fail('Informe o User Product e a versão de estoque consultados.', 400);
    const current = await read({ params: { itemId }, query: { parentId } });
    if (current.mode !== 'warehouse_management' || current.userProductId !== userProductId)
      throw fail('O anúncio não corresponde ao User Product multiorigem informado.');
    if (current.variations.length)
      throw fail('O estoque por localização não pode ser atribuído a variações legadas.');
    if (!['active', 'paused'].includes(current.status))
      throw fail('Somente anúncio ativo ou pausado pode receber saldo.');
    const outOfStockPaused = current.status === 'paused' && current.subStatus.includes('out_of_stock');
    if (current.status === 'paused' && !outOfStockPaused)
      throw fail('Anúncio pausado manualmente; reative-o no Mercado Livre antes de sincronizar saldo.');
    if (String(current.stockVersion || '') !== String(input.expectedVersion))
      throw fail('A versão do estoque remoto mudou desde a conferência. Consulte novamente.');

    const currentSeller = current.locations.filter(row => row.type === 'seller_warehouse');
    const fullBefore = current.locations.filter(row => row.type === 'meli_facility');
    const requested = input.locations;
    const expected = input.expectedLocations;
    if (!Array.isArray(requested) || !Array.isArray(expected) ||
        !currentSeller.length || requested.length !== currentSeller.length || expected.length !== currentSeller.length)
      throw fail('A proposta precisa cobrir todas as localizações seller_warehouse atuais.');
    const keyOf = row => `${row.store_id ?? row.storeId}\u0000${row.network_node_id ?? row.networkNodeId}`;
    const currentByKey = new Map(currentSeller.map(row => [keyOf(row), row]));
    const expectedByKey = new Map();
    for (const row of expected) {
      if (!row || !/^\d{1,30}$/.test(String(row.store_id || '')) ||
          !String(row.network_node_id || '').trim() || String(row.network_node_id).length > 80 ||
          !Number.isSafeInteger(row.quantity) || row.quantity < 0)
        throw fail('O estoque esperado contém uma localização inválida.', 400);
      const key = keyOf(row);
      if (expectedByKey.has(key)) throw fail('O estoque esperado contém localizações duplicadas.', 400);
      expectedByKey.set(key, row);
    }
    const requestedByKey = new Map();
    for (const row of requested) {
      if (!row || !/^\d{1,30}$/.test(String(row.store_id || '')) ||
          !String(row.network_node_id || '').trim() || String(row.network_node_id).length > 80 ||
          !Number.isSafeInteger(row.quantity) || row.quantity < 0 || row.quantity > 1_000_000_000)
        throw fail('A nova quantidade contém uma localização ou saldo inválido.', 400);
      const key = keyOf(row);
      if (requestedByKey.has(key)) throw fail('A proposta contém localizações duplicadas.', 400);
      requestedByKey.set(key, row);
    }
    if (expectedByKey.size !== currentByKey.size || requestedByKey.size !== currentByKey.size)
      throw fail('O mapa remoto mudou; atualize a conferência antes de sincronizar.');
    for (const [key, live] of currentByKey) {
      const prior = expectedByKey.get(key), target = requestedByKey.get(key);
      if (!prior || !target || prior.quantity !== live.quantity ||
          String(prior.store_id) !== live.storeId || String(prior.network_node_id) !== live.networkNodeId ||
          String(target.store_id) !== live.storeId || String(target.network_node_id) !== live.networkNodeId)
        throw fail('Os saldos ou depósitos remotos mudaram desde a conferência. Consulte novamente.');
    }
    const seller = String((await settings()).user_id || '');
    const itemResponse = await request(`/items/${itemId}?include_attributes=all`);
    const item = await itemResponse.json();
    if (String(item.id) !== itemId || String(item.seller_id) !== seller ||
        String(item.user_product_id || '').toUpperCase() !== userProductId ||
        !Array.isArray(item.tags) || !item.tags.includes('user_product_listing') ||
        String(item.status || '') !== current.status ||
        JSON.stringify(Array.isArray(item.sub_status) ? item.sub_status : []) !== JSON.stringify(current.subStatus))
      throw fail('O anúncio mudou de conta, modelo ou situação durante a conferência. Consulte novamente.');
    const userResponse = await request(`/users/${seller}`);
    const user = await userResponse.json();
    if (String(user.id) !== seller || !Array.isArray(user.tags) ||
        !user.tags.includes('warehouse_management') ||
        (new Set(currentSeller.map(row => row.networkNodeId)).size > 1 && !user.tags.includes('multiwarehouse')))
      throw fail('A configuração multiorigem do vendedor mudou; nenhuma escrita foi feita.');
    if (outOfStockPaused && requested.some(row => row.quantity > 0) && input.confirmReactivation !== true)
      throw fail('Confirme explicitamente que o envio pode reativar o anúncio pausado por falta de estoque.');
    if (requested.every(row => row.quantity === currentByKey.get(keyOf(row)).quantity))
      return { ok: true, itemId, userProductId, stockVersion: current.stockVersion,
        locations: currentSeller.map(row => ({ store_id: row.storeId, network_node_id: row.networkNodeId,
          quantity: row.quantity })), alreadyCurrent: true, reactivated: false };

    const putResponse = await request(`/user-products/${userProductId}/stock/type/seller_warehouse`, {
      method: 'PUT', headers: { 'x-version': current.stockVersion },
      body: JSON.stringify({ locations: requested.map(row => ({ store_id: String(row.store_id),
        network_node_id: String(row.network_node_id), quantity: row.quantity })) }),
    });
    await putResponse.json();
    const verifyResponse = await request(`/user-products/${userProductId}/stock`);
    const verified = await verifyResponse.json();
    const actualLocations = Array.isArray(verified.locations) ? verified.locations : [];
    const actualSeller = actualLocations.filter(row => row?.type === 'seller_warehouse');
    const fullAfter = actualLocations.filter(row => row?.type === 'meli_facility');
    if (String(verified.id || '').toUpperCase() !== userProductId || String(verified.user_id) !== seller ||
        actualSeller.length !== requested.length)
      throw fail('A leitura posterior não corresponde ao User Product; confira os saldos antes de repetir.', 502);
    const actualByKey = new Map(actualSeller.map(row => [keyOf(row), quantity(row.quantity)]));
    if (actualByKey.size !== requestedByKey.size || requested.some(row =>
      actualByKey.get(keyOf(row)) !== row.quantity))
      throw fail('O Mercado Livre não confirmou todas as quantidades solicitadas. Consulte os depósitos antes de repetir.', 502);
    const fullBeforeByKey = new Map(fullBefore.map(row => [keyOf(row), row.quantity]));
    const fullAfterByKey = new Map(fullAfter.map(row => [keyOf(row), quantity(row.quantity)]));
    if (fullBeforeByKey.size !== fullAfterByKey.size ||
        [...fullBeforeByKey].some(([key, value]) => fullAfterByKey.get(key) !== value))
      throw fail('O estoque Full mudou durante a atualização; confira os depósitos antes de repetir.', 502);
    const newVersion = responseHeader(verifyResponse, 'x-version');
    if (!newVersion || !/^\d{1,30}$/.test(newVersion))
      throw fail('O saldo foi atualizado, mas a nova versão não foi informada. Consulte novamente antes de repetir.', 502);
    return { ok: true, itemId, userProductId, stockVersion: newVersion,
      locations: requested.map(row => ({ store_id: String(row.store_id),
        network_node_id: String(row.network_node_id), quantity: row.quantity })),
      alreadyCurrent: false,
      reactivated: outOfStockPaused && requested.some(row => row.quantity > 0) };
  }
  return { read, update, updateWarehouse };
}

module.exports = { createListingStockHandlers, quantity, userProductIdPattern };
