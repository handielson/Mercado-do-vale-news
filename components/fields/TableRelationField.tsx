import React, { useState, useEffect } from 'react';
import { TableConfig } from '../../types/category';
import { tableDataService, TableOption } from '../../services/table-data';

interface TableRelationFieldProps {
    tableConfig: TableConfig;
    value: string | number | null;
    onChange: (value: string | number | null) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * TableRelationField Component
 * Renders a dropdown that loads options from a database table
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Loads options dynamically from specified table
 * - Handles loading states
 * - Supports any table with value/label columns
 */
export const TableRelationField: React.FC<TableRelationFieldProps> = ({
    tableConfig,
    value,
    onChange,
    disabled = false,
    className = ''
}) => {
    const [options, setOptions] = useState<TableOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadOptions();
    }, [tableConfig.table_name, tableConfig.value_column, tableConfig.label_column]);

    const loadOptions = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const loadedOptions = await tableDataService.loadOptions(
                tableConfig.table_name,
                tableConfig.value_column,
                tableConfig.label_column,
                tableConfig.order_by
            );

            setOptions(loadedOptions);
        } catch (err) {
            console.error('Error loading table options:', err);
            setError(`Erro ao carregar opções de ${tableConfig.table_name}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <select
                disabled
                className={`${className} opacity-50 cursor-wait`}
            >
                <option>Carregando...</option>
            </select>
        );
    }

    if (error) {
        return (
            <div className="text-sm text-red-600">
                {error}
                <button
                    onClick={loadOptions}
                    className="ml-2 text-blue-600 hover:underline"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className={className}
        >
            <option value="">Selecione...</option>
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};
