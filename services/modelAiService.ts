import { vpsClient } from './vpsClient';

export interface ModelAiGenerateInput {
    prompt: string;
    name?: string;
    brand?: string;
    category?: string;
    trustedSourceLinks?: string[];
    sourceContext?: string;
}

export interface ModelAiGenerateResult {
    text: string;
    model?: string | null;
}

export async function generateModelJsonWithAi(input: ModelAiGenerateInput): Promise<ModelAiGenerateResult> {
    return vpsClient.post<ModelAiGenerateResult>('/models/generate-json', input);
}
