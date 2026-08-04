import { vpsClient } from './vpsClient';

export type CampaignBudgetType = 'daily' | 'lifetime';
export type CampaignObjective = 'sales';
export type CampaignDestination = 'whatsapp';

export interface MarketingCampaignBlueprint {
    id: 'store-carousel' | 'smartphones';
    name: string;
    scope: 'full_store' | 'smartphones';
    format: string;
    cities: string[];
    strategy: string;
    strategyReason: string;
    objective: CampaignObjective;
    destination: CampaignDestination;
    budgetType: CampaignBudgetType;
    authorizedAmount: number | null;
    durationDays: number;
    reviewAfterDays: number;
    whatsappMessageTemplate: string;
    botInstruction: string;
    status: 'draft' | 'budget_configured';
}

export interface MarketingCampaignPortfolio {
    campaigns: MarketingCampaignBlueprint[];
    updatedAt: string | null;
}

type PreferenceResponse = {
    key: string;
    value: MarketingCampaignPortfolio | null;
};

const PREFERENCE_KEY = 'marketing.instagram.campaign_portfolio';
const FIXED_CITIES = ['Petrolina–PE', 'Juazeiro–BA'];

export const DEFAULT_MARKETING_CAMPAIGN_PORTFOLIO: MarketingCampaignPortfolio = {
    campaigns: [
        {
            id: 'store-carousel',
            name: 'Loja inteira — Carrossel',
            scope: 'full_store',
            format: 'Carrossel de produtos',
            cities: FIXED_CITIES,
            strategy: 'Aleatoriedade controlada entre produtos elegíveis',
            strategyReason: 'Mantém variedade sem gastar com item sem estoque, imagem ruim, preço desatualizado ou repetição recente.',
            objective: 'sales',
            destination: 'whatsapp',
            budgetType: 'daily',
            authorizedAmount: null,
            durationDays: 7,
            reviewAfterDays: 7,
            whatsappMessageTemplate: 'Quero comprar: {nome_produto} | Codigo: {sku}',
            botInstruction: 'A mensagem deve trazer nome e SKU do produto. O bot confirma o item e oferece poucas opcoes numeradas apenas quando houver ambiguidade.',
            status: 'draft',
        },
        {
            id: 'smartphones',
            name: 'Somente Smartphones',
            scope: 'smartphones',
            format: 'Carrossel ou vídeo curto após auditoria dos ativos',
            cities: FIXED_CITIES,
            strategy: 'Rotação por estoque, procura, margem, novidade e qualidade visual',
            strategyReason: 'Isola a categoria de maior intenção e permite medir oferta e criativo sem misturar acessórios ou outros produtos.',
            objective: 'sales',
            destination: 'whatsapp',
            budgetType: 'daily',
            authorizedAmount: null,
            durationDays: 7,
            reviewAfterDays: 7,
            whatsappMessageTemplate: 'Quero comprar o smartphone: {nome_produto} | Codigo: {sku}',
            botInstruction: 'A mensagem deve trazer modelo e SKU. Se houver variacoes, o bot mostra somente as variacoes daquele modelo em lista numerada curta.',
            status: 'draft',
        },
    ],
    updatedAt: null,
};

function sanitizePortfolio(value: MarketingCampaignPortfolio | null): MarketingCampaignPortfolio {
    if (!value || !Array.isArray(value.campaigns)) return DEFAULT_MARKETING_CAMPAIGN_PORTFOLIO;
    const savedById = new Map(value.campaigns.map((campaign) => [campaign.id, campaign]));
    return {
        campaigns: DEFAULT_MARKETING_CAMPAIGN_PORTFOLIO.campaigns.map((fallback) => {
            const saved = savedById.get(fallback.id);
            if (!saved) return fallback;
            const amount = Number(saved.authorizedAmount);
            return {
                ...fallback,
                objective: 'sales',
                destination: 'whatsapp',
                budgetType: saved.budgetType === 'lifetime' ? 'lifetime' : 'daily',
                authorizedAmount: Number.isFinite(amount) && amount > 0 ? amount : null,
                durationDays: Math.max(1, Math.min(90, Number(saved.durationDays || 7))),
                reviewAfterDays: Math.max(1, Math.min(30, Number(saved.reviewAfterDays || 7))),
                whatsappMessageTemplate: fallback.whatsappMessageTemplate,
                botInstruction: fallback.botInstruction,
                status: Number.isFinite(amount) && amount > 0 ? 'budget_configured' : 'draft',
            };
        }),
        updatedAt: value.updatedAt || null,
    };
}

export const marketingCampaignPortfolioService = {
    async get(): Promise<MarketingCampaignPortfolio> {
        const response = await vpsClient.get<PreferenceResponse>(
            `/admin/preferences/${encodeURIComponent(PREFERENCE_KEY)}`,
        );
        return sanitizePortfolio(response.value);
    },

    async save(portfolio: MarketingCampaignPortfolio): Promise<void> {
        await vpsClient.patch<PreferenceResponse>(
            `/admin/preferences/${encodeURIComponent(PREFERENCE_KEY)}`,
            { value: sanitizePortfolio({ ...portfolio, updatedAt: new Date().toISOString() }) },
        );
    },
};
