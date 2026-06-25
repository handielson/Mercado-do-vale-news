/**
 * Mercado do Vale AI Framework v1.0
 * PolicyEngine orchestrates and executes registered policies for response validation.
 */

class PolicyEngine {
    constructor() {
        this.policies = [];
    }

    /**
     * Registers a validation policy.
     * @param {object} policy 
     */
    register(policy) {
        if (!policy || typeof policy.validate !== 'function') {
            throw new Error('[PolicyEngine] Policy must implement a validate(response, context) function.');
        }
        this.policies.push(policy);
    }

    /**
     * Clears all registered policies (useful for testing).
     */
    clear() {
        this.policies = [];
    }

    /**
     * Validates a response against all registered policies.
     * @param {string} response 
     * @param {object} context 
     * @returns {object} { approved: boolean, violations: Array }
     */
    validate(response, context) {
        const violations = [];
        const conversationId = context?.conversation_id || 'unknown';
        const activeSkill = context?.conversation_context?.state?.flow || 'unknown';

        for (const policy of this.policies) {
            const result = policy.validate(response, context);
            if (!result.approved && result.violations) {
                for (const violation of result.violations) {
                    const enrichedViolation = {
                        code: violation.code,
                        severity: violation.severity || 'HIGH',
                        message: violation.message,
                        policy: policy.name || policy.constructor.name,
                        skill: activeSkill
                    };
                    violations.push(enrichedViolation);

                    // Structured logging of the violation
                    console.warn(JSON.stringify({
                        event: 'POLICY_VIOLATION',
                        conversation_id: conversationId,
                        skill: activeSkill,
                        policy: enrichedViolation.policy,
                        code: enrichedViolation.code,
                        severity: enrichedViolation.severity,
                        timestamp: new Date().toISOString()
                    }));
                }
            }
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new PolicyEngine();
