const bwipjs = require('bwip-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function printableText(value) {
    return String(value || '')
        .replace(/[–—]/g, '-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function wrapText(value, font, size, maxWidth, maxLines = 2) {
    const words = printableText(value).split(' ').filter(Boolean);
    if (!words.length) return ['-'];
    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
            current = candidate;
            continue;
        }
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    const consumed = lines.join(' ').length;
    if (consumed < printableText(value).length && lines.length) {
        let last = lines[lines.length - 1];
        while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
            last = last.slice(0, -1);
        }
        lines[lines.length - 1] = `${last}...`;
    }
    return lines;
}

function formatOrderDate(value) {
    const numeric = Number(value || 0);
    const date = numeric > 0
        ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
        : new Date();
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

function formatMoney(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(amount) ? amount : 0);
}

function drawWrappedLines(page, value, font, size, x, startY, maxWidth, maxLines, color, lineHeight = size + 2) {
    const lines = wrapText(value, font, size, maxWidth, maxLines);
    let y = startY;
    for (const line of lines) {
        page.drawText(line, { x, y, size, font, color });
        y -= lineHeight;
    }
    return y;
}

async function createShopeeInterventionReceiptPdf(input) {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const order = input?.order || {};
    const items = Array.isArray(order.items) && order.items.length
        ? order.items
        : [{ name: 'Itens indisponiveis para consulta', sku: '', quantity: 1, stockLocation: 'Nao consultada' }];
    const pages = [];
    for (let index = 0; index < items.length; index += 3) pages.push(items.slice(index, index + 3));

    const black = rgb(0.04, 0.07, 0.12);
    const gray = rgb(0.32, 0.36, 0.42);
    const red = rgb(0.72, 0.08, 0.08);
    const paleRed = rgb(1, 0.93, 0.93);
    const border = rgb(0.78, 0.81, 0.85);
    const stage = printableText(input?.stageLabel || input?.stage || 'Automacao Shopee');
    const errorCode = printableText(input?.errorCode || 'erro_nao_identificado');
    const errorMessage = printableText(input?.message || 'O pedido precisa de verificacao manual.');
    const instructions = printableText(input?.instructions || 'Abra o pedido, corrija o problema informado e retome o fluxo.');

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = pdf.addPage([288, 432]);
        page.drawRectangle({ x: 0, y: 0, width: 288, height: 432, color: rgb(1, 1, 1) });
        page.drawRectangle({ x: 12, y: 382, width: 264, height: 38, color: red });
        page.drawText('INTERVENCAO NECESSARIA', { x: 22, y: 399, size: 12, font: bold, color: rgb(1, 1, 1) });
        page.drawText(`SHOPEE | ${pageIndex + 1}/${pages.length}`, { x: 218, y: 399, size: 6.5, font: bold, color: rgb(1, 1, 1) });

        page.drawText(`PEDIDO: ${printableText(order.orderSn) || '-'}`, { x: 18, y: 363, size: 11, font: bold, color: black });
        page.drawText(`Etapa: ${stage}`, { x: 18, y: 349, size: 7.5, font: bold, color: red });
        page.drawText(`Detectado: ${formatOrderDate(input?.occurredAt || Date.now())}`, { x: 174, y: 349, size: 6.5, font: regular, color: gray });
        page.drawText(`Cliente: ${printableText(order.buyerName) || 'Nao consultado'}`, { x: 18, y: 335, size: 7.5, font: regular, color: black });
        page.drawText(`Pagamento: ${printableText(order.paymentMethod) || '-'} | Total: ${formatMoney(order.totalAmount)}`, { x: 18, y: 323, size: 7, font: regular, color: gray });

        page.drawRectangle({ x: 16, y: 245, width: 256, height: 66, color: paleRed, borderColor: red, borderWidth: 0.8 });
        page.drawText(`ERRO: ${errorCode}`, { x: 24, y: 297, size: 7.5, font: bold, color: red });
        drawWrappedLines(page, errorMessage, regular, 7.5, 24, 284, 240, 4, black, 9);

        page.drawText('O QUE FAZER', { x: 18, y: 230, size: 8, font: bold, color: black });
        drawWrappedLines(page, instructions, regular, 7.2, 18, 217, 252, 3, black, 9);
        page.drawLine({ start: { x: 18, y: 184 }, end: { x: 270, y: 184 }, thickness: 0.7, color: border });
        page.drawText('ITENS DA VENDA', { x: 18, y: 171, size: 8, font: bold, color: black });

        let y = 156;
        for (const item of pages[pageIndex]) {
            const quantity = Math.max(1, Number(item?.quantity) || 1);
            const [nameLine] = wrapText(`${quantity}x ${item?.name || 'Item'}`, bold, 7.3, 252, 1);
            page.drawText(nameLine, { x: 18, y, size: 7.3, font: bold, color: black });
            y -= 10;
            page.drawText(`SKU: ${printableText(item?.sku) || '-'}`, { x: 24, y, size: 6.5, font: regular, color: gray });
            y -= 9;
            const [locationLine] = wrapText(`Local: ${item?.stockLocation || 'Nao cadastrada'}`, regular, 6.5, 246, 1);
            page.drawText(locationLine, { x: 24, y, size: 6.5, font: regular, color: black });
            y -= 15;
        }

        page.drawRectangle({ x: 16, y: 18, width: 256, height: 30, borderColor: red, borderWidth: 1.2 });
        page.drawText('NAO DESPACHAR ATE CORRIGIR', { x: 45, y: 36, size: 9, font: bold, color: red });
        page.drawText('[  ] Corrigido por: ______________________', { x: 45, y: 24, size: 6.5, font: regular, color: black });
    }

    return Buffer.from(await pdf.save());
}

async function createShopeeSeparationSummaryPdf(order) {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const items = Array.isArray(order?.items) && order.items.length
        ? order.items
        : [{ name: 'Item não informado', sku: '', quantity: 1 }];
    const pages = [];
    for (let index = 0; index < items.length; index += 3) pages.push(items.slice(index, index + 3));

    const trackingNumber = printableText(order?.trackingNumber);
    let barcodePng = null;
    if (trackingNumber) {
        barcodePng = await bwipjs.toBuffer({
            bcid: 'code128',
            text: trackingNumber,
            scale: 3,
            height: 10,
            includetext: false,
            padding: 0,
            backgroundcolor: 'FFFFFF',
        });
    }

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = pdf.addPage([288, 432]);
        const black = rgb(0, 0, 0);
        const gray = rgb(0, 0, 0);
        const border = rgb(0, 0, 0);
        page.drawRectangle({ x: 0, y: 0, width: 288, height: 432, color: rgb(1, 1, 1) });
        page.drawRectangle({ x: 12, y: 384, width: 264, height: 36, borderColor: black, borderWidth: 1, color: rgb(1, 1, 1) });
        page.drawText('RESUMO DE SEPARACAO', { x: 22, y: 398, size: 13, font: bold, color: black });
        page.drawText(`SHOPEE  |  ${pageIndex + 1}/${pages.length}`, { x: 210, y: 399, size: 7, font: bold, color: black });

        page.drawText(`PEDIDO: ${printableText(order?.orderSn) || '-'}`, { x: 18, y: 365, size: 11, font: bold, color: black });
        page.drawText('CODIGO DE RASTREIO', { x: 18, y: 350, size: 7, font: bold, color: gray });
        const trackingLabel = trackingNumber || 'AGUARDANDO GERACAO';
        page.drawText(trackingLabel, { x: 18, y: 334, size: 12, font: bold, color: black });

        if (barcodePng) {
            const barcode = await pdf.embedPng(barcodePng);
            const dimensions = barcode.scale(1);
            const scale = Math.min(252 / dimensions.width, 36 / dimensions.height);
            page.drawImage(barcode, {
                x: 18,
                y: 291,
                width: dimensions.width * scale,
                height: dimensions.height * scale,
            });
        } else {
            page.drawRectangle({ x: 18, y: 291, width: 252, height: 34, borderColor: border, borderWidth: 0.8 });
        }

        page.drawText(`Cliente: ${printableText(order?.buyerName) || 'Cliente Shopee'}`, { x: 18, y: 277, size: 8, font: bold, color: black });
        page.drawText(`Envio: ${printableText(order?.shippingCarrier) || 'Shopee'}  |  Data: ${formatOrderDate(order?.createdAt)}`, { x: 18, y: 264, size: 7, font: regular, color: gray });
        const note = printableText(order?.note);
        if (note) {
            const [noteLine] = wrapText(`Obs.: ${note}`, regular, 7, 252, 1);
            page.drawText(noteLine, { x: 18, y: 252, size: 7, font: regular, color: black });
        }
        page.drawLine({ start: { x: 18, y: 243 }, end: { x: 270, y: 243 }, thickness: 0.7, color: border });
        page.drawText(`ITENS (${items.reduce((sum, item) => sum + Math.max(1, Number(item?.quantity) || 1), 0)} UNIDADES)`, { x: 18, y: 230, size: 8, font: bold, color: black });

        let y = 213;
        for (const item of pages[pageIndex]) {
            const quantity = Math.max(1, Number(item?.quantity) || 1);
            const nameLines = wrapText(`${quantity}x  ${item?.name || 'Item'}`, bold, 8, 252, 2);
            for (const line of nameLines) {
                page.drawText(line, { x: 18, y, size: 8, font: bold, color: black });
                y -= 10;
            }
            const sku = printableText(item?.sku);
            const model = printableText(item?.modelName);
            page.drawText(`SKU: ${sku || '-'}${model ? `  |  Variacao: ${model}` : ''}`, { x: 26, y, size: 6.5, font: regular, color: gray });
            y -= 10;
            const [locationLine] = wrapText(
                `Localizacao: ${item?.stockLocation || 'Nao cadastrada'}`,
                bold,
                6.5,
                244,
                1,
            );
            page.drawText(locationLine, { x: 26, y, size: 6.5, font: bold, color: black });
            y -= 15;
        }

        page.drawLine({ start: { x: 18, y: 70 }, end: { x: 270, y: 70 }, thickness: 0.7, color: border });
        page.drawText('CONFERENCIA', { x: 18, y: 57, size: 7, font: bold, color: black });
        page.drawText('[  ] Produto   [  ] Quantidade   [  ] Modelo/Cor', { x: 18, y: 45, size: 7, font: regular, color: black });
        page.drawText('Separado: ______________  Conferido: ______________', { x: 18, y: 30, size: 7, font: regular, color: black });
        page.drawText('Horario: ________:________', { x: 18, y: 16, size: 7, font: regular, color: black });
    }

    return Buffer.from(await pdf.save());
}

module.exports = {
    createShopeeInterventionReceiptPdf,
    createShopeeSeparationSummaryPdf,
    formatOrderDate,
    formatMoney,
    printableText,
    wrapText,
};
