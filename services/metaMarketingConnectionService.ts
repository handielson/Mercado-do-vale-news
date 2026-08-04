import { vpsClient } from './vpsClient';

export interface MetaAdAccount {
    id: string;
    account_id?: string;
    name?: string;
    account_status?: number;
    currency?: string;
    timezone_name?: string;
}

export interface MetaInstagramAccount {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
}

export interface MetaPage {
    id: string;
    name?: string;
    instagram_business_account?: MetaInstagramAccount;
}

export interface MetaMarketingConnection {
    configured: boolean;
    missingConfiguration: string[];
    status: 'disconnected' | 'connected' | 'expired' | 'error';
    graphApiVersion: string | null;
    redirectUri: string | null;
    grantedScopes: string[];
    availableAdAccounts: MetaAdAccount[];
    availablePages: MetaPage[];
    selectedAdAccount: MetaAdAccount | null;
    selectedPage: MetaPage | null;
    selectedInstagramAccountId: string | null;
    instagramUsername: string | null;
    tokenExpiresAt: string | null;
    connectedAt: string | null;
    lastAudit: {
        mode: 'read_only';
        capturedAt: string;
        account?: MetaAdAccount & { amount_spent?: string; balance?: string; spend_cap?: string };
        instagram?: MetaInstagramAccount & { followers_count?: number; media_count?: number };
        campaignSummary?: { total: number; active: number; paused: number };
    } | null;
    lastAuditAt: string | null;
    lastError: string | null;
}

type ConnectionResponse = { ok: true; connection: MetaMarketingConnection };

export type MetaInsightsDatePreset = 'last_7d' | 'last_14d' | 'last_30d' | 'this_month';

export interface MetaCampaignMetrics {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number;
    cpm: number;
    clicks: number;
    uniqueClicks: number;
    linkClicks: number;
    outboundClicks: number;
    ctr: number;
    cpc: number;
    costPerLinkClick: number;
    engagements: number;
    conversations: number;
    costPerConversation: number;
    purchases: number;
    costPerPurchase: number;
    purchaseValue: number;
    roas: number;
    videoPlays: number;
    thruPlays: number;
}

export interface MetaCampaignFollowerTracking {
    accountLevel: true;
    status: 'awaiting_activation' | 'tracking';
    baselineFollowers: number | null;
    currentFollowers: number | null;
    gainedFollowers: number | null;
    growthPercent: number | null;
    baselineAt: string | null;
    latestAt: string | null;
    campaignStatus: string;
    explanation: string;
}

export interface MetaCampaignInsightItem {
    campaignId: string;
    campaignName: string;
    status: string;
    dateStart: string | null;
    dateStop: string | null;
    currency: string | null;
    metrics: MetaCampaignMetrics;
    followers?: MetaCampaignFollowerTracking;
    actions: Array<{ action_type: string; value: string }>;
}

export interface MetaCampaignInsightsReport {
    mode: 'read_only';
    datePreset: MetaInsightsDatePreset;
    attribution: string;
    ranges: {
        current: { since: string; until: string };
        previous: { since: string; until: string };
    };
    instagramFollowers?: {
        accountLevel: true;
        currentFollowers: number | null;
        capturedAt: string;
        explanation: string;
    };
    current: { totals: MetaCampaignMetrics; campaigns: MetaCampaignInsightItem[] };
    previous: { totals: MetaCampaignMetrics; campaigns: MetaCampaignInsightItem[] };
    fetchedAt: string;
}

export interface MetaCampaignDraftApprovalResponse {
    ok: true;
    reused: boolean;
    approval: { id: string; status: string; title: string };
}

export const metaMarketingConnectionService = {
    async getStatus(): Promise<MetaMarketingConnection> {
        return (await vpsClient.get<ConnectionResponse>('/admin/marketing/meta/status')).connection;
    },

    async startOAuth(): Promise<string> {
        const response = await vpsClient.post<{ ok: true; authorizationUrl: string }>(
            '/admin/marketing/meta/oauth/start',
            {},
        );
        return response.authorizationUrl;
    },

    async selectAssets(adAccountId: string, pageId: string): Promise<MetaMarketingConnection> {
        return (await vpsClient.patch<ConnectionResponse>('/admin/marketing/meta/selection', {
            adAccountId,
            pageId,
        })).connection;
    },

    async audit(): Promise<MetaMarketingConnection> {
        return (await vpsClient.post<ConnectionResponse & { audit: unknown }>(
            '/admin/marketing/meta/audit',
            {},
        )).connection;
    },

    async getInsights(datePreset: MetaInsightsDatePreset): Promise<MetaCampaignInsightsReport> {
        return await vpsClient.get<MetaCampaignInsightsReport & { ok: true }>(
            `/admin/marketing/meta/insights?datePreset=${encodeURIComponent(datePreset)}`,
        );
    },

    async prepareCampaignDraftApproval(): Promise<MetaCampaignDraftApprovalResponse> {
        return await vpsClient.post<MetaCampaignDraftApprovalResponse>(
            '/admin/marketing/meta/campaign-draft-approvals',
            {},
        );
    },

    async prepareCreativePlanApproval(payload: Record<string, unknown>): Promise<MetaCampaignDraftApprovalResponse> {
        return await vpsClient.post<MetaCampaignDraftApprovalResponse>(
            '/admin/marketing/meta/creative-plan-approvals',
            payload,
        );
    },
};
