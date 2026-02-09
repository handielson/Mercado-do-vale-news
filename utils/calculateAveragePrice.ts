/**
 * Calculate Average Price Utility
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Calculates weighted average price
 * - Used for inventory cost averaging
 * - Rounds to 2 decimal places
 */

export interface PriceCalculationInput {
    currentStock: number;
    currentPrice: number;
    newQuantity: number;
    newPrice: number;
}

export interface AveragePriceResult {
    averagePrice: number;
    totalQuantity: number;
    priceChange: number;
    percentageChange: number;
}

/**
 * Calculate weighted average price
 * 
 * Formula: (Current Stock × Current Price) + (New Quantity × New Price)
 *          ─────────────────────────────────────────────────────────
 *                      Current Stock + New Quantity
 * 
 * @param input - Current stock, prices, and new entry data
 * @returns Average price and statistics
 */
export function calculateAveragePrice(input: PriceCalculationInput): AveragePriceResult {
    const { currentStock, currentPrice, newQuantity, newPrice } = input;

    // First product - no average to calculate
    if (currentStock === 0 || currentPrice === 0) {
        return {
            averagePrice: newPrice,
            totalQuantity: newQuantity,
            priceChange: 0,
            percentageChange: 0
        };
    }

    // Calculate weighted average
    const totalValue = (currentStock * currentPrice) + (newQuantity * newPrice);
    const totalQuantity = currentStock + newQuantity;
    const averagePrice = Math.round((totalValue / totalQuantity) * 100) / 100;

    // Calculate change
    const priceChange = averagePrice - currentPrice;
    const percentageChange = currentPrice > 0
        ? Math.round(((priceChange / currentPrice) * 100) * 100) / 100
        : 0;

    return {
        averagePrice,
        totalQuantity,
        priceChange,
        percentageChange
    };
}

/**
 * Calculate average prices for all price types
 * 
 * @param currentStock - Current stock quantity
 * @param currentPrices - Current prices object
 * @param newQuantity - New entry quantity
 * @param newPrices - New entry prices object
 * @returns Object with all average prices
 */
export function calculateAllAveragePrices(
    currentStock: number,
    currentPrices: {
        price_cost: number;
        price_retail: number;
        price_reseller: number;
        price_wholesale: number;
    },
    newQuantity: number,
    newPrices: {
        price_cost: number;
        price_retail: number;
        price_reseller: number;
        price_wholesale: number;
    }
) {
    return {
        price_cost: calculateAveragePrice({
            currentStock,
            currentPrice: currentPrices.price_cost,
            newQuantity,
            newPrice: newPrices.price_cost
        }),
        price_retail: calculateAveragePrice({
            currentStock,
            currentPrice: currentPrices.price_retail,
            newQuantity,
            newPrice: newPrices.price_retail
        }),
        price_reseller: calculateAveragePrice({
            currentStock,
            currentPrice: currentPrices.price_reseller,
            newQuantity,
            newPrice: newPrices.price_reseller
        }),
        price_wholesale: calculateAveragePrice({
            currentStock,
            currentPrice: currentPrices.price_wholesale,
            newQuantity,
            newPrice: newPrices.price_wholesale
        })
    };
}
