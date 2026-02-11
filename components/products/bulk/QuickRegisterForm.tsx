import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Save, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PendingProduct } from '../../../types/bulk-product';
import { productService } from '../../../services/products';
import { categoryService } from '../../../services/categories';

export function QuickRegisterForm() {
    const navigate = useNavigate();
    const [ean, setEan] = useState('');
    const [serial, setSerial] = useState('');
    const [imei1, setImei1] = useState('');
    const [imei2, setImei2] = useState('');

    const [baseProduct, setBaseProduct] = useState<any>(null);
    const [categoryConfig, setCategoryConfig] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
    const [savedProducts, setSavedProducts] = useState<PendingProduct[]>([]);

    const eanRef = useRef<HTMLInputElement>(null);
    const serialRef = useRef<HTMLInputElement>(null);
    const imei1Ref = useRef<HTMLInputElement>(null);
    const imei2Ref = useRef<HTMLInputElement>(null);
    const timeoutRef1 = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef2 = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
            if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
        };
    }, []);

    // Auto-focus on EAN field when component mounts
    useEffect(() => {
        eanRef.current?.focus();
    }, []);

    // Auto-search when EAN reaches 13 digits (for barcode scanner compatibility)
    useEffect(() => {
        if (ean.length === 13 && !baseProduct && !isSearching) {
            searchByEAN(ean);
        }
    }, [ean]);

    // Auto-advance when IMEI1 reaches 15 digits
    useEffect(() => {
        if (imei1.length === 15 && baseProduct) {
            // Move to IMEI2
            if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
            timeoutRef1.current = setTimeout(() => {
                imei2Ref.current?.focus();
                timeoutRef1.current = null;
            }, 50);
        }
    }, [imei1]);

    // Auto-add to queue when IMEI2 reaches 15 digits and focus on Serial for next unit
    useEffect(() => {
        if (imei2.length === 15 && baseProduct && serial) {
            // Add current product to queue
            addToQueue();
        }
    }, [imei2]);

    // Search product by EAN
    const searchByEAN = async (eanValue: string) => {
        if (eanValue.length !== 13) return;

        setIsSearching(true);
        try {
            const products = await productService.searchByEAN(eanValue);

            if (products.length === 0) {
                const goToRegister = confirm(
                    '⚠️ Produto não encontrado com este EAN.\n\n' +
                    'Para usar o cadastro em lote, você precisa cadastrar pelo menos 1 produto com este EAN primeiro.\n\n' +
                    'Deseja ir para a página de cadastro de produto?'
                );

                if (goToRegister) {
                    // Redirect to product registration with EAN pre-filled
                    navigate('/admin/products/new', { state: { ean: eanValue } });
                } else {
                    setEan('');
                    eanRef.current?.focus();
                }

                setIsSearching(false);
                return;
            }

            const product = products[0];
            setBaseProduct(product);

            // Load category configuration
            if (product.category_id) {
                const category = await categoryService.getById(product.category_id);
                setCategoryConfig(category);
            }

            // Focus on first unique field (Serial)
            if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
            timeoutRef2.current = setTimeout(() => {
                serialRef.current?.focus();
                timeoutRef2.current = null;
            }, 100);
        } catch (error) {
            alert('Erro ao buscar produto');
            setBaseProduct(null);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle EAN input
    const handleEANKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchByEAN(ean);
        }
    };

    // Handle Serial input
    const handleSerialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            // Check if category requires IMEI fields
            const hasIMEI = categoryConfig?.name?.toLowerCase().includes('celular') ||
                categoryConfig?.name?.toLowerCase().includes('smartphone');

            if (hasIMEI) {
                imei1Ref.current?.focus();
            } else {
                // No IMEI needed, add to queue
                addToQueue();
            }
        }
    };

    // Handle IMEI 1 input
    const handleIMEI1KeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            imei2Ref.current?.focus();
        }
    };

    // Handle IMEI 2 input
    const handleIMEI2KeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addToQueue();
        }
    };

    // Add product to queue
    const addToQueue = () => {
        if (!baseProduct) {
            alert('Nenhum produto base encontrado');
            return;
        }

        if (!serial.trim()) {
            alert('Serial é obrigatório');
            serialRef.current?.focus();
            return;
        }

        const newProduct: PendingProduct = {
            id: Date.now().toString(),
            ean,
            baseProductName: baseProduct.name || 'Produto',
            baseProductImage: baseProduct.images?.[0],
            uniqueFields: {
                serial: serial.trim(),
                ...(imei1 && { imei1: imei1.trim() }),
                ...(imei2 && { imei2: imei2.trim() })
            },
            timestamp: Date.now()
        };

        setPendingProducts(prev => [...prev, newProduct]);

        // Clear unique fields only, keep product and focus on Serial for next unit
        clearForm(true);
    };

    // Clear form
    const clearForm = (keepProduct = false) => {
        setSerial('');
        setImei1('');
        setImei2('');

        if (!keepProduct) {
            setEan('');
            setBaseProduct(null);
            setCategoryConfig(null);
            eanRef.current?.focus();
        } else {
            // Keep product, focus on Serial for next unit
            serialRef.current?.focus();
        }
    };

    // Remove product from queue
    const removeFromQueue = (id: string) => {
        setPendingProducts(prev => prev.filter(p => p.id !== id));
    };

    // Clear entire queue
    const clearQueue = () => {
        if (confirm('Deseja limpar toda a fila?')) {
            setPendingProducts([]);
        }
    };

    // Save all products in queue
    const saveAll = async () => {
        if (pendingProducts.length === 0) {
            alert('Nenhum produto na fila');
            return;
        }

        if (!confirm(`Salvar ${pendingProducts.length} produto(s)?`)) {
            return;
        }

        setIsSaving(true);
        let successCount = 0;
        const errors: string[] = [];

        for (const pending of pendingProducts) {
            try {
                // Create product with base data + unique fields
                const productData = {
                    ...baseProduct,
                    ...pending.uniqueFields,
                    id: undefined, // Remove ID to create new
                    stock_quantity: 1 // Each unit is 1 item
                };

                await productService.create(productData);
                successCount++;
                setSavedProducts(prev => [...prev, pending]);
            } catch (error) {
                errors.push(`Serial ${pending.uniqueFields.serial}: ${error}`);
            }
        }

        setIsSaving(false);

        // Clear queue
        setPendingProducts([]);

        // Show result
        if (errors.length > 0) {
            alert(`✅ ${successCount} salvos\n❌ ${errors.length} erros:\n${errors.join('\n')}`);
        } else {
            alert(`✅ ${successCount} produto(s) salvos com sucesso!`);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveAll();
            }
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                if (pendingProducts.length > 0) {
                    removeFromQueue(pendingProducts[pendingProducts.length - 1].id);
                }
            }
            if (e.key === 'Escape') {
                clearForm();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pendingProducts]);

    const hasIMEI = categoryConfig?.name?.toLowerCase().includes('celular') ||
        categoryConfig?.name?.toLowerCase().includes('smartphone');

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">⚡ Cadastro Rápido com Scanner</h2>
                <div className="text-sm text-slate-600">
                    📊 Fila: <span className="font-semibold text-blue-600">{pendingProducts.length}</span> |
                    ✅ Salvos: <span className="font-semibold text-green-600">{savedProducts.length}</span>
                </div>
            </div>

            {/* EAN Input */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    🔍 Código de Barras (EAN)
                </label>
                <div className="relative">
                    <input
                        ref={eanRef}
                        type="text"
                        value={ean}
                        onChange={(e) => setEan(e.target.value)}
                        onKeyDown={handleEANKeyDown}
                        placeholder="Escaneie o código de barras..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        maxLength={13}
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-3 animate-spin text-blue-500" size={20} />
                    )}
                </div>
            </div>

            {/* Product Preview */}
            {baseProduct && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-green-800 mb-2">✅ Produto Encontrado:</p>
                    <div className="flex items-center gap-4">
                        {baseProduct.images?.[0] && (
                            <img
                                src={baseProduct.images[0]}
                                alt={baseProduct.name}
                                className="w-16 h-16 object-cover rounded-lg border border-green-300"
                            />
                        )}
                        <div>
                            <p className="font-semibold text-slate-800">{baseProduct.name}</p>
                            <p className="text-sm text-slate-600">
                                💰 R$ {baseProduct.price_retail?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-sm text-slate-500">
                                📦 {categoryConfig?.name || 'Categoria'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Unique Fields */}
            {baseProduct && (
                <div className="space-y-4">
                    <p className="text-sm font-medium text-slate-700">
                        📝 Sequência: Serial {hasIMEI && '→ IMEI 1 → IMEI 2'}
                    </p>

                    {/* Serial */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            1️⃣ Serial *
                        </label>
                        <input
                            ref={serialRef}
                            type="text"
                            value={serial}
                            onChange={(e) => setSerial(e.target.value)}
                            onKeyDown={handleSerialKeyDown}
                            placeholder="Escaneie o serial..."
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* IMEI 1 */}
                    {hasIMEI && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                2️⃣ IMEI 1 *
                            </label>
                            <input
                                ref={imei1Ref}
                                type="text"
                                value={imei1}
                                onChange={(e) => setImei1(e.target.value)}
                                onKeyDown={handleIMEI1KeyDown}
                                placeholder="Escaneie o IMEI 1..."
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                maxLength={15}
                            />
                        </div>
                    )}

                    {/* IMEI 2 */}
                    {hasIMEI && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                3️⃣ IMEI 2
                            </label>
                            <input
                                ref={imei2Ref}
                                type="text"
                                value={imei2}
                                onChange={(e) => setImei2(e.target.value)}
                                onKeyDown={handleIMEI2KeyDown}
                                placeholder="Escaneie o IMEI 2 (opcional)..."
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                maxLength={15}
                            />
                        </div>
                    )}

                    <p className="text-sm text-slate-500">
                        💡 Escaneie e pressione Enter para avançar
                        <br />
                        ⚡ Último campo adiciona à fila automaticamente!
                    </p>
                </div>
            )}

            {/* Pending Products Queue */}
            {pendingProducts.length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800">📋 Produtos Pendentes ({pendingProducts.length})</h3>
                        <button
                            onClick={clearQueue}
                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                            <Trash2 size={14} />
                            Limpar Fila
                        </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {pendingProducts.map((product, index) => (
                            <div key={product.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-amber-700">#{pendingProducts.length - index}</span>
                                    {product.baseProductImage && (
                                        <img src={product.baseProductImage} alt="" className="w-10 h-10 object-cover rounded" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{product.baseProductName}</p>
                                        <p className="text-xs text-slate-600">
                                            S: {product.uniqueFields.serial}
                                            {product.uniqueFields.imei1 && ` | I1: ${product.uniqueFields.imei1.substring(0, 6)}...`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFromQueue(product.id)}
                                    className="text-red-600 hover:text-red-700 p-1"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={clearQueue}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} />
                            Limpar Fila
                        </button>
                        <button
                            onClick={saveAll}
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Salvar Todos ({pendingProducts.length})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
