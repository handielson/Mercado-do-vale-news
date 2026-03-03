// Vercel Serverless Function: troca o authorization_code por access_token
// Simples — sem Supabase. O cliente (React) salva os tokens.
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, client_id, client_secret, redirect_uri } = req.body;

    if (!code || !client_id || !client_secret || !redirect_uri) {
        return res.status(400).json({ error: 'Missing required fields: code, client_id, client_secret, redirect_uri' });
    }

    const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

    try {
        const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: String(redirect_uri),
            }).toString(),
        });

        const data = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error('Bling token exchange error:', tokenRes.status, data);
            return res.status(tokenRes.status).json({ error: 'token_exchange_failed', details: data });
        }

        return res.status(200).json({
            access_token: data.access_token,
            refresh_token: data.refresh_token || null,
            expires_in: data.expires_in || 3600,
        });
    } catch (err: any) {
        console.error('Network error during token exchange:', err);
        return res.status(500).json({ error: 'network_error', message: err.message });
    }
}
