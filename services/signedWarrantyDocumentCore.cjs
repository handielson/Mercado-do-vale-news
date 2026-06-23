const SOURCE_PATTERN = /^termo-garantia-venda-([a-z0-9]{8})\.(jpe?g|png)$/i;

function normalizeSaleCode(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
}

function parseSignedWarrantyFileName(fileName) {
  const match = String(fileName || '').match(SOURCE_PATTERN);
  if (!match) return null;
  const saleCode = normalizeSaleCode(match[1]);
  if (saleCode.length !== 8) return null;
  return { saleCode, extension: match[2].toLowerCase().replace('jpeg', 'jpg') };
}

function buildSignedWarrantyNames(saleCode) {
  if (!/^[a-z0-9]{8}$/i.test(String(saleCode || ''))) throw new Error('invalid_sale_code');
  const code = normalizeSaleCode(saleCode);
  return {
    imageName: `termo-garantia-venda-${code}-original.jpg`,
    pdfName: `termo-garantia-venda-${code}.pdf`,
  };
}

function buildDiscardMessage(date, locale = 'pt-BR', timeZone = 'America/Sao_Paulo') {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `Documento físico digitalizado, destruído e descartado em ${day} às ${time}.`;
}

function fitImageInsideA4(imageWidth, imageHeight, pageWidth, pageHeight, margin) {
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    width,
    height,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
}

module.exports = {
  normalizeSaleCode,
  parseSignedWarrantyFileName,
  buildSignedWarrantyNames,
  buildDiscardMessage,
  fitImageInsideA4,
};
