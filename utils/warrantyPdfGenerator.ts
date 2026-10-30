import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { renderWarrantyBothCopies } from './warrantyTagReplacement';
import { embedDocumentImages, waitForDocumentAssets } from './documentPrintAssets';

type WarrantyPdfInput = {
    warrantyContents: string[];
    warrantyTemplate?: string;
    warrantyTagDataList?: Record<string, string>[];
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Falha ao renderizar pagina do termo de garantia'));
        image.src = dataUrl;
    });
}

export async function generateExistingWarrantyTermPdfBase64(input: WarrantyPdfInput): Promise<string> {
    if (!input.warrantyContents.length) throw new Error('Nenhum termo de garantia para gerar');

    const copies: string[] = [];
    input.warrantyContents.forEach((content, index) => {
        if (input.warrantyTemplate && input.warrantyTagDataList?.[index]) {
            const rendered = renderWarrantyBothCopies(input.warrantyTemplate, input.warrantyTagDataList[index]);
            copies.push(rendered.copy1, rendered.copy2);
            return;
        }
        copies.push(content, content.replace(/Assinatura do Cliente/gi, 'Assinatura da Empresa'));
    });

    const host = document.createElement('div');
    Object.assign(host.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        width: '794px',
        background: '#ffffff',
        color: '#111827',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        lineHeight: '1.6',
        padding: '38px',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: '2147483647',
    });
    document.body.appendChild(host);

    try {
        const imageCache = new Map<string, Promise<string>>();
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        for (let index = 0; index < copies.length; index += 1) {
            if (index > 0) pdf.addPage('a4', 'portrait');
            host.innerHTML = copies[index];
            await embedDocumentImages(host, imageCache);
            await waitForDocumentAssets(host);
            const png = await toPng(host, {
                backgroundColor: '#ffffff',
                cacheBust: false,
                pixelRatio: 2,
                width: 794,
                style: {
                    position: 'static',
                    left: 'auto',
                    top: 'auto',
                    transform: 'none',
                },
            });
            const image = await loadImage(png);
            const availableWidth = 190;
            const availableHeight = 277;
            const ratio = image.naturalHeight / image.naturalWidth;
            let width = availableWidth;
            let height = width * ratio;
            if (height > availableHeight) {
                height = availableHeight;
                width = height / ratio;
            }
            pdf.addImage(png, 'PNG', (210 - width) / 2, 10, width, height, undefined, 'FAST');
        }
        const dataUri = pdf.output('datauristring');
        return dataUri.slice(dataUri.indexOf(',') + 1);
    } finally {
        host.remove();
    }
}
