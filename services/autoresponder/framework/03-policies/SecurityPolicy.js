/**
 * SecurityPolicy
 * Validates that technical infrastructure details, SQL elements, stack traces, or internal error statements do not leak.
 */
class SecurityPolicy {
    constructor() {
        this.name = 'SecurityPolicy';
    }

    validate(response, context) {
        const violations = [];
        const text = String(response || '');

        // 1. SQL keywords to prevent database leakage/injections
        const sqlKeywords = [
            /\bSELECT\b.*\bFROM\b/i,
            /\bINSERT\s+INTO\b/i,
            /\bUPDATE\b.*\bSET\b/i,
            /\bDELETE\s+FROM\b/i,
            /\bDROP\s+TABLE\b/i
        ];

        for (const regex of sqlKeywords) {
            if (regex.test(text)) {
                violations.push({
                    code: 'SQL_EXPOSURE_DETECTED',
                    severity: 'CRITICAL',
                    message: 'Foi detectado padrão SQL na resposta do bot.'
                });
                break;
            }
        }

        // 2. Technical files and traces
        const technicalPatterns = [
            /stack\s*trace/i,
            /at\s+async\s+/i,
            /TypeError:/i,
            /ReferenceError:/i,
            /Internal\s*Server\s*Error/i,
            /\.js:\d+/i,
            /\.ts:\d+/i,
            /database\s*error/i,
            /mysql\s*error/i
        ];

        for (const regex of technicalPatterns) {
            if (regex.test(text)) {
                violations.push({
                    code: 'TECHNICAL_EXPOSURE_DETECTED',
                    severity: 'CRITICAL',
                    message: 'Foi detectada exposição de detalhes técnicos ou pilha de erros na resposta.'
                });
                break;
            }
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new SecurityPolicy();
