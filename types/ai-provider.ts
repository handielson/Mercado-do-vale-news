/**
 * AI Provider Types
 * Defines types for AI-powered SEO content generation
 */

export type AIProvider = 'gemini' | 'grok' | 'chatgpt';

export interface AIGenerationRequest {
    provider: AIProvider;
    prompt: string;
    productData: {
        name: string;
        brand: string;
        model: string;
        category: string;
        specs: Record<string, any>;
    };
}

export interface AIGenerationResponse {
    description: string;
    slug: string;
    meta_title: string;
    meta_description: string;
    keywords: string[];
}
