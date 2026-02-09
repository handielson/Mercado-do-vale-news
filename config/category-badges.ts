/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CONFIGURAÇÃO DE BADGES DO CATÁLOGO
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo controla quais badges aparecem nos cards de produtos.
 * 
 * 📍 COMO USAR:
 * 1. Localize a categoria desejada (ex: 'celulares', 'notebooks')
 * 2. Adicione ou remova badges no array da categoria
 * 3. Salve o arquivo - o HMR atualizará automaticamente
 * 
 * 📝 ESTRUTURA DE UM BADGE:
 * {
 *   spec: 'nome_do_campo',           // Campo em product.specs (ex: 'nfc', '5g')
 *   value: 'Sim',                    // Valor esperado para mostrar o badge
 *   label: 'Texto do Badge',         // Texto exibido no badge
 *   icon: '📡',                      // Emoji (opcional)
 *   color: 'from-blue-500 to-cyan-500'  // Gradiente Tailwind
 * }
 * 
 * 🎨 CORES DISPONÍVEIS:
 * - Azul/Ciano: 'from-blue-500 to-cyan-500'
 * - Roxo/Índigo: 'from-purple-500 to-indigo-500'
 * - Laranja/Vermelho: 'from-orange-500 to-red-500'
 * - Verde/Esmeralda: 'from-green-500 to-emerald-500'
 * - Amarelo/Âmbar: 'from-yellow-500 to-amber-500'
 * - Rosa/Pink: 'from-pink-500 to-rose-500'
 * 
 * 📖 Documentação completa: config/README.md
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface BadgeConfig {
    spec: string;           // Field name in product.specs (e.g., 'nfc', '5g', 'dual_sim')
    value: string | boolean; // Expected value to show badge (e.g., 'Sim', true)
    label: string;          // Badge text (e.g., 'NFC', '5G')
    icon?: string;          // Optional emoji icon
    color: string;          // Tailwind gradient class (e.g., 'from-blue-500 to-cyan-500')
}

export const CATEGORY_BADGES: Record<string, BadgeConfig[]> = {
    // Celulares / Smartphones
    'celulares': [
        {
            spec: 'nfc',
            value: 'Sim',
            label: 'NFC',
            icon: '📡',
            color: 'from-blue-500 to-cyan-500'
        },
        {
            spec: '5g',
            value: 'Sim',
            label: '5G',
            icon: '📶',
            color: 'from-purple-500 to-indigo-500'
        },
        {
            spec: 'dual_sim',
            value: 'Sim',
            label: 'Dual SIM',
            icon: '📱',
            color: 'from-orange-500 to-red-500'
        },
        {
            spec: 'wireless_charging',
            value: 'Sim',
            label: 'Carregamento Sem Fio',
            icon: '⚡',
            color: 'from-yellow-500 to-amber-500'
        },
        {
            spec: 'water_resistant',
            value: 'Sim',
            label: 'Resistente à Água',
            icon: '💧',
            color: 'from-cyan-500 to-blue-600'
        }
    ],

    // Notebooks / Laptops
    'notebooks': [
        {
            spec: 'touchscreen',
            value: 'Sim',
            label: 'Touchscreen',
            icon: '👆',
            color: 'from-purple-500 to-pink-500'
        },
        {
            spec: 'backlit_keyboard',
            value: 'Sim',
            label: 'Teclado Retroiluminado',
            icon: '⌨️',
            color: 'from-indigo-500 to-purple-500'
        },
        {
            spec: 'ssd',
            value: 'Sim',
            label: 'SSD',
            icon: '💾',
            color: 'from-green-500 to-emerald-500'
        }
    ],

    // Tablets
    'tablets': [
        {
            spec: 'stylus_support',
            value: 'Sim',
            label: 'Suporte a Caneta',
            icon: '✏️',
            color: 'from-pink-500 to-rose-500'
        },
        {
            spec: 'keyboard_support',
            value: 'Sim',
            label: 'Teclado Compatível',
            icon: '⌨️',
            color: 'from-blue-500 to-indigo-500'
        }
    ],

    // Smartwatches
    'smartwatches': [
        {
            spec: 'gps',
            value: 'Sim',
            label: 'GPS',
            icon: '🗺️',
            color: 'from-green-500 to-teal-500'
        },
        {
            spec: 'heart_rate_monitor',
            value: 'Sim',
            label: 'Monitor Cardíaco',
            icon: '❤️',
            color: 'from-red-500 to-pink-500'
        },
        {
            spec: 'waterproof',
            value: 'Sim',
            label: 'À Prova d\'Água',
            icon: '💧',
            color: 'from-cyan-500 to-blue-500'
        }
    ]
};

/**
 * Get badge configurations for a specific category
 */
export function getBadgesForCategory(categorySlug: string): BadgeConfig[] {
    return CATEGORY_BADGES[categorySlug] || [];
}

/**
 * Check if a product should display a specific badge
 */
export function shouldShowBadge(
    product: { specs?: Record<string, any> },
    badge: BadgeConfig
): boolean {
    if (!product.specs) return false;

    const specValue = product.specs[badge.spec];

    // Handle different value types
    if (typeof badge.value === 'boolean') {
        return specValue === badge.value;
    }

    return specValue === badge.value;
}
