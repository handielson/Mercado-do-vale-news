import { NextApiRequest, NextApiResponse } from 'next';
import { AIProvider, AIGenerationRequest, AIGenerationResponse } from '../../../types/ai-provider';

// Importar SDK do Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<AIGenerationResponse | { error: string }>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { provider, prompt, productData }: AIGenerationRequest = req.body;

    // Validação básica
    if (!provider || !prompt || !productData) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        let response: AIGenerationResponse;

        switch (provider) {
            case 'gemini':
                response = await generateWithGemini(prompt, productData);
                break;
            case 'grok':
                response = await generateWithGrok(prompt, productData);
                break;
            case 'chatgpt':
                response = await generateWithChatGPT(prompt, productData);
                break;
            default:
                return res.status(400).json({ error: 'Invalid AI provider' });
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error('AI generation error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to generate SEO content'
        });
    }
}

async function generateWithGemini(prompt: string, productData: any): Promise<AIGenerationResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured. Please add it to your .env.local file.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const fullPrompt = `
${prompt}

Produto:
- Nome: ${productData.name || 'N/A'}
- Marca: ${productData.brand || 'N/A'}
- Modelo: ${productData.model || 'N/A'}
- Categoria: ${productData.category || 'N/A'}
- Especificações: ${JSON.stringify(productData.specs || {})}

IMPORTANTE: Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
    "description": "descrição detalhada do produto com mínimo 300 palavras, destacando benefícios, especificações técnicas e diferenciais",
    "slug": "url-amigavel-sem-acentos-minusculas",
    "meta_title": "título SEO com máximo 60 caracteres incluindo nome da loja",
    "meta_description": "meta descrição persuasiva com máximo 160 caracteres destacando benefícios",
    "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}
`;

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    // Extrair JSON da resposta (pode vir com markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini. Could not extract JSON.');
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);

    // Validação básica
    if (!parsedResponse.description || !parsedResponse.slug || !parsedResponse.meta_title) {
        throw new Error('Incomplete response from Gemini');
    }

    return parsedResponse;
}

async function generateWithGrok(prompt: string, productData: any): Promise<AIGenerationResponse> {
    // TODO: Implementar integração com Grok quando API estiver disponível
    throw new Error('Grok integration not implemented yet. Please use Gemini or ChatGPT.');
}

async function generateWithChatGPT(prompt: string, productData: any): Promise<AIGenerationResponse> {
    // TODO: Implementar integração com ChatGPT (OpenAI)
    throw new Error('ChatGPT integration not implemented yet. Please use Gemini for now.');
}
