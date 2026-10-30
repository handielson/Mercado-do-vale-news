import { ProductOrigin, type ProductInput } from '../../types/product';
import { ProductStatus } from '../../utils/field-standards';

// Model/EAN prefills and older drafts can be partial. Use the same baseline
// on first mount and reset; undefined fields must not erase that baseline.
export function buildProductFormDefaults(initialData: Partial<ProductInput> = {}, defaultIsPrint3d = false): Partial<ProductInput> {
    return {
        model_id: '',
        name: '',
        sku: '',
        status: ProductStatus.ACTIVE,
        images: [],
        specs: {},
        origin: ProductOrigin.NATIONAL,
        price_cost: 0,
        price_retail: 0,
        price_reseller: 0,
        price_wholesale: 0,
        track_inventory: true,
        stock_quantity: 0,
        is_parent: false,
        product_format: initialData.is_parent ? 'parent' : initialData.parent_id ? 'variation' : 'simple',
        is_print3d: defaultIsPrint3d,
        print3d_preorder_enabled: false,
        print3d_preorder_limit: null,
        warranty_type: 'brand',
        warranty_template_id: '',
        ...Object.fromEntries(Object.entries(initialData).filter(([, value]) => value !== undefined)),
    };
}
