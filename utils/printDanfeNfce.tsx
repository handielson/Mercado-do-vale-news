import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { buildDanfeNfceHtml, parseNfceProcForDanfe } from '../services/danfeNfceCore.cjs';

/** Recebe somente XML nfeProc previamente conferido e persistido pelo emissor fiscal.
 * A checagem estrutural aqui não substitui a validação criptográfica/SEFAZ no servidor.
 */
export function printDanfeNfce(authorizedXml: string, paperWidth: '58mm' | '80mm' | '100mm' = '80mm', printWindow?: Window | null): void {
  const data = parseNfceProcForDanfe(authorizedXml);
  const qrSvg = renderToStaticMarkup(createElement(QRCodeSVG, { value: data.qrCode, size: 160, level: 'M', marginSize: 0 }));
  const html = buildDanfeNfceHtml(data, qrSvg, paperWidth);
  const target = printWindow || window.open('', '_blank');
  if (!target) throw new Error('O navegador bloqueou a janela de impressão do DANFE NFC-e.');
  target.opener = null;
  target.onload = () => { target.focus(); target.print(); };
  target.document.write(html);
  target.document.close();
}
