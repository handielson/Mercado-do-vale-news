const bwipjs = require('bwip-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MM_TO_PT = 72 / 25.4;
const RECEIPT_WIDTH_MM = 80;
const RECEIPT_HEIGHT_MM = 152.4;
// The Lenovo receipt driver has an asymmetric hardware/driver dead zone that
// consumes roughly the first 8 mm of a custom PDF page. Keep every printable
// element inside a 10 mm safe area so real order receipts are not clipped,
// even though the Windows native test page (which uses driver-owned margins)
// prints correctly.
const RECEIPT_MARGIN_MM = 10;
const RECEIPT_WIDTH = RECEIPT_WIDTH_MM * MM_TO_PT;
const RECEIPT_HEIGHT = RECEIPT_HEIGHT_MM * MM_TO_PT;
const RECEIPT_MARGIN = RECEIPT_MARGIN_MM * MM_TO_PT;
const RECEIPT_RIGHT = RECEIPT_WIDTH - RECEIPT_MARGIN;
const RECEIPT_CONTENT_WIDTH = RECEIPT_WIDTH - (RECEIPT_MARGIN * 2);

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
    const words = printableText(value).split(' ').filter(Boolean).flatMap((word) => {
        if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
        const fragments = [];
        let fragment = '';
        for (const character of word) {
            const candidate = `${fragment}${character}`;
            if (fragment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
                fragments.push(fragment);
                fragment = character;
            } else {
                fragment = candidate;
            }
        }
        if (fragment) fragments.push(fragment);
        return fragments;
    });
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
        if (lines.length >= maxLines) {
            current = '';
            break;
        }
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

function drawRightAlignedText(page, value, { right, y, size, font, color }) {
    const text = printableText(value);
    page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color });
}

function drawCenteredText(page, value, { center, y, size, font, color }) {
    const text = printableText(value);
    page.drawText(text, { x: center - (font.widthOfTextAtSize(text, size) / 2), y, size, font, color });
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
    for (let index = 0; index < items.length; index += 2) pages.push(items.slice(index, index + 2));

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
        const page = pdf.addPage([RECEIPT_WIDTH, RECEIPT_HEIGHT]);
        page.drawRectangle({ x: 0, y: 0, width: RECEIPT_WIDTH, height: RECEIPT_HEIGHT, color: rgb(1, 1, 1) });
        page.drawRectangle({ x: RECEIPT_MARGIN, y: 379, width: RECEIPT_CONTENT_WIDTH, height: 38, color: red });
        page.drawText('INTERVENCAO NECESSARIA', { x: RECEIPT_MARGIN + 8, y: 396, size: 9.5, font: bold, color: rgb(1, 1, 1) });
        drawRightAlignedText(page, `SHOPEE | ${pageIndex + 1}/${pages.length}`, {
            right: RECEIPT_RIGHT - 6, y: 396, size: 6, font: bold, color: rgb(1, 1, 1),
        });

        page.drawText(`PEDIDO: ${printableText(order.orderSn) || '-'}`, { x: RECEIPT_MARGIN + 4, y: 361, size: 10, font: bold, color: black });
        page.drawText(`Etapa: ${stage}`, { x: RECEIPT_MARGIN + 4, y: 347, size: 7.2, font: bold, color: red });
        page.drawText(`Detectado: ${formatOrderDate(input?.occurredAt || Date.now())}`, { x: RECEIPT_MARGIN + 4, y: 335, size: 6.3, font: regular, color: gray });
        page.drawText(`Cliente: ${printableText(order.buyerName) || 'Nao consultado'}`, { x: RECEIPT_MARGIN + 4, y: 323, size: 7.2, font: regular, color: black });
        page.drawText(`Pagamento: ${printableText(order.paymentMethod) || '-'} | Total: ${formatMoney(order.totalAmount)}`, { x: RECEIPT_MARGIN + 4, y: 311, size: 6.5, font: regular, color: gray });

        page.drawRectangle({ x: RECEIPT_MARGIN + 2, y: 235, width: RECEIPT_CONTENT_WIDTH - 4, height: 64, color: paleRed, borderColor: red, borderWidth: 0.8 });
        page.drawText(`ERRO: ${errorCode}`, { x: RECEIPT_MARGIN + 9, y: 285, size: 7.2, font: bold, color: red });
        drawWrappedLines(page, errorMessage, regular, 7.2, RECEIPT_MARGIN + 9, 272, RECEIPT_CONTENT_WIDTH - 18, 4, black, 8.5);

        page.drawText('O QUE FAZER', { x: RECEIPT_MARGIN + 4, y: 221, size: 8, font: bold, color: black });
        drawWrappedLines(page, instructions, regular, 7, RECEIPT_MARGIN + 4, 208, RECEIPT_CONTENT_WIDTH - 8, 3, black, 8.5);
        page.drawLine({ start: { x: RECEIPT_MARGIN + 4, y: 176 }, end: { x: RECEIPT_RIGHT - 4, y: 176 }, thickness: 0.7, color: border });
        page.drawText('ITENS DA VENDA', { x: RECEIPT_MARGIN + 4, y: 163, size: 8, font: bold, color: black });

        let y = 148;
        for (const item of pages[pageIndex]) {
            const quantity = Math.max(1, Number(item?.quantity) || 1);
            const nameLines = wrapText(`${quantity}x ${item?.name || 'Item'}`, bold, 7, RECEIPT_CONTENT_WIDTH - 8, Number.POSITIVE_INFINITY);
            for (const nameLine of nameLines) {
                page.drawText(nameLine, { x: RECEIPT_MARGIN + 4, y, size: 7, font: bold, color: black });
                y -= 8.5;
            }
            page.drawText(`SKU: ${printableText(item?.sku) || '-'}`, { x: RECEIPT_MARGIN + 10, y, size: 6.2, font: regular, color: gray });
            y -= 9;
            const [locationLine] = wrapText(`Local: ${item?.stockLocation || 'Nao cadastrada'}`, regular, 6.2, RECEIPT_CONTENT_WIDTH - 14, 1);
            page.drawText(locationLine, { x: RECEIPT_MARGIN + 10, y, size: 6.2, font: regular, color: black });
            y -= 15;
        }

        page.drawRectangle({ x: RECEIPT_MARGIN + 2, y: RECEIPT_MARGIN + 2, width: RECEIPT_CONTENT_WIDTH - 4, height: 30, borderColor: red, borderWidth: 1.2 });
        drawCenteredText(page, 'NAO DESPACHAR ATE CORRIGIR', { center: RECEIPT_WIDTH / 2, y: RECEIPT_MARGIN + 20, size: 8.2, font: bold, color: red });
        drawCenteredText(page, '[  ] Corrigido por: __________________', { center: RECEIPT_WIDTH / 2, y: RECEIPT_MARGIN + 8, size: 6.2, font: regular, color: black });
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
    const itemLayouts = items.map((item) => {
        const quantity = Math.max(1, Number(item?.quantity) || 1);
        const sku = printableText(item?.sku);
        const model = printableText(item?.modelName);
        const nameLines = wrapText(
            `${quantity}x  ${item?.name || 'Item'}`,
            bold,
            7.6,
            RECEIPT_CONTENT_WIDTH - 8,
            Number.POSITIVE_INFINITY,
        );
        const detailLines = wrapText(
            `SKU: ${sku || '-'}${model ? `  |  Variacao: ${model}` : ''}`,
            regular,
            6.1,
            RECEIPT_CONTENT_WIDTH - 14,
            Number.POSITIVE_INFINITY,
        );
        const locationLines = wrapText(
            `Localizacao: ${item?.stockLocation || 'Nao cadastrada'}`,
            bold,
            6.1,
            RECEIPT_CONTENT_WIDTH - 14,
            Number.POSITIVE_INFINITY,
        );
        return {
            nameLines,
            detailLines,
            locationLines,
            height: (nameLines.length * 9) + (detailLines.length * 7.5) + (locationLines.length * 7.5) + 8,
        };
    });
    const pages = [[]];
    const pageHeights = [0];
    const availableItemsHeight = 125;
    for (const layout of itemLayouts) {
        const pageIndex = pages.length - 1;
        if (pages[pageIndex].length && pageHeights[pageIndex] + layout.height > availableItemsHeight) {
            pages.push([layout]);
            pageHeights.push(layout.height);
        } else {
            pages[pageIndex].push(layout);
            pageHeights[pageIndex] += layout.height;
        }
    }

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
        const page = pdf.addPage([RECEIPT_WIDTH, RECEIPT_HEIGHT]);
        const black = rgb(0, 0, 0);
        const gray = rgb(0, 0, 0);
        const border = rgb(0, 0, 0);
        page.drawRectangle({ x: 0, y: 0, width: RECEIPT_WIDTH, height: RECEIPT_HEIGHT, color: rgb(1, 1, 1) });
        page.drawRectangle({ x: RECEIPT_MARGIN, y: 381, width: RECEIPT_CONTENT_WIDTH, height: 36, borderColor: black, borderWidth: 1, color: rgb(1, 1, 1) });
        page.drawText('RESUMO DE SEPARACAO', { x: RECEIPT_MARGIN + 6, y: 395, size: 8.5, font: bold, color: black });
        const marketplaceName = printableText(order?.marketplaceName) || 'SHOPEE';
        drawRightAlignedText(page, `${marketplaceName} | ${pageIndex + 1}/${pages.length}`, {
            right: RECEIPT_RIGHT - 4, y: 396, size: 5.8, font: bold, color: black,
        });

        page.drawText(`PEDIDO: ${printableText(order?.orderSn) || '-'}`, { x: RECEIPT_MARGIN + 4, y: 363, size: 10, font: bold, color: black });
        page.drawText('CODIGO DE RASTREIO', { x: RECEIPT_MARGIN + 4, y: 348, size: 7, font: bold, color: gray });
        const trackingLabel = trackingNumber || 'AGUARDANDO GERACAO';
        page.drawText(trackingLabel, { x: RECEIPT_MARGIN + 4, y: 332, size: 11, font: bold, color: black });

        if (barcodePng) {
            const barcode = await pdf.embedPng(barcodePng);
            const dimensions = barcode.scale(1);
            const scale = Math.min((RECEIPT_CONTENT_WIDTH - 8) / dimensions.width, 36 / dimensions.height);
            page.drawImage(barcode, {
                x: RECEIPT_MARGIN + 4,
                y: 289,
                width: dimensions.width * scale,
                height: dimensions.height * scale,
            });
        } else {
            page.drawRectangle({ x: RECEIPT_MARGIN + 4, y: 289, width: RECEIPT_CONTENT_WIDTH - 8, height: 34, borderColor: border, borderWidth: 0.8 });
        }

        const [buyerLine] = wrapText(`Cliente: ${printableText(order?.buyerName) || `Cliente ${marketplaceName}`}`, bold, 7.2, RECEIPT_CONTENT_WIDTH - 8, 1);
        page.drawText(buyerLine, { x: RECEIPT_MARGIN + 4, y: 275, size: 7.2, font: bold, color: black });
        const [carrierLine] = wrapText(`Envio: ${printableText(order?.shippingCarrier) || marketplaceName}`, regular, 6.5, RECEIPT_CONTENT_WIDTH - 8, 1);
        page.drawText(carrierLine, { x: RECEIPT_MARGIN + 4, y: 263, size: 6.5, font: regular, color: gray });
        page.drawText(`Data: ${formatOrderDate(order?.createdAt)}`, { x: RECEIPT_MARGIN + 4, y: 252, size: 6.5, font: regular, color: gray });
        const note = printableText(order?.note);
        if (note) {
            const [noteLine] = wrapText(`Obs.: ${note}`, regular, 6.3, RECEIPT_CONTENT_WIDTH - 8, 1);
            page.drawText(noteLine, { x: RECEIPT_MARGIN + 4, y: 241, size: 6.3, font: regular, color: black });
        }
        page.drawLine({ start: { x: RECEIPT_MARGIN + 4, y: 231 }, end: { x: RECEIPT_RIGHT - 4, y: 231 }, thickness: 0.7, color: border });
        page.drawText(`ITENS (${items.reduce((sum, item) => sum + Math.max(1, Number(item?.quantity) || 1), 0)} UNIDADES)`, { x: RECEIPT_MARGIN + 4, y: 218, size: 8, font: bold, color: black });

        let y = 201;
        for (const layout of pages[pageIndex]) {
            for (const line of layout.nameLines) {
                page.drawText(line, { x: RECEIPT_MARGIN + 4, y, size: 7.6, font: bold, color: black });
                y -= 9;
            }
            for (const line of layout.detailLines) {
                page.drawText(line, { x: RECEIPT_MARGIN + 10, y, size: 6.1, font: regular, color: gray });
                y -= 7.5;
            }
            for (const line of layout.locationLines) {
                page.drawText(line, { x: RECEIPT_MARGIN + 10, y, size: 6.1, font: bold, color: black });
                y -= 7.5;
            }
            y -= 8;
        }

        page.drawLine({ start: { x: RECEIPT_MARGIN + 4, y: 90 }, end: { x: RECEIPT_RIGHT - 4, y: 90 }, thickness: 0.7, color: border });
        page.drawText('CONFERENCIA', { x: RECEIPT_MARGIN + 4, y: 78, size: 7, font: bold, color: black });
        page.drawText('[ ] Produto  [ ] Quantidade  [ ] Modelo/Cor', { x: RECEIPT_MARGIN + 4, y: 66, size: 6.2, font: regular, color: black });
        page.drawText('Separado: __________  Conferido: __________', { x: RECEIPT_MARGIN + 4, y: 52, size: 6.2, font: regular, color: black });
        page.drawText('Horario: ________:________', { x: RECEIPT_MARGIN + 4, y: 38, size: 6.2, font: regular, color: black });
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
