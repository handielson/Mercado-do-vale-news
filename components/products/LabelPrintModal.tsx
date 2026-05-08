import React, { useState, useMemo } from 'react';
import { X, Printer, Settings, Package } from 'lucide-react';
import Barcode from 'react-barcode';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Product } from '../../types/product';

interface LabelPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
}

interface LabelSize {
    id: string;
    label: string;
    width: number;  // mm
    height: number; // mm
    fontStore: number;
    fontName: number;
    fontPrice: number;
    fontPriceCurrency: number;
    barcodeWidth: number;
    barcodeHeight: number;
    barcodeFont: number;
    padding: number; // mm
}

// Tamanhos comuns. As opções até 50mm de largura são compatíveis com a Marklife P50/P50S.
// fontPrice já vem dobrado (preço grande, conforme pedido).
const LABEL_SIZES: LabelSize[] = [
    { id: '40x30',  label: '40 × 30 mm  (P50S padrão)', width: 40, height: 30, fontStore: 9,  fontName: 7,  fontPrice: 26, fontPriceCurrency: 12, barcodeWidth: 0.9, barcodeHeight: 18, barcodeFont: 8,  padding: 1 },
    { id: '50x30',  label: '50 × 30 mm  (P50S)',        width: 50, height: 30, fontStore: 10, fontName: 8,  fontPrice: 28, fontPriceCurrency: 14, barcodeWidth: 1.0, barcodeHeight: 20, barcodeFont: 9,  padding: 1 },
    { id: '30x40',  label: '30 × 40 mm  (P50S)',        width: 30, height: 40, fontStore: 8,  fontName: 7,  fontPrice: 24, fontPriceCurrency: 12, barcodeWidth: 0.8, barcodeHeight: 24, barcodeFont: 7,  padding: 0.8 },
    { id: '40x25',  label: '40 × 25 mm  (P50S)',        width: 40, height: 25, fontStore: 8,  fontName: 7,  fontPrice: 24, fontPriceCurrency: 12, barcodeWidth: 0.9, barcodeHeight: 14, barcodeFont: 7,  padding: 0.8 },
    { id: '30x20',  label: '30 × 20 mm  (rolo 20×30 P50S)', width: 30, height: 20, fontStore: 7,  fontName: 6,  fontPrice: 20, fontPriceCurrency: 10, barcodeWidth: 0.55, barcodeHeight: 10, barcodeFont: 6, padding: 0.5 },
    { id: '60x40',  label: '60 × 40 mm',                width: 60, height: 40, fontStore: 11, fontName: 9,  fontPrice: 36, fontPriceCurrency: 16, barcodeWidth: 1.2, barcodeHeight: 26, barcodeFont: 10, padding: 1.5 },
    { id: '80x40',  label: '80 × 40 mm',                width: 80, height: 40, fontStore: 13, fontName: 10, fontPrice: 44, fontPriceCurrency: 18, barcodeWidth: 1.5, barcodeHeight: 30, barcodeFont: 11, padding: 1.5 },
    { id: '80x50',  label: '80 × 50 mm',                width: 80, height: 50, fontStore: 14, fontName: 11, fontPrice: 48, fontPriceCurrency: 20, barcodeWidth: 1.6, barcodeHeight: 40, barcodeFont: 12, padding: 2 },
];

const MAX_COPIES = 500;
const LABEL_SIZE_STORAGE_KEY = 'mdv.labelPrint.preferredSizeId';
const DEFAULT_LABEL_SIZE_ID = '30x20';

function getPreferredLabelSizeId(): string {
    if (typeof window === 'undefined') return DEFAULT_LABEL_SIZE_ID;

    try {
        const stored = localStorage.getItem(LABEL_SIZE_STORAGE_KEY);
        return LABEL_SIZES.some((size) => size.id === stored) ? stored! : DEFAULT_LABEL_SIZE_ID;
    } catch {
        return DEFAULT_LABEL_SIZE_ID;
    }
}

interface LabelContentProps {
    size: LabelSize;
    labelName: string;
    sku: string;
    showPrice: boolean;
    labelPrice: string;
    barcodeValue: string;
}

const LABEL_FONT_FAMILY = "Verdana, Tahoma, Arial, Helvetica, sans-serif";
const LABEL_MONO_FAMILY = "'Courier New', Courier, monospace";

const LabelContent: React.FC<LabelContentProps> = ({ size, labelName, sku, showPrice, labelPrice, barcodeValue }) => {
    const fontSkuPx = Math.max(size.fontName + 1, Math.round(size.fontName * 1.2));
    return (
        <div
            style={{
                width: `${size.width}mm`,
                height: `${size.height}mm`,
                padding: `${size.padding}mm`,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'center',
                background: '#fff',
                color: '#000',
                overflow: 'hidden',
                fontFamily: LABEL_FONT_FAMILY,
            }}
        >
            <div style={{ width: '100%' }}>
                <div
                    style={{
                        fontSize: `${size.fontName}px`,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        lineHeight: 1.1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {labelName || 'Sem Nome'}
                </div>
                {sku && (
                    <div style={{ fontSize: `${fontSkuPx}px`, fontWeight: 700, fontFamily: LABEL_MONO_FAMILY, lineHeight: 1.1, marginTop: '1px', letterSpacing: '0.5px' }}>
                        {sku}
                    </div>
                )}
            </div>

            {showPrice && (
                <div style={{ fontWeight: 800, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2px', fontSize: `${size.fontPrice}px`, lineHeight: 1 }}>
                    <span style={{ fontSize: `${size.fontPriceCurrency}px`, marginTop: '3px' }}>R$</span>
                    {labelPrice ? Number(labelPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                </div>
            )}

            {barcodeValue && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                    <Barcode
                        value={barcodeValue}
                        format="CODE128"
                        renderer="img"
                        width={size.barcodeWidth}
                        height={size.barcodeHeight}
                        displayValue={true}
                        fontSize={size.barcodeFont}
                        margin={0}
                        background="#ffffff"
                    />
                </div>
            )}
        </div>
    );
};

// DPI alvo da imagem que cai no PDF. 300dpi vai bem em térmicas de 203dpi.
const RENDER_DPI = 300;
const PX_PER_MM = RENDER_DPI / 25.4;
// Margem física em cada lado da etiqueta. Térmicas (P50S) tem ~1mm de borda
// não-imprimível; 2.5mm garante folga generosa e barras mais leves visualmente.
const BARCODE_SAFE_MARGIN_MM = 2.5;

// Resolução nativa da P50S em DPI. Renderizamos o canvas do barcode exatamente
// nesse DPI — assim, quando o driver da impressora rasteriza o PDF, mapeia
// 1 pixel da nossa imagem em 1 dot da impressora, sem reamostragem/anti-alias.
const PRINTER_DPI = 203;
const PRINTER_PX_PER_MM = PRINTER_DPI / 25.4;

interface BarcodeRectMm {
    x: number;
    y: number;
    barsWidth: number;
    barsHeight: number;
    valueGap: number;
    valueFontPt: number;
}

// Calcula a área (em mm) onde o barcode será desenhado no PDF.
function computeBarcodeRectMm(size: LabelSize): BarcodeRectMm {
    const barsWidth = size.width - BARCODE_SAFE_MARGIN_MM * 2;
    // Bloco total reservado para o barcode (barras + gap + texto do valor)
    const totalBlock = size.height * 0.40;
    const valueFontPt = Math.max(5, Math.min(8, size.barcodeFont * 0.95));
    const valueGap = 0.4;
    const valueTextMm = valueFontPt * 0.3528; // 1pt = 0.3528mm
    const barsHeight = Math.max(2, totalBlock - valueGap - valueTextMm);
    const x = (size.width - barsWidth) / 2;
    const y = size.height - 0.5 - totalBlock;
    return { x, y, barsWidth, barsHeight, valueGap, valueFontPt };
}

interface BarcodeImageResult {
    dataUrl: string;
    actualWidthMm: number;
    actualHeightMm: number;
    formatUsed: 'EAN13' | 'CODE128';
}

function isValidEan13(value: string): boolean {
    if (!/^\d{13}$/.test(value)) return false;
    const digits = value.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    const expected = (10 - (sum % 10)) % 10;
    return expected === digits[12];
}

// Renderiza o barcode num canvas com EXATAMENTE 1 pixel = 1 dot da impressora.
// Cada módulo ocupa N dots inteiros (sem fração) → printer rasteriza 1:1 sem anti-alias.
// Usa EAN-13 quando o valor é EAN válido (95 módulos = cabe com 2 dots/módulo em 30mm),
// CODE128 caso contrário (123+ módulos = pode precisar cair pra 1 dot/módulo).
function makeBarcodeImagePrinterDpi(
    value: string,
    maxWidthMm: number,
    barsHeightMm: number,
): BarcodeImageResult | null {
    if (!value) return null;
    const format: 'EAN13' | 'CODE128' = isValidEan13(value) ? 'EAN13' : 'CODE128';

    // Probe pra contar módulos: roda com width=1 e mede a canvas
    const probe = document.createElement('canvas');
    try {
        JsBarcode(probe, value, {
            format,
            width: 1,
            height: 1,
            displayValue: false,
            margin: 0,
        });
    } catch (err) {
        console.error(`[LabelPrint] erro probe ${format}:`, err);
        return null;
    }
    const moduleCount = probe.width;
    if (moduleCount <= 0) return null;

    const targetDots = maxWidthMm * PRINTER_PX_PER_MM;
    let widthParam = Math.floor(targetDots / moduleCount);
    if (widthParam < 1) widthParam = 1;
    const heightDots = Math.max(8, Math.round(barsHeightMm * PRINTER_PX_PER_MM));

    const canvas = document.createElement('canvas');
    try {
        JsBarcode(canvas, value, {
            format,
            width: widthParam,
            height: heightDots,
            displayValue: false,
            margin: 0,
            background: '#ffffff',
        });
    } catch (err) {
        console.error(`[LabelPrint] erro render ${format}:`, err);
        return null;
    }
    return {
        dataUrl: canvas.toDataURL('image/png'),
        actualWidthMm: canvas.width / PRINTER_PX_PER_MM,
        actualHeightMm: canvas.height / PRINTER_PX_PER_MM,
        formatUsed: format,
    };
}

// Desenha barcode no PDF: barras como imagem na DPI nativa da impressora
// (1px=1dot, sem rescaling) e texto do valor como vetor (always crisp).
function drawBarcodeOnPdf(doc: jsPDF, value: string, rect: BarcodeRectMm): boolean {
    const img = makeBarcodeImagePrinterDpi(value, rect.barsWidth, rect.barsHeight);
    if (!img) return false;
    // Centraliza horizontalmente caso o widthParam inteiro tenha gerado
    // largura menor que o disponível.
    const xOffset = (rect.barsWidth - img.actualWidthMm) / 2;
    doc.addImage(
        img.dataUrl,
        'PNG',
        rect.x + xOffset,
        rect.y,
        img.actualWidthMm,
        img.actualHeightMm,
        undefined,
        'NONE',
    );

    // Texto do valor abaixo (vetor)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(rect.valueFontPt);
    const baselineY = rect.y + img.actualHeightMm + rect.valueGap + rect.valueFontPt * 0.3528;
    doc.text(value, rect.x + rect.barsWidth / 2, baselineY, { align: 'center' });
    return true;
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? current + ' ' + word : word;
        if (ctx.measureText(candidate).width > maxWidth && current) {
            lines.push(current);
            current = word;
            if (lines.length >= maxLines - 1) break;
        } else {
            current = candidate;
        }
    }
    if (current && lines.length < maxLines) lines.push(current);
    return lines;
}

interface RenderOpts {
    size: LabelSize;
    labelName: string;
    sku: string;
    showPrice: boolean;
    labelPrice: string;
    barcodeValue: string;
}

// Renderiza UMA etiqueta numa canvas em alta resolução, no layout landscape (width × height).
function renderLabelCanvas(opts: RenderOpts): HTMLCanvasElement {
    const { size, labelName, sku, showPrice, labelPrice, barcodeValue } = opts;
    const widthPx = Math.round(size.width * PX_PER_MM);
    const heightPx = Math.round(size.height * PX_PER_MM);
    const padPx = size.padding * PX_PER_MM;
    const fontScale = RENDER_DPI / 96; // px do screen => px do render alvo

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const sansFamily = 'Verdana, Tahoma, "DejaVu Sans", Arial, Helvetica, sans-serif';
    const monoFamily = '"Courier New", "DejaVu Sans Mono", Courier, monospace';
    const innerW = widthPx - padPx * 2;
    let y = padPx;

    // 1) Nome do produto (até 2 linhas — agora tem mais espaço sem o nome da loja)
    const namePxR = Math.round(size.fontName * fontScale);
    ctx.font = `bold ${namePxR}px ${sansFamily}`;
    const nameLines = wrapTextLines(ctx, (labelName || '').toUpperCase(), innerW, 2);
    for (const line of nameLines) {
        ctx.fillText(line, widthPx / 2, y, innerW);
        y += namePxR * 1.15;
    }

    // 3) SKU (mono, um pouco maior que o nome)
    if (sku) {
        const skuPxR = Math.round(Math.max(size.fontName + 1, size.fontName * 1.2) * fontScale);
        ctx.font = `bold ${skuPxR}px ${monoFamily}`;
        ctx.fillText(sku, widthPx / 2, y, innerW);
        y += skuPxR * 1.15;
    }

    // 4) Barcode — NÃO desenhamos na canvas (vai como vetor no PDF, em buildPdf).
    //    Calculamos só o topo do bloco do barcode em px de canvas pra centralizar o preço.
    let barcodeTopY = heightPx - padPx;
    if (barcodeValue) {
        const bcRectMm = computeBarcodeRectMm(size);
        barcodeTopY = bcRectMm.y * PX_PER_MM;
    }

    // 5) Preço (centro entre y atual e topo do bloco do barcode)
    if (showPrice) {
        const pricePxR = Math.round(size.fontPrice * fontScale);
        ctx.font = `bold ${pricePxR}px ${sansFamily}`;
        const slotTop = y;
        const slotBottom = barcodeTopY - padPx * 0.4;
        const priceText = `R$ ${labelPrice ? Number(labelPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`;
        ctx.textBaseline = 'middle';
        const priceY = (slotTop + slotBottom) / 2;
        ctx.fillText(priceText, widthPx / 2, priceY, innerW);
        ctx.textBaseline = 'top';
    }

    return canvas;
}

function buildPdf(opts: RenderOpts & { copies: number }): jsPDF {
    const { size, copies } = opts;

    // Renderiza a etiqueta em alta resolução (texto/preço/SKU) — barcode fica
    // vazio na canvas e é desenhado depois como vetor PDF.
    const labelCanvas = renderLabelCanvas(opts);
    const dataUrl = labelCanvas.toDataURL('image/png');

    const pdfPageW = size.width;
    const pdfPageH = size.height;
    const orientation: 'portrait' | 'landscape' = pdfPageW >= pdfPageH ? 'landscape' : 'portrait';

    const doc = new jsPDF({
        unit: 'mm',
        format: [pdfPageW, pdfPageH],
        orientation,
        compress: true,
    });

    const barcodeRect = opts.barcodeValue ? computeBarcodeRectMm(size) : null;

    for (let i = 0; i < copies; i++) {
        if (i > 0) {
            doc.addPage([pdfPageW, pdfPageH], orientation);
        }
        doc.addImage(dataUrl, 'PNG', 0, 0, pdfPageW, pdfPageH, undefined, 'FAST');
        if (barcodeRect) {
            drawBarcodeOnPdf(doc, opts.barcodeValue, barcodeRect);
        }
    }

    return doc;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, product }) => {
    const [labelName, setLabelName] = useState(product?.name || '');
    const [labelPrice, setLabelPrice] = useState(product ? (product.price_retail / 100).toFixed(2) : '');
    const [showPrice, setShowPrice] = useState(true);
    const [barcodeValue, setBarcodeValue] = useState(
        product?.eans && product.eans.length > 0 ? product.eans[0] : product?.sku || ''
    );
    const [copies, setCopies] = useState<number>(1);
    const [sizeId, setSizeId] = useState<string>(() => getPreferredLabelSizeId());
    const [isGenerating, setIsGenerating] = useState(false);

    React.useEffect(() => {
        if (product) {
            setLabelName(product.name);
            setLabelPrice((product.price_retail / 100).toFixed(2));
            setBarcodeValue(product.eans && product.eans.length > 0 ? product.eans[0] : product.sku);
            setCopies(1);
        }
    }, [product]);

    const size = useMemo(
        () => LABEL_SIZES.find((s) => s.id === sizeId) || LABEL_SIZES[0],
        [sizeId]
    );

    const stockQty = product?.stock_quantity ?? 0;

    if (!isOpen || !product) return null;

    const safeCopies = Math.max(1, Math.min(MAX_COPIES, Math.floor(copies || 1)));

    const handleUseStock = () => {
        if (stockQty > 0) {
            setCopies(Math.min(MAX_COPIES, stockQty));
        }
    };

    const handleSizeChange = (nextSizeId: string) => {
        setSizeId(nextSizeId);
        try {
            localStorage.setItem(LABEL_SIZE_STORAGE_KEY, nextSizeId);
        } catch {
            // Preferencia local indisponivel; a impressao continua normalmente.
        }
    };

    const handlePrint = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        try {
            const doc = buildPdf({
                size,
                copies: safeCopies,
                labelName,
                sku: product.sku,
                showPrice,
                labelPrice,
                barcodeValue,
            });
            doc.autoPrint();
            const blobUrl = doc.output('bloburl') as unknown as string;
            const win = window.open(blobUrl, '_blank');
            if (!win) {
                // Popup bloqueado: cai no download
                doc.save(`Etiquetas_${product.sku || 'produto'}.pdf`);
            }
        } catch (err) {
            console.error('[LabelPrint] erro ao gerar PDF:', err);
            alert('Não foi possível gerar a etiqueta. Veja o console para detalhes.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Printer className="w-5 h-5 text-blue-600" />
                            Imprimir Etiqueta
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Configure os dados que sairão na impressão
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

                    <div className="w-full md:w-1/2 p-6 border-r border-slate-100 overflow-y-auto space-y-4 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-2 text-slate-700 font-semibold">
                            <Settings className="w-4 h-4" />
                            <span>Configurações da Etiqueta</span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Tamanho da Etiqueta
                            </label>
                            <select
                                value={sizeId}
                                onChange={(e) => handleSizeChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            >
                                {LABEL_SIZES.map((s) => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                Selecione o mesmo tamanho de papel na janela da impressora.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nome / Descrição
                            </label>
                            <input
                                type="text"
                                value={labelName}
                                onChange={(e) => setLabelName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Código de Barras (EAN/SKU)
                            </label>
                            <input
                                type="text"
                                value={barcodeValue}
                                onChange={(e) => setBarcodeValue(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Quantidade de Cópias
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_COPIES}
                                    value={copies}
                                    onChange={(e) => setCopies(Number(e.target.value))}
                                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleUseStock}
                                    disabled={stockQty <= 0}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={stockQty > 0 ? `Usar quantidade em estoque (${stockQty})` : 'Sem estoque disponível'}
                                >
                                    <Package className="w-4 h-4" />
                                    Estoque ({stockQty})
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Será impressa 1 etiqueta para cada cópia. Máximo {MAX_COPIES}.
                            </p>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                            <span className="text-sm font-medium text-slate-700">Imprimir Preço?</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showPrice}
                                    onChange={(e) => setShowPrice(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {showPrice && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Preço (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={labelPrice}
                                    onChange={(e) => setLabelPrice(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="w-full md:w-1/2 p-6 bg-slate-100 flex flex-col">
                        <div className="mb-4 text-sm font-medium text-slate-500 flex justify-between items-center">
                            <span>Visualização:</span>
                            <span className="text-xs px-2 py-1 bg-slate-200 rounded-md">{size.label}</span>
                        </div>

                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-white p-4 overflow-auto">
                            <div className="shadow-sm border border-slate-200">
                                <LabelContent
                                    size={size}
                                    labelName={labelName}
                                    sku={product.sku}
                                    showPrice={showPrice}
                                    labelPrice={labelPrice}
                                    barcodeValue={barcodeValue}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-3 text-center">
                            {safeCopies === 1 ? '1 etiqueta será gerada no PDF' : `${safeCopies} etiquetas serão geradas no PDF`}
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={isGenerating}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                    >
                        <Printer size={18} />
                        {isGenerating ? 'Gerando...' : 'Imprimir Agora'}
                    </button>
                </div>
            </div>
        </div>
    );
};
