/**
 * ValidationPolicy
 * Validates structural execution prerequisites: active skill, framework and schema versioning parameters.
 */
class ValidationPolicy {
    constructor() {
        this.name = 'ValidationPolicy';
    }

    validate(response, context) {
        const violations = [];

        // 1. Active Skill Validation
        const flow = context?.conversation_context?.state?.flow;
        if (!flow || flow === 'none') {
            violations.push({
                code: 'NO_ACTIVE_SKILL',
                severity: 'HIGH',
                message: 'Não há nenhuma Skill ativa registrada no contexto.'
            });
        }

        // 2. Version validation
        const frameworkVersion = context?.framework_version;
        const schemaVersion = context?.schema_version;

        if (!frameworkVersion) {
            violations.push({
                code: 'MISSING_FRAMEWORK_VERSION',
                severity: 'MEDIUM',
                message: 'Atributo framework_version está ausente no contexto.'
            });
        }

        if (schemaVersion === undefined || schemaVersion === null) {
            violations.push({
                code: 'MISSING_SCHEMA_VERSION',
                severity: 'MEDIUM',
                message: 'Atributo schema_version está ausente no contexto.'
            });
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new ValidationPolicy();
