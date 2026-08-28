function parseJobPayload(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function variationName(attributes) {
    return (Array.isArray(attributes) ? attributes : [])
        .map((attribute) => String(attribute?.value_name || attribute?.value || '').trim())
        .filter(Boolean)
        .join(' / ');
}

function buildMercadoLivreSummaryData(job = {}) {
    const payload = parseJobPayload(job.payload);
    const order = payload.order || {};
    const shipment = payload.shipment || {};
    const receiver = shipment.receiver_address || shipment.destination?.shipping_address || {};
    return {
        marketplaceName: 'MERCADO LIVRE',
        orderSn: String(job.orderId || order.id || ''),
        trackingNumber: String(job.trackingNumber || shipment.tracking_number || shipment.tracking_id || ''),
        buyerName: receiver.receiver_name || receiver.name || order.buyer?.nickname || 'Cliente Mercado Livre',
        shippingCarrier: shipment.shipping_option?.name || shipment.lead_time?.shipping_method?.name || 'Mercado Envios',
        createdAt: Date.parse(order.date_created || order.date_closed || '') || Date.now(),
        note: order.comment || '',
        paymentMethod: 'Mercado Livre',
        totalAmount: Number(order.total_amount || order.paid_amount || 0),
        items: (order.order_items || []).map((orderItem) => ({
            name: orderItem.item?.title || 'Item Mercado Livre',
            sku: orderItem.item?.seller_sku || orderItem.item?.seller_custom_field || orderItem.seller_sku || '',
            modelName: variationName(orderItem.item?.variation_attributes),
            quantity: Math.max(1, Number(orderItem.quantity) || 1),
            stockLocation: 'Nao cadastrada',
        })),
    };
}

module.exports = { buildMercadoLivreSummaryData, parseJobPayload, variationName };
