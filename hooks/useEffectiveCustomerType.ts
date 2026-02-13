import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

/**
 * Get the effective customer type for pricing
 * - If admin is previewing as a different type, return the preview type
 * - Otherwise, return the actual customer type
 */
export function useEffectiveCustomerType(): 'retail' | 'resale' | 'wholesale' {
    const { customer } = useSupabaseAuth();

    // If admin, check for preview type in customer object
    if (customer?.customer_type === 'ADMIN') {
        const previewType = customer.admin_preview_type;
        if (previewType === 'retail' || previewType === 'resale' || previewType === 'wholesale') {
            return previewType;
        }
        // Default to retail if no preview type set
        return 'retail';
    }

    // Return actual customer type (default to retail)
    return (customer?.customer_type as 'retail' | 'resale' | 'wholesale') || 'retail';
}

/**
 * Get the correct price field name based on customer type
 */
export function getPriceField(customerType: 'retail' | 'resale' | 'wholesale'): 'price_retail' | 'price_reseller' | 'price_wholesale' {
    const priceFieldMap = {
        'retail': 'price_retail' as const,
        'resale': 'price_reseller' as const,
        'wholesale': 'price_wholesale' as const
    };

    return priceFieldMap[customerType];
}

/**
 * Get the price for a product based on customer type
 */
export function getProductPrice(product: any, customerType: 'retail' | 'resale' | 'wholesale'): number {
    const field = getPriceField(customerType);
    return product[field] || product.price_retail || 0;
}

/**
 * Get the effective price for a product based on current customer context
 * This function reads from the customer object in the auth context
 * Use this in components where you can't use hooks
 */
export function getEffectivePrice(product: any, customer: any): number {
    let customerType: 'retail' | 'resale' | 'wholesale' = 'retail';

    // If admin, check for preview type
    if (customer?.customer_type === 'ADMIN') {
        const previewType = customer.admin_preview_type;
        if (previewType === 'retail' || previewType === 'resale' || previewType === 'wholesale') {
            customerType = previewType;
        }
    } else if (customer?.customer_type) {
        customerType = customer.customer_type as 'retail' | 'resale' | 'wholesale';
    }

    return getProductPrice(product, customerType);
}
