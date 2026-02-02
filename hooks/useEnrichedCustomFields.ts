import { useState, useEffect } from 'react';
import { customFieldsService, CustomField } from '../services/custom-fields';

/**
 * Hook: useEnrichedCustomFields
 * 
 * ANTIGRAVITY PROTOCOL: Custom Fields Synchronization
 * 
 * Purpose:
 * - Enriches category custom fields with data from the library
 * - Supports BOTH old (inline) and new (reference) formats
 * - Ensures automatic synchronization when library fields are updated
 * 
 * Format Support:
 * 
 * OLD FORMAT (Inline Data):
 * {
 *   id: "custom-123",
 *   name: "Limite de Crédito",
 *   key: "limite_credito",
 *   type: "number",
 *   requirement: "optional"
 * }
 * 
 * NEW FORMAT (Reference):
 * {
 *   id: "custom-123",
 *   field_id: "uuid-from-library",
 *   requirement: "optional"
 * }
 * 
 * @param categoryFields - Array of custom fields from category.config
 * @returns { fields, loading, error }
 */

interface CategoryCustomField {
    id: string;
    field_id?: string; // NEW: Reference to library
    requirement: 'off' | 'optional' | 'required';
    // OLD FORMAT fields (for backward compatibility)
    name?: string;
    key?: string;
    type?: string;
    options?: string[];
    placeholder?: string;
}

interface EnrichedField extends CustomField {
    requirement: 'off' | 'optional' | 'required';
}

export const useEnrichedCustomFields = (categoryFields: CategoryCustomField[] | undefined) => {
    const [fields, setFields] = useState<EnrichedField[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadFieldData = async () => {
            setLoading(true);
            setError(null);

            try {
                if (!categoryFields || categoryFields.length === 0) {
                    setFields([]);
                    setLoading(false);
                    return;
                }

                const enrichedData = await Promise.all(
                    categoryFields.map(async (cf) => {
                        // NEW FORMAT: Has field_id reference
                        if (cf.field_id) {
                            try {
                                const libraryField = await customFieldsService.getById(cf.field_id);

                                if (libraryField) {
                                    // Merge library data with requirement from category
                                    return {
                                        ...libraryField,
                                        requirement: cf.requirement
                                    } as EnrichedField;
                                } else {
                                    console.warn(`Field ${cf.field_id} not found in library, using fallback`);
                                    // Fallback to inline data if exists
                                    return cf as any;
                                }
                            } catch (err) {
                                console.error(`Error loading field ${cf.field_id}:`, err);
                                return cf as any;
                            }
                        }

                        // OLD FORMAT: Use inline data
                        return cf as any;
                    })
                );

                setFields(enrichedData);
            } catch (err) {
                console.error('Error enriching custom fields:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
                // Fallback to original data on error
                setFields(categoryFields as any);
            } finally {
                setLoading(false);
            }
        };

        loadFieldData();
    }, [categoryFields]);

    return { fields, loading, error };
};
