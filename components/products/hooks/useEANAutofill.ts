import { useState, useEffect, useRef } from 'react';
import { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Product, ProductInput } from '../../../types/product';

interface UseEANAutofillProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    initialData?: Product;
}

interface UseEANAutofillReturn {
    isSearchingEAN: boolean;
    eanSearchMessage: string;
    isDuplicateEAN: boolean;
    existingProduct: Product | null;
    searchByEAN: () => Promise<void>;
}

/**
 * Hook for EAN-based product search and autofill
 * Handles duplicate detection and automatic field population based on category config
 * 
 * PERFORMANCE FIX:
 * - Added cleanup for setTimeout to prevent memory leaks
 */
export function useEANAutofill({
    watch,
    setValue,
    initialData
}: UseEANAutofillProps): UseEANAutofillReturn {
    const [isSearchingEAN, setIsSearchingEAN] = useState(false);
    const [eanSearchMessage, setEANSearchMessage] = useState('');
    const [isDuplicateEAN, setIsDuplicateEAN] = useState(false);
    const [existingProduct, setExistingProduct] = useState<Product | null>(null);

    // Refs to track timeouts for cleanup
    const timeoutRef1 = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef2 = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef3 = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
            if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
            if (timeoutRef3.current) clearTimeout(timeoutRef3.current);
        };
    }, []);

    const searchByEAN = async () => {
        const eans = watch('eans');
        if (!eans || eans.length === 0 || !eans[0]) {
            setEANSearchMessage('');
            setIsDuplicateEAN(false);
            setExistingProduct(null);
            return;
        }

        const firstEAN = eans[0].trim();

        // Only search when EAN is complete (13 digits)
        if (firstEAN.length !== 13) {
            setEANSearchMessage('');
            setIsDuplicateEAN(false);
            setExistingProduct(null);
            return;
        }

        // Don't search if we're editing an existing product
        if (initialData?.id) {
            return;
        }

        setIsSearchingEAN(true);
        setEANSearchMessage('🔍 Buscando produto...');

        try {
            const { productService } = await import('../../../services/products');
            const { categoryService } = await import('../../../services/categories');
            const foundProduct = await productService.getByEan(firstEAN);

            if (foundProduct) {
                // Get category configuration
                const category = await categoryService.getById(foundProduct.category_id);
                const autoFillConfig = category?.config?.ean_autofill_config;
                const autoFillEnabled = autoFillConfig?.enabled ?? true;
                const excludedFields = autoFillConfig?.exclude_fields || [];

                console.log('🔍 [EAN Autofill] Found product:', foundProduct.name);
                console.log('⚙️ [EAN Autofill] Config:', { autoFillEnabled, excludedFields });

                // SEMPRE bloqueia criação de produto duplicado
                setIsDuplicateEAN(true);
                setExistingProduct(foundProduct);
                setEANSearchMessage('⚠️ Código de barras já cadastrado neste produto!');

                // AUTO-FILL: Preencher campos se habilitado
                if (autoFillEnabled) {
                    console.log('✅ [EAN Autofill] Autofill ENABLED - filling fields...');

                    // Helper function to check if field should be filled
                    const shouldFill = (fieldName: string) => {
                        const isExcluded = excludedFields.includes(fieldName);
                        console.log(`  ${isExcluded ? '❌' : '✅'} ${fieldName}: ${isExcluded ? 'EXCLUDED' : 'filling'}`);
                        return !isExcluded;
                    };
                    const hasValue = (value: unknown) => {
                        if (Array.isArray(value)) return value.length > 0;
                        if (typeof value === 'number') return value > 0;
                        if (typeof value === 'string') return value.trim().length > 0;
                        return value !== null && value !== undefined;
                    };
                    const shouldFillEmpty = (fieldName: string) => (
                        shouldFill(fieldName) && !hasValue(watch(fieldName as any))
                    );

                    // Fill basic fields
                    if (shouldFillEmpty('category_id')) setValue('category_id', foundProduct.category_id);
                    if (shouldFillEmpty('brand') && foundProduct.brand) setValue('brand', foundProduct.brand);
                    if (shouldFillEmpty('model') && foundProduct.model) setValue('model', foundProduct.model);
                    if (shouldFillEmpty('name')) setValue('name', foundProduct.model || foundProduct.name);
                    if (shouldFillEmpty('description') && foundProduct.description) setValue('description', foundProduct.description);

                    // Fill specs (check with specs. prefix)
                    if (foundProduct.specs) {
                        if (shouldFillEmpty('specs.color') && foundProduct.specs.color) setValue('specs.color', foundProduct.specs.color);
                        if (shouldFillEmpty('specs.storage') && foundProduct.specs.storage) setValue('specs.storage', foundProduct.specs.storage);
                        if (shouldFillEmpty('specs.ram') && foundProduct.specs.ram) setValue('specs.ram', foundProduct.specs.ram);
                        if (shouldFillEmpty('specs.version') && foundProduct.specs.version) setValue('specs.version', foundProduct.specs.version);
                        if (shouldFillEmpty('specs.battery_health') && foundProduct.specs.battery_health) setValue('specs.battery_health', foundProduct.specs.battery_health);

                        // Fill custom fields
                        Object.keys(foundProduct.specs).forEach(key => {
                            if (!['color', 'storage', 'ram', 'version', 'battery_health', 'imei1', 'imei2', 'serial'].includes(key)) {
                                if (shouldFillEmpty(`specs.${key}`)) {
                                    setValue(`specs.${key}`, foundProduct.specs[key]);
                                }
                            }
                        });
                    }

                    // Fill prices
                    if (shouldFillEmpty('price_cost') && foundProduct.price_cost) setValue('price_cost', foundProduct.price_cost);
                    if (shouldFillEmpty('price_retail') && foundProduct.price_retail) setValue('price_retail', foundProduct.price_retail);
                    if (shouldFillEmpty('price_reseller') && foundProduct.price_reseller) setValue('price_reseller', foundProduct.price_reseller);
                    if (shouldFillEmpty('price_wholesale') && foundProduct.price_wholesale) setValue('price_wholesale', foundProduct.price_wholesale);

                    // Fill images if configured to reuse
                    const hasProductIdentity = hasValue(watch('model_id')) || hasValue(watch('model')) || hasValue(watch('specs.color' as any));
                    if (shouldFillEmpty('images') && !hasProductIdentity && foundProduct.images && foundProduct.images.length > 0) {
                        setValue('images', foundProduct.images);
                        console.log('📸 [EAN Autofill] Images reused:', foundProduct.images.length);
                    }

                    setEANSearchMessage('✨ Campos preenchidos automaticamente (respeitando exclusões)');

                    // Clear previous timeout to prevent accumulation
                    if (timeoutRef1.current) clearTimeout(timeoutRef1.current);
                    timeoutRef1.current = setTimeout(() => {
                        setEANSearchMessage('⚠️ Código de barras já cadastrado!');
                        timeoutRef1.current = null;
                    }, 2000);
                } else {
                    console.log('❌ [EAN Autofill] Autofill DISABLED');
                }
            } else {
                // EAN NOVO - Permitir criação
                setIsDuplicateEAN(false);
                setExistingProduct(null);
                setEANSearchMessage('ℹ️ Produto novo - preencha os dados');

                // Clear previous timeout to prevent accumulation
                if (timeoutRef2.current) clearTimeout(timeoutRef2.current);
                timeoutRef2.current = setTimeout(() => {
                    setEANSearchMessage('');
                    timeoutRef2.current = null;
                }, 3000);
            }
        } catch (error) {
            console.error('Error searching by EAN:', error);
            setEANSearchMessage('⚠️ Erro ao buscar produto');

            // Clear previous timeout to prevent accumulation
            if (timeoutRef3.current) clearTimeout(timeoutRef3.current);
            timeoutRef3.current = setTimeout(() => {
                setEANSearchMessage('');
                timeoutRef3.current = null;
            }, 3000);
        } finally {
            setIsSearchingEAN(false);
        }
    };

    return {
        isSearchingEAN,
        eanSearchMessage,
        isDuplicateEAN,
        existingProduct,
        searchByEAN
    };
}
