import assert from 'assert';
import { handle, init, mockDbInstance } from '../00-kernel/Kernel.js';
import * as SettingsService from '../SettingsService.js';
import { classifyMessage } from '../MessageClassifier.js';
import { calculateDelay } from '../TypingService.js';

// Setup Mock DB for settings testing
const localMockDb = {
    records: {
        system_settings: {
            'automation.enabled': 'true',
            'automation.handoff_enabled': 'true',
            'automation.typing_enabled': 'true',
            'automation.typing_profile': 'balanced',
            'automation.resume_mode': 'manual',
            'automation.pause_timeout': '1440'
        }
    },
    queries: [],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ').trim();
        this.queries.push({ sql: cleanSql, values });

        if (cleanSql.includes('FROM CONVERSATION_CONTEXT') || cleanSql.includes('FROM AUTORESPONDER_AI_CONTEXT')) {
            const [channel, sender] = values;
            const key = `${channel}:${sender}`;
            const record = this.records[key];
            return record ? [[record]] : [[]];
        }

        if (cleanSql.includes('INSERT INTO AUTORESPONDER_AI_CONTEXT') || cleanSql.includes('INSERT INTO autoresponder_ai_context')) {
            const [channel, sender, conversation_id, framework_version, schema_version, conversation_context, order_context, customer_context] = values;
            const key = `${channel}:${sender}`;
            this.records[key] = {
                channel,
                sender,
                conversation_id,
                framework_version,
                schema_version,
                conversation_context,
                order_context,
                customer_context
            };
            return [{ affectedRows: 1 }];
        }

        if (cleanSql.includes('FROM SYSTEM_SETTINGS')) {
            const mockSettings = Object.entries(this.records.system_settings).map(([key, value]) => ({
                setting_key: key,
                setting_value: value,
                version: 1,
                updated_by: 'system'
            }));
            return [mockSettings];
        }

        if (cleanSql.startsWith('UPDATE SYSTEM_SETTINGS') || cleanSql.startsWith('INSERT INTO SYSTEM_SETTINGS')) {
            // Simply store the key-value in mock records
            const val = values[0];
            const key = values[values.length - 1];
            this.records.system_settings[key] = val;
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }
};

async function testSuite() {
    console.log('🧪 Iniciando testes operacionais do Módulo de Operação e Controle...');

    // Initialize services
    init(localMockDb);
    await SettingsService.loadSettings();

    // 1. Test Settings Cache and Dynamic Invalidation
    {
        assert.strictEqual(SettingsService.get('automation.enabled'), true);
        assert.strictEqual(SettingsService.get('automation.typing_profile'), 'balanced');

        // Dynamically change config
        await SettingsService.set('automation.typing_profile', 'human', 'admin-user');
        
        // Assert cache is updated immediately without restart
        assert.strictEqual(SettingsService.get('automation.typing_profile'), 'human');
        console.log('✅ 1. Alteração dinâmica das configurações e recarga automática do cache validadas.');
    }

    // 2. Test Typing calculation profile values
    {
        const text = 'Olá! Tudo bem? 😊\nVamos fechar seu pedido?';
        
        // Balanced: 20ms char, 100ms line, 150ms emoji (1 emoji, 1 newline)
        // CharCount: 39 * 20 = 780 + 100 + 150 = 1030ms.
        const balancedDelay = calculateDelay(text, 'balanced');
        assert.ok(balancedDelay >= 1000 && balancedDelay <= 6000);

        // Human: 35ms char, 150ms line, 200ms emoji
        // CharCount: 39 * 35 = 1365 + 150 + 200 = 1715ms.
        const humanDelay = calculateDelay(text, 'human');
        assert.ok(humanDelay >= 2000 && humanDelay <= 10000);

        // Instant: 0ms
        const instantDelay = calculateDelay(text, 'instant');
        assert.strictEqual(instantDelay, 0);

        console.log('✅ 2. Diferentes perfis de digitação e limites de tempo validados.');
    }

    // 3. Test MessageClassifier padronizado
    {
        const textPayload = {
            sender: '5587988888888',
            message: 'Olá bot',
            fromMe: false,
            channel: 'whatsapp'
        };
        const textClassified = classifyMessage(textPayload);
        assert.strictEqual(textClassified.source, 'customer');
        assert.strictEqual(textClassified.messageType, 'text');
        assert.strictEqual(textClassified.messageText, 'Olá bot');

        const audioPayload = {
            sender: '5587988888888',
            message: '',
            fromMe: false,
            messageType: 'audio',
            channel: 'whatsapp'
        };
        const audioClassified = classifyMessage(audioPayload);
        assert.strictEqual(audioClassified.messageType, 'audio');

        const locPayload = {
            sender: '5587988888888',
            fromMe: false,
            messageType: 'location',
            channel: 'whatsapp'
        };
        const locClassified = classifyMessage(locPayload);
        assert.strictEqual(locClassified.messageType, 'location');

        console.log('✅ 3. Classificador de mensagens padronizado (áudio, localização, texto) validado.');
    }

    // 4. Test Handoff transition between AI -> HUMAN -> AI
    {
        localMockDb.records = {
            system_settings: {
                'automation.enabled': 'true',
                'automation.handoff_enabled': 'true',
                'automation.typing_enabled': 'true',
                'automation.typing_profile': 'instant', // Instant for fast tests
                'automation.resume_mode': 'manual',
                'automation.pause_timeout': '1440'
            }
        };
        await SettingsService.loadSettings();

        const sender = '5587777777777';
        const channel = 'whatsapp';

        // Message 1 from customer: should be processed by AI
        const res1 = await handle('oi', channel, sender, { mockMode: true });
        assert.ok(res1.response.length > 0);
        assert.strictEqual(res1.context.conversation_context.automation.mode, 'AI');
        assert.strictEqual(res1.context.conversation_context.automation.paused, false);

        // Message 2 from operator: should trigger Handoff
        const res2 = await handle('Como posso te ajudar?', channel, sender, {
            mockMode: true,
            rawPayload: {
                sender,
                fromMe: true,
                message: 'Como posso te ajudar?',
                source: 'operator',
                operatorName: 'Atendente João'
            }
        });
        
        // IA should be muted, mode should transition to HUMAN, paused to true
        assert.strictEqual(res2.response, '');
        assert.strictEqual(res2.context.conversation_context.automation.mode, 'HUMAN');
        assert.strictEqual(res2.context.conversation_context.automation.paused, true);
        assert.strictEqual(res2.context.conversation_context.automation.pausedBy, 'Atendente João');

        // Message 3 from customer: should be ignored by IA (paused)
        const res3 = await handle('quero comprar um xiaomi', channel, sender, { mockMode: true });
        assert.strictEqual(res3.response, '');

        // Manually resume AI (acting as REST endpoint)
        const context = mockDbInstance.records[`${channel}:${sender}`];
        const loaded = JSON.parse(context.conversation_context);
        loaded.automation.paused = false;
        loaded.automation.pausedAt = null;
        loaded.automation.pauseReason = null;
        loaded.automation.pausedBy = null;
        loaded.automation.autoResumeAt = null;
        loaded.automation.mode = 'AI';
        context.conversation_context = JSON.stringify(loaded);

        // Message 4 from customer: IA should reply again
        const res4 = await handle('oi', channel, sender, { mockMode: true });
        assert.ok(res4.response.length > 0);
        assert.strictEqual(res4.context.conversation_context.automation.mode, 'AI');
        assert.strictEqual(res4.context.conversation_context.automation.paused, false);

        console.log('✅ 4. Transição completa de estados (AI -> HUMAN -> AI) e Múltiplos Handoffs validados.');
    }

    // 5. Global Bot Disable check
    {
        await SettingsService.set('automation.enabled', 'false', 'admin');
        const res = await handle('oi', 'whatsapp', '5587777777777', { mockMode: true });
        assert.strictEqual(res.response, '');
        console.log('✅ 5. Desativação global do bot (Bot Ativado/Desativado) validada.');
    }

    console.log('\n🎉 Todos os testes operacionais passaram com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes operacionais:', err);
    process.exit(1);
});
