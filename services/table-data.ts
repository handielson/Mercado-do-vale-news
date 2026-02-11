import { supabase } from './supabase';

export interface TableOption {
    value: string | number;
    label: string;
}

/**
 * Table Data Service
 * Loads options from database tables for table_relation fields
 */
export const tableDataService = {
    /**
     * Load options from a database table
     * @param tableName - Name of the table to query
     * @param valueColumn - Column to use as the option value
     * @param labelColumn - Column to use as the option label
     * @param orderBy - Optional ordering (e.g., "name ASC")
     * @returns Array of {value, label} options
     */
    async loadOptions(
        tableName: string,
        valueColumn: string = 'id',
        labelColumn: string = 'name',
        orderBy?: string
    ): Promise<TableOption[]> {
        try {
            let query = supabase
                .from(tableName)
                .select(`${valueColumn}, ${labelColumn}`);

            // Apply ordering if specified
            if (orderBy) {
                const [column, direction] = orderBy.split(' ');
                query = query.order(column, { ascending: direction?.toUpperCase() === 'ASC' });
            } else {
                // Default ordering by label column
                query = query.order(labelColumn);
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error loading options from ${tableName}:`, error);
                throw error;
            }

            if (!data) {
                return [];
            }

            // Map to {value, label} format
            return data.map(row => ({
                value: row[valueColumn],
                label: row[labelColumn]
            }));
        } catch (error) {
            console.error(`Failed to load options from ${tableName}:`, error);
            return [];
        }
    },

    /**
     * Load a single option by value
     * Useful for displaying the current selection
     */
    async loadOption(
        tableName: string,
        value: string | number,
        valueColumn: string = 'id',
        labelColumn: string = 'name'
    ): Promise<TableOption | null> {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select(`${valueColumn}, ${labelColumn}`)
                .eq(valueColumn, value)
                .single();

            if (error || !data) {
                return null;
            }

            return {
                value: data[valueColumn],
                label: data[labelColumn]
            };
        } catch (error) {
            console.error(`Failed to load option from ${tableName}:`, error);
            return null;
        }
    }
};
