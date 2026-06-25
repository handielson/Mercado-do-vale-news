/**
 * Mercado do Vale AI Framework v1.0
 * TypingService: Simulates typing presence with dynamic delay based on messages.
 */

import * as SettingsService from './SettingsService.js';

const PROFILES = {
    instant: { charMs: 0, lineMs: 0, emojiMs: 0, minMs: 0, maxMs: 0 },
    fast: { charMs: 10, lineMs: 50, emojiMs: 100, minMs: 500, maxMs: 3000 },
    balanced: { charMs: 20, lineMs: 100, emojiMs: 150, minMs: 1000, maxMs: 6000 },
    human: { charMs: 35, lineMs: 150, emojiMs: 200, minMs: 2000, maxMs: 10000 }
};

export function calculateDelay(text, profileName = 'balanced') {
    const profile = PROFILES[profileName] || PROFILES.balanced;
    if (profileName === 'instant') return 0;

    const charCount = text.length;
    const lineCount = (text.match(/\n/g) || []).length;
    
    // Simple emoji regex
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const emojiCount = (text.match(emojiRegex) || []).length;

    let delay = (charCount * profile.charMs) + (lineCount * profile.lineMs) + (emojiCount * profile.emojiMs);
    
    if (delay < profile.minMs) delay = profile.minMs;
    if (delay > profile.maxMs) delay = profile.maxMs;
    
    // Strict overall cap of 10s (Adjust 4)
    if (delay > 10000) delay = 10000;

    return delay;
}

export async function simulateTyping(sender, text, options = {}) {
    const enabled = SettingsService.get('automation.typing_enabled', true);
    if (!enabled) return 0;

    const profileName = SettingsService.get('automation.typing_profile', 'balanced');
    const delay = calculateDelay(text, profileName);

    if (delay <= 0) return 0;

    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_API_INSTANCE || 'Xiaomi';

    let presenceSent = false;
    if (apiUrl && apiKey && options.mockMode !== true) {
        try {
            const res = await fetch(`${apiUrl}/chat/sendPresence/${instance}`, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: sender,
                    presence: 'composing'
                }),
                signal: AbortSignal.timeout(2000)
            });
            if (res.ok) {
                presenceSent = true;
            }
        } catch (err) {
            console.warn('[TypingService] Failed to send presence composing:', err.message);
        }
    }

    // Always delay execution
    await new Promise(resolve => setTimeout(resolve, delay));

    if (presenceSent && apiUrl && apiKey && options.mockMode !== true) {
        try {
            await fetch(`${apiUrl}/chat/sendPresence/${instance}`, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    number: sender,
                    presence: 'paused'
                }),
                signal: AbortSignal.timeout(2000)
            });
        } catch (err) {
            // Ignore error
        }
    }

    return delay;
}
