import { useState } from 'react';
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

                    // Fill basic fields
                    if (shouldFill('category_id')) setValue('category_id', foundProduct.category_id);
                    if (shouldFill('brand') && foundProduct.brand) setValue('brand', foundProduct.brand);
                    if (shouldFill('model') && foundProduct.model) setValue('model', foundProduct.model);
                    if (shouldFill('name')) setValue('name', foundProduct.name);
                    if (shouldFill('description') && foundProduct.description) setValue('description', foundProduct.description);

                    // Fill specs (check with specs. prefix)
                    if (foundProduct.specs) {
                        if (shouldFill('specs.color') && foundProduct.specs.color) setValue('specs.color', foundProduct.specs.color);
                        if (shouldFill('specs.storage') && foundProduct.specs.storage) setValue('specs.storage', foundProduct.specs.storage);
                        if (shouldFill('specs.ram') && foundProduct.specs.ram) setValue('specs.ram', foundProduct.specs.ram);
                        if (shouldFill('specs.version') && foundProduct.specs.version) setValue('specs.version', foundProduct.specs.version);
                        if (shouldFill('specs.battery_health') && foundProduct.specs.battery_health) setValue('specs.battery_health', foundProduct.specs.battery_health);

                        // Fill custom fields
                        Object.keys(foundProduct.specs).forEach(key => {
                            if (!['color', 'storage', 'ram', 'version', 'battery_health', 'imei1', 'imei2', 'serial'].includes(key)) {
                                if (shouldFill(`specs.${key}`)) {
                                    setValue(`specs.${key}`, foundProduct.specs[key]);
                                }
                            }
                        });
                    }

                    // Fill prices
                    if (shouldFill('price_cost') && foundProduct.price_cost) setValue('price_cost', foundProduct.price_cost);
                    if (shouldFill('price_retail') && foundProduct.price_retail) setValue('price_retail', foundProduct.price_retail);
                    if (shouldFill('price_reseller') && foundProduct.price_reseller) setValue('price_reseller', foundProduct.price_reseller);
                    if (shouldFill('price_wholesale') && foundProduct.price_wholesale) setValue('price_wholesale', foundProduct.price_wholesale);

                    // Fill images if configured to reuse
                    if (shouldFill('images') && foundProduct.images && foundProduct.images.length > 0) {
                        setValue('images', foundProduct.images);
                        console.log('📸 [EAN Autofill] Images reused:', foundProduct.images.length);
                    }

                    setEANSearchMessage('✨ Campos preenchidos automaticamente (respeitando exclusões)');
                    setTimeout(() => setEANSearchMessage('⚠️ Código de barras já cadastrado!'), 2000);
                } else {
                    console.log('❌ [EAN Autofill] Autofill DISABLED');
                }
            } else {
                // EAN NOVO - Permitir criação
                setIsDuplicateEAN(false);
                setExistingProduct(null);
                setEANSearchMessage('ℹ️ Produto novo - preencha os dados');
                setTimeout(() => setEANSearchMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error searching by EAN:', error);
            setEANSearchMessage('⚠️ Erro ao buscar produto');
            setTimeout(() => setEANSearchMessage(''), 3000);
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
