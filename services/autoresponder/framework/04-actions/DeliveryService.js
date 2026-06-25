let pool = null;

export function init(mysqlPool) {
    pool = mysqlPool;
}

function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}

function successResponse(data) {
    return { success: true, data };
}

function checkPool() {
    if (!pool) throw new Error('DATABASE_POOL_NOT_INITIALIZED');
}

export async function validateCep(cep) {
    const cleanCep = String(cep || '').replace(/\D/g, '');
    if (cleanCep.length === 8) {
        return successResponse({ valid: true, cep: cleanCep });
    }
    return errorResponse('INVALID_CEP', 'CEP deve possuir exatamente 8 dígitos numéricos.');
}

export async function calculateFreight(cep) {
    try {
        checkPool();
        const cepCheck = await validateCep(cep);
        if (!cepCheck.success) return cepCheck;

        // Query shipping rules from ERP/MySQL
        const query = 'SELECT fee, estimated_days FROM shipping_rules WHERE start_cep <= ? AND end_cep >= ? LIMIT 1';
        const [rows] = await pool.query(query, [cepCheck.data.cep, cepCheck.data.cep]);
        
        if (rows && rows.length > 0) {
            return successResponse({
                fee: Number(rows[0].fee),
                estimated_days: rows[0].estimated_days
            });
        }

        // Standard shipping cost fallback
        return successResponse({
            fee: 15.00,
            estimated_days: 2
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function resolveAddress(param) {
    try {
        let message = '';
        let location = null;
        let context = null;

        if (param && typeof param === 'object' && ('message' in param || 'location' in param || 'context' in param)) {
            message = String(param.message || '').trim();
            location = param.location || null;
            context = param.context || null;
        } else {
            // Backward compatibility fallback
            if (param && typeof param === 'object' && param.latitude && param.longitude) {
                location = param;
            } else {
                message = String(param || '').trim();
            }
        }

        const cleanText = message.toLowerCase();

        // Initialize empty address object
        const address = {
            cep: null,
            street: null,
            number: null,
            district: null,
            city: null,
            state: null,
            complement: null,
            reference: null
        };

        // If there's an existing address in context, pre-populate
        if (context && context.order_context && context.order_context.delivery && context.order_context.delivery.address) {
            Object.assign(address, context.order_context.delivery.address);
        }

        // 1. Check Location Coordinates (WhatsApp location sharing)
        if (location && location.latitude && location.longitude) {
            address.street = 'Localização compartilhada';
            address.district = 'Coordenadas';
            address.city = 'Petrolina';
            address.state = 'PE';
        }

        // 2. Parse CEP (regex for 8 digits or 5-3 digits)
        const cepMatch = message.match(/\b\d{5}-\d{3}\b/) || message.match(/\b\d{8}\b/);
        if (cepMatch) {
            const cleanCep = cepMatch[0].replace(/\D/g, '');
            address.cep = cleanCep;

            // Fetch from database/cache if pool is available
            if (pool) {
                const query = 'SELECT street, neighborhood, city, state FROM cep_cache WHERE cep = ? LIMIT 1';
                const [rows] = await pool.query(query, [cleanCep]);
                if (rows && rows.length > 0) {
                    address.street = rows[0].street;
                    address.district = rows[0].neighborhood;
                    address.city = rows[0].city;
                    address.state = rows[0].state;
                } else {
                    // Fallback to standard Petrolina PE address for recognized CEPs
                    address.street = address.street || 'Endereço Geral';
                    address.district = address.district || 'Centro';
                    address.city = address.city || 'Petrolina';
                    address.state = address.state || 'PE';
                }
            } else {
                // Testing fallback
                address.street = address.street || 'Endereço Geral';
                address.district = address.district || 'Centro';
                address.city = address.city || 'Petrolina';
                address.state = address.state || 'PE';
            }
        }

        // 3. Parse Number (strip CEP patterns first to avoid matching CEP suffix as house number)
        const textForNumber = cleanText.replace(/\b\d{5}-\d{3}\b/g, '').replace(/\b\d{8}\b/g, '');
        const numberMatch = textForNumber.match(/(?:nº|n°|numero|número|num|n)\s*[:.-]?\s*(\d+)/i) || 
                            textForNumber.match(/,\s*(\d+)\b/) ||
                            textForNumber.match(/\b\d{1,4}\b(?!\d)/);
        if (numberMatch) {
            address.number = numberMatch[1] || numberMatch[0];
        }

        if (context && context.order_context && context.order_context.delivery && context.order_context.delivery.number) {
            address.number = address.number || context.order_context.delivery.number;
        }

        // 4. Parse Complement
        const complementKeywords = ['apartamento', 'apto', 'apt', 'bloco', 'fundos', 'casa', 'sala', 'loja', 'galpão', 'casa-altos', 'casa altos'];
        for (const kw of complementKeywords) {
            if (cleanText.includes(kw)) {
                const idx = cleanText.indexOf(kw);
                let compStr = message.substring(idx).trim();
                // Clean trailing CEP pattern if present
                compStr = compStr.replace(/(?:cep\s*)?\b\d{5}-\d{3}\b/i, '').replace(/(?:cep\s*)?\b\d{8}\b/i, '').trim();
                // Strip trailing commas
                compStr = compStr.replace(/,?\s*$/, '').trim();
                address.complement = compStr;
                break;
            }
        }
        if (context && context.order_context && context.order_context.delivery && context.order_context.delivery.complement) {
            address.complement = address.complement || context.order_context.delivery.complement;
        }

        // 5. Parse Reference (e.g. "perto de", "ao lado", "em frente", "referencia:")
        const referenceMatch = message.match(/(?:referência|referencia|perto de|ao lado de|em frente|frente ao|frente à)\s+(.+)/i);
        if (referenceMatch) {
            address.reference = referenceMatch[1].trim();
        }
        if (context && context.order_context && context.order_context.delivery && context.order_context.delivery.reference) {
            address.reference = address.reference || context.order_context.delivery.reference;
        }

        // 6. Check if we resolved street name from message when CEP is not yet resolved but address is sent as free text
        if (!address.street && message.length > 10 && !cepMatch) {
            // Keep street as clean message
            address.street = message.trim();
        }

        // Determine missing fields
        const missingFields = [];
        if (!address.cep && !address.street) {
            missingFields.push('cep');
        }
        if (!address.number) {
            missingFields.push('number');
        }
        if (address.complement === null) {
            missingFields.push('complement');
        }

        // Check if ready for confirmation (we need cep/street, and number)
        const readyForConfirmation = (address.cep || address.street) && address.number ? true : false;

        return successResponse({
            address,
            missingFields,
            readyForConfirmation
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}
