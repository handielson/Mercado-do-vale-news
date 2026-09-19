const bwipjs = require('bwip-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MM_TO_PT = 72 / 25.4;
const ML_SUMMARY_WIDTH_MM = 90;
const ML_SUMMARY_HEIGHT_MM = 100;
const ML_SUMMARY_HORIZONTAL_MARGIN_MM = 10;
const ML_SUMMARY_VERTICAL_MARGIN_MM = 5;

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

function fitText(value, font, size, maxWidth) {
    const text = String(value || '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ').replace(/\s+/g, ' ').trim();
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let clipped = text;
    while (clipped && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) clipped = clipped.slice(0, -1);
    return `${clipped}...`;
}

async function createMercadoLivreSummaryPdf(job = {}) {
    const data = job.marketplaceName ? job : buildMercadoLivreSummaryData(job);
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const width = ML_SUMMARY_WIDTH_MM * MM_TO_PT;
    const height = ML_SUMMARY_HEIGHT_MM * MM_TO_PT;
    const marginX = ML_SUMMARY_HORIZONTAL_MARGIN_MM * MM_TO_PT;
    const marginY = ML_SUMMARY_VERTICAL_MARGIN_MM * MM_TO_PT;
    const contentWidth = width - (marginX * 2);
    const black = rgb(0, 0, 0);
    const items = data.items.length ? data.items : [{ name: 'Item nao informado', sku: '', quantity: 1, stockLocation: '' }];
    const pageGroups = [];
    for (let index = 0; index < items.length; index += 3) pageGroups.push(items.slice(index, index + 3));
    let barcodePng = null;
    if (data.trackingNumber) {
        barcodePng = await bwipjs.toBuffer({ bcid: 'code128', text: data.trackingNumber, scale: 2, height: 7,
            includetext: false, padding: 0, backgroundcolor: 'FFFFFF' });
    }
    for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex += 1) {
        const page = pdf.addPage([width, height]);
        page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
        page.drawRectangle({ x: marginX, y: height - marginY - 27, width: contentWidth, height: 27, borderColor: black, borderWidth: 1 });
        page.drawText(fitText(`${data.marketplaceName} - SEPARACAO`, bold, 9, contentWidth - 26), { x: marginX + 5, y: height - marginY - 13, size: 9, font: bold, color: black });
        page.drawText(`${pageIndex + 1}/${pageGroups.length}`, { x: width - marginX - 18, y: height - marginY - 13, size: 7, font: bold, color: black });
        page.drawText(`Pedido: ${fitText(data.orderSn || '-', bold, 8.5, contentWidth - 4)}`, { x: marginX + 2, y: height - marginY - 42, size: 8.5, font: bold, color: black });
        page.drawText(`Cliente: ${fitText(data.buyerName, regular, 6.5, contentWidth - 4)}`, { x: marginX + 2, y: height - marginY - 54, size: 6.5, font: regular, color: black });
        if (barcodePng) {
            const barcode = await pdf.embedPng(barcodePng);
            const dimensions = barcode.scale(1);
            const scale = Math.min((contentWidth - 8) / dimensions.width, 28 / dimensions.height);
            page.drawImage(barcode, { x: marginX + 4, y: height - marginY - 88, width: dimensions.width * scale, height: dimensions.height * scale });
            page.drawText(fitText(data.trackingNumber, regular, 6, contentWidth - 4), { x: marginX + 2, y: height - marginY - 96, size: 6, font: regular, color: black });
        } else {
            page.drawText('Rastreio aguardando geracao', { x: marginX + 2, y: height - marginY - 75, size: 6.5, font: bold, color: black });
        }
        let y = height - marginY - 112;
        for (const item of pageGroups[pageIndex]) {
            const quantity = Math.max(1, Number(item.quantity) || 1);
            page.drawText(fitText(`${quantity}x ${item.name}`, bold, 7, contentWidth - 4), { x: marginX + 2, y, size: 7, font: bold, color: black });
            y -= 10;
            page.drawText(fitText(`SKU: ${item.sku || '-'} | Local: ${item.stockLocation || 'Nao cadastrado'}`, regular, 5.7, contentWidth - 7),
                { x: marginX + 5, y, size: 5.7, font: regular, color: black });
            y -= 13;
        }
        page.drawLine({ start: { x: marginX + 2, y: 40 }, end: { x: width - marginX - 2, y: 40 }, thickness: 0.7, color: black });
        page.drawText('[ ] Produto  [ ] Quantidade  [ ] Modelo/Cor', { x: marginX + 2, y: 29, size: 6, font: regular, color: black });
        page.drawText('Separado: __________  Conferido: __________', { x: marginX + 2, y: 17, size: 5.7, font: regular, color: black });
    }
    return Buffer.from(await pdf.save());
}

module.exports = { buildMercadoLivreSummaryData, createMercadoLivreSummaryPdf, parseJobPayload, variationName,
    ML_SUMMARY_WIDTH_MM, ML_SUMMARY_HEIGHT_MM, ML_SUMMARY_HORIZONTAL_MARGIN_MM, ML_SUMMARY_VERTICAL_MARGIN_MM };
