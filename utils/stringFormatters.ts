/**
 * Converte uma string para o formato Title Case (Primeiras Letras Maiúsculas),
 * mantendo o padrão semântico do pt-BR para SEO e tratamento especial para marcas/siglas.
 */
export function toTitleCase(str: string | undefined): string {
    if (!str) return '';
    
    // Lista de preposições que devem continuar minúsculas (a menos que seja a primeira palavra)
    const exceptions = ['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'no', 'na', 'nos', 'nas', 'e', 'ou', 'por', 'p/', 'c/'];
    
    // Siglas que devem ficar 100% maiúsculas
    const uppercaseAcronyms = ['gb', 'tb', 'mb', 'hd', 'tv', 'usb', 'nfc', 'led', 'lcd', 'oled', 'amoled', 'wi-fi', 'wifi', '4g', '5g', '3g', 'ram', 'rom', 'sku', 'cpu'];
    
    // Palavras com case específico (marcas e afins)
    const exactCaseWord: Record<string, string> = {
        'iphone': 'iPhone',
        'ipad': 'iPad',
        'imac': 'iMac',
        'macbook': 'MacBook',
        'xiaomi': 'Xiaomi',
        'samsung': 'Samsung',
        'motorola': 'Motorola',
        'realme': 'Realme',
        'poco': 'Poco',
        'redmi': 'Redmi'
    };

    return str.toLowerCase().replace(/[a-zA-ZÀ-ÖØ-öø-ÿ0-9]\S*/g, (txt, offset) => {
        const lowerTxt = txt.toLowerCase();
        
        // Separa possível pontuação colada à palavra (ex: "128GB)")
        const match = lowerTxt.match(/^([^.,/#!$%^&*;:{}=\-_`~()]+)(.*)$/);
        const cleanWord = match ? match[1] : lowerTxt;
        const punctuation = match ? match[2] : '';

        // Exceções conhecidas de marcas
        if (exactCaseWord[cleanWord]) {
            return exactCaseWord[cleanWord] + punctuation;
        }
        
        // Siglas exatas
        if (uppercaseAcronyms.includes(cleanWord)) {
            return cleanWord.toUpperCase() + punctuation;
        }
        
        // Formatos mistos (ex: 128gb -> 128GB, 5g -> 5G, 5000mah -> 5000mAh)
        if (/^\d+(gb|tb|mb|g|hz|w)$/.test(cleanWord)) {
            return cleanWord.toUpperCase() + punctuation;
        }
        if (/^\d+(mah)$/.test(cleanWord)) {
            return cleanWord.replace('mah', 'mAh') + punctuation;
        }
        
        // Preposições
        if (offset > 0 && exceptions.includes(cleanWord)) {
            return txt.toLowerCase();
        }
        
        // Padrão: Capitaliza primeira letra
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
}
