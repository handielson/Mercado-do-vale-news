'use strict';

const { PDFDocument } = require('pdf-lib');

const MM_TO_PT = 72 / 25.4;
const SHOPEE_THERMAL_WIDTH_MM = 101.6;
const SHOPEE_THERMAL_HEIGHT_MM = 152.4;
const SHOPEE_LABEL_RIGHT_SAFE_MARGIN_MM = 5;

function calculateShopeeThermalPlacement(sourceWidth, sourceHeight) {
    const pageWidth = SHOPEE_THERMAL_WIDTH_MM * MM_TO_PT;
    const pageHeight = SHOPEE_THERMAL_HEIGHT_MM * MM_TO_PT;
    const rightMargin = SHOPEE_LABEL_RIGHT_SAFE_MARGIN_MM * MM_TO_PT;
    const legacyFitScale = Math.min(pageWidth / sourceWidth, pageHeight / sourceHeight);
    const fittedWidth = sourceWidth * legacyFitScale;
    const fittedHeight = sourceHeight * legacyFitScale;

    return {
        pageWidth,
        pageHeight,
        x: 0,
        y: (pageHeight - fittedHeight) / 2,
        width: Math.max(MM_TO_PT, fittedWidth - rightMargin),
        height: fittedHeight,
    };
}

// A etiqueta normal da Shopee ocupa o quadrante superior esquerdo de uma pagina.
// O resultado usa papel fisico 4x6 e preserva a margem que ja existe no lado
// esquerdo do documento. O conteudo perde 5 mm de largura no lado direito para
// ficar dentro da area imprimivel real da Zebra.
async function expandShopeeLabelForThermalPaper(pdfBuffer) {
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const outputPdf = await PDFDocument.create();

    for (const sourcePage of sourcePdf.getPages()) {
        const { width, height } = sourcePage.getSize();
        const label = await outputPdf.embedPage(sourcePage, {
            left: 0,
            bottom: height / 2,
            right: width / 2,
            top: height,
        });
        const placement = calculateShopeeThermalPlacement(width, height);
        const outputPage = outputPdf.addPage([placement.pageWidth, placement.pageHeight]);
        outputPage.drawPage(label, {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
        });
    }

    return Buffer.from(await outputPdf.save());
}

module.exports = {
    SHOPEE_THERMAL_WIDTH_MM,
    SHOPEE_THERMAL_HEIGHT_MM,
    SHOPEE_LABEL_RIGHT_SAFE_MARGIN_MM,
    calculateShopeeThermalPlacement,
    expandShopeeLabelForThermalPaper,
};
