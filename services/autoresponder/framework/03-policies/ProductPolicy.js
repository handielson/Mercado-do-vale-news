/**
 * ProductPolicy
 * Validates product formatting rules: strict layout structure, no stock quantity exposure, and link presence validation.
 */
class ProductPolicy {
    constructor() {
        this.name = 'ProductPolicy';
    }

    validate(response, context) {
        const violations = [];
        const text = String(response || '');

        // 1. Stock quantity exposure validation
        // Regex to catch sentences like: "5 unidades em estoque", "estoque: 10", "temos 3 em estoque", "3 unidades disponíveis"
        const stockRegexes = [
            /estoque:\s*\d+/i,
            /\d+\s*(unidades|itens|aparelhos)\s+(em\s+estoque|dispon[íi]veis)/i,
            /temos\s+\d+\s*(unidades|restantes|em\s+estoque)/i,
            /quantidade\s+em\s+estoque/i
        ];

        for (const regex of stockRegexes) {
            if (regex.test(text)) {
                violations.push({
                    code: 'EXPOSED_STOCK_QUANTITY',
                    severity: 'HIGH',
                    message: 'É proibido informar a quantidade física de produtos em estoque para o cliente.'
                });
                break;
            }
        }

        // 2. Product Presentation Layout Validation
        // If the text looks like it is presenting a product, we validate the layout.
        // We detect this if it contains any product metadata emojis/headers.
        const isPresentingProduct = text.includes('📱') || text.includes('💰') || text.includes('💳') || text.includes('🎨') || text.includes('🔗');

        if (isPresentingProduct) {
            // Standard expected sequence of emojis/sections:
            // Line with 📱 Memória
            // Line with 💰 Valor PIX
            // Line with 💳 Valor Cartão
            // Line with 🎨 Cores
            // Line with 🔗 Link
            const hasMemoria = text.includes('📱') && (text.includes('Memória') || text.includes('Memoria'));
            const hasPix = text.includes('💰') && (text.includes('Valor PIX') || text.includes('Valor Pix'));
            const hasCartao = text.includes('💳') && (text.includes('Valor Cartão') || text.includes('Valor Cartao') || text.includes('Cartão'));
            const hasCores = text.includes('🎨') && (text.includes('Cores') || text.includes('Cor'));
            const hasLink = text.includes('🔗') && text.includes('Link');

            if (!hasMemoria || !hasPix || !hasCartao || !hasCores || !hasLink) {
                violations.push({
                    code: 'INVALID_PRODUCT_FORMAT',
                    severity: 'HIGH',
                    message: 'A apresentação de produto não segue o formato padrão obrigatório (Nome, 📱 Memória, 💰 Valor PIX, 💳 Valor Cartão, 🎨 Cores, 🔗 Link).'
                });
            }

            // 3. Link existence and valid URL format check (if link header exists)
            if (hasLink) {
                // Match the line that starts with 🔗 Link: and check if it contains http:// or https://
                const linkLines = text.split('\n').filter(line => line.includes('🔗'));
                const hasValidUrl = linkLines.some(line => /https?:\/\/[^\s]+/i.test(line));
                if (!hasValidUrl) {
                    violations.push({
                        code: 'INVALID_PRODUCT_LINK',
                        severity: 'HIGH',
                        message: 'O link do produto informado é inválido ou está ausente.'
                    });
                }
            }
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new ProductPolicy();
