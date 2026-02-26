import React, { useState, useRef } from 'react';
import { X, Printer, Settings } from 'lucide-react';
import Barcode from 'react-barcode';
import { Product } from '../../../types/product';
import { useReactToPrint } from 'react-to-print';

interface LabelPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, product }) => {
    const [labelName, setLabelName] = useState(product?.name || '');
    const [labelPrice, setLabelPrice] = useState(product ? (product.price_retail / 100).toFixed(2) : '');
    const [showPrice, setShowPrice] = useState(true);
    const [barcodeValue, setBarcodeValue] = useState(
        product?.eans && product.eans.length > 0 ? product.eans[0] : product?.sku || ''
    );

    // Atualizar os estados internos quando o produto mudar
    React.useEffect(() => {
        if (product) {
            setLabelName(product.name);
            setLabelPrice((product.price_retail / 100).toFixed(2));
            setBarcodeValue(product.eans && product.eans.length > 0 ? product.eans[0] : product.sku);
        }
    }, [product]);

    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Etiqueta_${product?.sku || 'Produto'}`,
    });

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
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

                    {/* Settings Sidebar */}
                    <div className="w-full md:w-1/2 p-6 border-r border-slate-100 overflow-y-auto space-y-4 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold">
                            <Settings className="w-4 h-4" />
                            <span>Configurações da Etiqueta</span>
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

                    {/* Preview Area */}
                    <div className="w-full md:w-1/2 p-6 bg-slate-100 flex flex-col">
                        <div className="mb-4 text-sm font-medium text-slate-500 flex justify-between items-center">
                            <span>Visualização:</span>
                            <span className="text-xs px-2 py-1 bg-slate-200 rounded-md">80mm x 40mm (Exemplo)</span>
                        </div>

                        {/* O contêiner de impressão */}
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-white p-4 overflow-hidden">
                            <div
                                className="bg-white shadow-sm border border-slate-200 flex flex-col items-center justify-center p-4"
                                style={{
                                    width: '80mm',
                                    height: '50mm',
                                    pageBreakInside: 'avoid'
                                }}
                            >
                                {/* Este bloco será impresso */}
                                <div ref={printRef} className="w-full h-full flex flex-col items-center justify-between text-center print:w-[80mm] print:h-[50mm] print:p-2 bg-white text-black">
                                    <div className="w-full text-center">
                                        <h1 className="font-bold text-xs truncate w-full" style={{ fontSize: '14px', lineHeight: '1.2' }}>Mercado do Vale</h1>
                                        <p className="font-medium text-[10px] uppercase leading-tight mt-1 line-clamp-2" style={{ fontSize: '11px', maxHeight: '24px', overflow: 'hidden' }}>{labelName || 'Sem Nome'}</p>
                                    </div>

                                    {showPrice && (
                                        <div className="font-bold my-1 flex items-start justify-center gap-1" style={{ fontSize: '24px' }}>
                                            <span style={{ fontSize: '10px', marginTop: '4px' }}>R$</span>
                                            {labelPrice ? Number(labelPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                        </div>
                                    )}

                                    {barcodeValue && (
                                        <div className="w-full flex justify-center transform scale-90 mb-1">
                                            <Barcode
                                                value={barcodeValue}
                                                format="CODE128"
                                                width={1.5}
                                                height={40}
                                                displayValue={true}
                                                fontSize={12}
                                                margin={0}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-slate-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Imprimir Agora
                    </button>
                </div>
            </div>

            {/* CSS para Impressão */}
            <style>
                {`
                @media print {
                    @page {
                        size: 80mm 50mm; /* Tamanho comum de etiqueta */
                        margin: 0;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #print-root, #print-root * {
                        visibility: visible;
                    }
                    #print-root {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                }
                `}
            </style>
        </div>
    );
};
