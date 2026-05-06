import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Settings, Package } from 'lucide-react';
import Barcode from 'react-barcode';
import { Product } from '../../types/product';
import { useReactToPrint } from 'react-to-print';

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
const LABEL_SIZES: LabelSize[] = [
    { id: '40x30',  label: '40 × 30 mm  (P50S padrão)', width: 40, height: 30, fontStore: 9,  fontName: 7,  fontPrice: 13, fontPriceCurrency: 6,  barcodeWidth: 0.9, barcodeHeight: 18, barcodeFont: 8,  padding: 1 },
    { id: '50x30',  label: '50 × 30 mm  (P50S)',        width: 50, height: 30, fontStore: 10, fontName: 8,  fontPrice: 14, fontPriceCurrency: 7,  barcodeWidth: 1.0, barcodeHeight: 20, barcodeFont: 9,  padding: 1 },
    { id: '30x40',  label: '30 × 40 mm  (P50S)',        width: 30, height: 40, fontStore: 8,  fontName: 7,  fontPrice: 12, fontPriceCurrency: 6,  barcodeWidth: 0.8, barcodeHeight: 24, barcodeFont: 7,  padding: 0.8 },
    { id: '40x25',  label: '40 × 25 mm  (P50S)',        width: 40, height: 25, fontStore: 8,  fontName: 7,  fontPrice: 12, fontPriceCurrency: 6,  barcodeWidth: 0.9, barcodeHeight: 14, barcodeFont: 7,  padding: 0.8 },
    { id: '30x20',  label: '30 × 20 mm  (P50S)',        width: 30, height: 20, fontStore: 7,  fontName: 6,  fontPrice: 10, fontPriceCurrency: 5,  barcodeWidth: 0.55, barcodeHeight: 10, barcodeFont: 6, padding: 0.5 },
    { id: '60x40',  label: '60 × 40 mm',                width: 60, height: 40, fontStore: 11, fontName: 9,  fontPrice: 18, fontPriceCurrency: 8,  barcodeWidth: 1.2, barcodeHeight: 26, barcodeFont: 10, padding: 1.5 },
    { id: '80x40',  label: '80 × 40 mm',                width: 80, height: 40, fontStore: 13, fontName: 10, fontPrice: 22, fontPriceCurrency: 9,  barcodeWidth: 1.5, barcodeHeight: 30, barcodeFont: 11, padding: 1.5 },
    { id: '80x50',  label: '80 × 50 mm',                width: 80, height: 50, fontStore: 14, fontName: 11, fontPrice: 24, fontPriceCurrency: 10, barcodeWidth: 1.6, barcodeHeight: 40, barcodeFont: 12, padding: 2 },
];

const MAX_COPIES = 500;

interface LabelContentProps {
    size: LabelSize;
    storeName: string;
    labelName: string;
    showPrice: boolean;
    labelPrice: string;
    barcodeValue: string;
}

const LabelContent: React.FC<LabelContentProps> = ({ size, storeName, labelName, showPrice, labelPrice, barcodeValue }) => (
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
        }}
    >
        <div style={{ width: '100%' }}>
            <div style={{ fontSize: `${size.fontStore}px`, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {storeName}
            </div>
            <div
                style={{
                    fontSize: `${size.fontName}px`,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    lineHeight: 1.1,
                    marginTop: '1px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {labelName || 'Sem Nome'}
            </div>
        </div>

        {showPrice && (
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2px', fontSize: `${size.fontPrice}px`, lineHeight: 1 }}>
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

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, product }) => {
    const [labelName, setLabelName] = useState(product?.name || '');
    const [labelPrice, setLabelPrice] = useState(product ? (product.price_retail / 100).toFixed(2) : '');
    const [showPrice, setShowPrice] = useState(true);
    const [barcodeValue, setBarcodeValue] = useState(
        product?.eans && product.eans.length > 0 ? product.eans[0] : product?.sku || ''
    );
    const [copies, setCopies] = useState<number>(1);
    const [sizeId, setSizeId] = useState<string>(LABEL_SIZES[0].id);

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

    const printRef = useRef<HTMLDivElement>(null);

    const pageStyle = useMemo(
        () => `
            @page {
                size: ${size.width}mm ${size.height}mm;
                margin: 0;
            }
            @media print {
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    width: ${size.width}mm;
                    height: ${size.height}mm;
                }
            }
        `,
        [size]
    );

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Etiqueta_${product?.sku || 'Produto'}`,
        pageStyle,
    });

    if (!isOpen || !product) return null;

    const safeCopies = Math.max(1, Math.min(MAX_COPIES, Math.floor(copies || 1)));

    const handleUseStock = () => {
        if (stockQty > 0) {
            setCopies(Math.min(MAX_COPIES, stockQty));
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
                                onChange={(e) => setSizeId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            >
                                {LABEL_SIZES.map((s) => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                Defina o mesmo tamanho de papel na janela de impressão.
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
                                    storeName="Mercado do Vale"
                                    labelName={labelName}
                                    showPrice={showPrice}
                                    labelPrice={labelPrice}
                                    barcodeValue={barcodeValue}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-3 text-center">
                            {safeCopies === 1 ? '1 etiqueta será impressa' : `${safeCopies} etiquetas serão impressas`}
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
                        onClick={() => handlePrint()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Imprimir Agora
                    </button>
                </div>
            </div>

            {/* Print source rendered in a portal at body level to avoid modal style inheritance */}
            {createPortal(
                <div
                    style={{
                        position: 'absolute',
                        left: '-9999px',
                        top: 0,
                        background: '#fff',
                        width: `${size.width}mm`,
                    }}
                    aria-hidden="true"
                >
                    <div ref={printRef}>
                        {Array.from({ length: safeCopies }).map((_, i) => (
                            <div
                                key={i}
                                style={{
                                    width: `${size.width}mm`,
                                    height: `${size.height}mm`,
                                    overflow: 'hidden',
                                    pageBreakAfter: i < safeCopies - 1 ? 'always' : 'auto',
                                    breakAfter: i < safeCopies - 1 ? 'page' : 'auto',
                                }}
                            >
                                <LabelContent
                                    size={size}
                                    storeName="Mercado do Vale"
                                    labelName={labelName}
                                    showPrice={showPrice}
                                    labelPrice={labelPrice}
                                    barcodeValue={barcodeValue}
                                />
                            </div>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
