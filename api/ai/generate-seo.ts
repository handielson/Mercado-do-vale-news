import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIGenerationRequest {
    provider: 'gemini' | 'grok' | 'chatgpt';
    prompt: string;
    productData: {
        name: string;
        brand: string;
        model: string;
        category: string;
        specs: Record<string, any>;
    };
}

interface AIGenerationResponse {
    description: string;
    slug: string;
    meta_title: string;
    meta_description: string;
    keywords: string[];
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { provider, prompt, productData } = req.body as AIGenerationRequest;

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
                return res.status(501).json({ error: 'Grok integration not implemented yet. Please use Gemini.' });
            case 'chatgpt':
                return res.status(501).json({ error: 'ChatGPT integration not implemented yet. Please use Gemini.' });
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
        throw new Error('GEMINI_API_KEY not configured. Please add it to Vercel environment variables.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
