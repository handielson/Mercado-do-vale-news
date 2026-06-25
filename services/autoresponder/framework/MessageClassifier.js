/**
 * Mercado do Vale AI Framework v1.0
 * MessageClassifier: Classifies incoming payloads into standardized message format.
 */

export function classifyMessage(payload) {
    if (!payload) {
        return {
            source: 'system',
            channel: 'whatsapp',
            sender: 'unknown',
            messageId: 'sys-' + Date.now(),
            timestamp: new Date().toISOString(),
            messageType: 'unknown',
            messageText: '',
            fromMe: false,
            operatorId: null,
            operatorName: null,
            rawPayload: {}
        };
    }

    const channel = payload.channel || 'whatsapp';
    const sender = String(payload.sender || payload.from || payload.phone || payload.number || payload.contact || '').trim() || 'unknown';
    const messageId = payload.messageId || payload.id || payload.key?.id || ('msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
    const timestamp = payload.timestamp || payload.messageTimestamp || new Date().toISOString();
    
    let source = 'customer';
    let operatorId = null;
    let operatorName = null;

    const fromMe = payload.fromMe === true || payload.key?.fromMe === true || String(payload.fromMe || payload.key?.fromMe || '').toLowerCase() === 'true';

    if (fromMe) {
        if (payload.isBot === true || payload.bot === true || payload.source === 'bot' || payload.sentByBot === true) {
            source = 'bot';
        } else {
            source = 'operator';
            operatorId = payload.operatorId || 'operator-1';
            operatorName = payload.operatorName || 'Operador';
        }
    } else {
        if (payload.source === 'operator' || payload.sentByOperator === true) {
            source = 'operator';
            operatorId = payload.operatorId || 'operator-1';
            operatorName = payload.operatorName || 'Operador';
        } else if (payload.source === 'bot') {
            source = 'bot';
        } else if (payload.source === 'system') {
            source = 'system';
        }
    }

    let messageType = 'text';
    let messageText = String(payload.message || payload.text || payload.query || payload.body || payload.received_message || '').trim();

    const isAudio = payload.messageType === 'audio' || 
                    payload.isAudio === true || 
                    payload.audio === true || 
                    String(payload.mimeType || '').includes('audio') || 
                    payload.message?.audioMessage || 
                    payload.rawPayload?.message?.audioMessage;
    
    const isImage = payload.messageType === 'image' || 
                    payload.isImage === true || 
                    payload.image === true || 
                    String(payload.mimeType || '').includes('image') || 
                    payload.message?.imageMessage || 
                    payload.rawPayload?.message?.imageMessage;

    const isLocation = payload.messageType === 'location' || 
                       payload.isLocation === true || 
                       payload.location === true || 
                       payload.message?.locationMessage || 
                       payload.rawPayload?.message?.locationMessage;

    const isDocument = payload.messageType === 'document' || 
                       payload.isDocument === true || 
                       payload.document === true || 
                       payload.message?.documentMessage || 
                       payload.rawPayload?.message?.documentMessage;

    if (isAudio) {
        messageType = 'audio';
    } else if (isImage) {
        messageType = 'image';
    } else if (isLocation) {
        messageType = 'location';
    } else if (isDocument) {
        messageType = 'document';
    }

    return {
        source,
        channel,
        sender,
        messageId,
        timestamp,
        messageType,
        messageText,
        fromMe,
        operatorId,
        operatorName,
        rawPayload: payload
    };
}
