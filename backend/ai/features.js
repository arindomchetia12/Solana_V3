export function getMarketFeatures(priceNow, priceBefore) {
    const volatility = Math.abs(priceNow - priceBefore) / priceBefore;
    return { volatility };
}