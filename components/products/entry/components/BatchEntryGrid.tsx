/**
 * BATCH ENTRY GRID - Spreadsheet-style table for bulk product entry
 * 
 * Technical: Dynamic table based on UNIQUE_FIELDS
 * Database: Prepares data for products table (specs.imei1, specs.imei2, etc.)
 * Features: Keyboard navigation, inline validation, auto-add rows
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { BatchProductRow } from '../ProductEntryWizard';
import { UNIQUE_FIELDS } from '../../../../config/product-fields';
import { customFieldsService, CustomField } from '../../../../services/custom-fields';
import { supabase } from '../../../../services/supabase';

interface BatchEntryGridProps {
    rows: BatchProductRow[]; // Array of product rows
    onChange: (rows: BatchProductRow[]) => void;
    uniqueFields: string[]; // Fields to show as columns (from UNIQUE_FIELDS)
}

// Fields that must be unique in the database
const DB_UNIQUE_FIELDS = ['imei1', 'imei2', 'serial'];

export function BatchEntryGrid({ rows, onChange, uniqueFields }: BatchEntryGridProps) {
    const gridRef = useRef<HTMLDivElement>(null);

    // Technical: State for custom fields configuration
    const [customFields, setCustomFields] = useState<Record<string, CustomField>>({});
    const [tableOptions, setTableOptions] = useState<Record<string, Array<{ id: string, name: string }>>>({});
    const [loading, setLoading] = useState(true);
    // Technical: Track which cells are being checked against DB (rowId:field)
    const [checkingDb, setCheckingDb] = useState<Set<string>>(new Set());

    // Technical: addRow - Add new empty row to grid
    const addRow = () => {
        const newRow: BatchProductRow = {
            id: crypto.randomUUID(), // Temporary ID
            isValid: false,
            errors: {}
        };

        console.log('➕ [BatchEntryGrid] Adding new row:', newRow.id);
        onChange([...rows, newRow]);
    };

    // Technical: removeRow - Remove row by ID
    const removeRow = (id: string) => {
        console.log('🗑️ [BatchEntryGrid] Removing row:', id);
        onChange(rows.filter(r => r.id !== id));
    };

    // Technical: updateCell - Update single cell value
    const updateCell = (rowId: string, field: string, value: string) => {
        const updatedRows = rows.map(row => {
            if (row.id === rowId) {
                const updated = { ...row, [field]: value };

                // Technical: Validate row
                updated.isValid = validateRow(updated, uniqueFields);
                updated.errors = getRowErrors(updated, rows, uniqueFields);

                return updated;
            }
            return row;
        });

        onChange(updatedRows);

        // Technical: Auto-focus to next field when IMEI reaches 15 digits
        if ((field === 'imei1' || field === 'imei2') && value.length === 15) {
            setTimeout(() => {
                const rowIndex = rows.findIndex(r => r.id === rowId);
                const fieldIndex = uniqueFields.indexOf(field);

                // Focus next field in the same row
                const nextFieldIndex = fieldIndex + 1;
                if (nextFieldIndex < uniqueFields.length) {
                    const nextInput = gridRef.current?.querySelector(
                        `input[data-row="${rowIndex}"][data-field="${nextFieldIndex}"], select[data-row="${rowIndex}"][data-field="${nextFieldIndex}"]`
                    ) as HTMLInputElement | HTMLSelectElement;
                    nextInput?.focus();
                } else {
                    // Last field - add new row and focus first field
                    addRow();
                    setTimeout(() => {
                        const firstInput = gridRef.current?.querySelector(
                            `input[data-row="${rows.length}"][data-field="0"], select[data-row="${rows.length}"][data-field="0"]`
                        ) as HTMLInputElement | HTMLSelectElement;
                        firstInput?.focus();
                    }, 100);
                }
            }, 50);
        }
    };

    // Technical: validateRow - Check if row has all required fields
    const validateRow = (row: BatchProductRow, fields: string[]): boolean => {
        // At least IMEI1 or Serial is required
        const hasIdentifier = row.imei1 || row.serial;
        return hasIdentifier;
    };

    // Technical: getRowErrors - Get validation errors for row
    const getRowErrors = (
        row: BatchProductRow,
        allRows: BatchProductRow[],
        fields: string[]
    ): Record<string, string> => {
        const errors: Record<string, string> = { ...row.errors }; // preserve DB errors

        // Technical: Validate IMEI1 format (15 digits)
        if (row.imei1) {
            const imei1Regex = /^\d{15}$/;
            if (!imei1Regex.test(row.imei1)) {
                errors.imei1 = 'IMEI deve ter 15 dígitos';
            } else if (!errors.imei1) {
                // Check for duplicate IMEI1 within the grid
                const duplicates = allRows.filter(r =>
                    r.id !== row.id && r.imei1 === row.imei1
                );
                if (duplicates.length > 0) errors.imei1 = 'IMEI duplicado na lista';
            }
        } else {
            delete errors.imei1;
        }

        // Technical: Validate IMEI2 format (15 digits)
        if (row.imei2) {
            const imei2Regex = /^\d{15}$/;
            if (!imei2Regex.test(row.imei2)) {
                errors.imei2 = 'IMEI deve ter 15 dígitos';
            } else if (!errors.imei2) {
                const duplicates = allRows.filter(r =>
                    r.id !== row.id && r.imei2 === row.imei2
                );
                if (duplicates.length > 0) errors.imei2 = 'IMEI duplicado na lista';
            }
        } else {
            delete errors.imei2;
        }

        // Check for duplicate Serial within the grid
        if (row.serial) {
            if (!errors.serial) {
                const duplicates = allRows.filter(r =>
                    r.id !== row.id && r.serial === row.serial
                );
                if (duplicates.length > 0) errors.serial = 'Serial duplicado na lista';
            }
        } else {
            delete errors.serial;
        }

        return errors;
    };

    // Technical: checkUniqueInDb - Verify field value against database
    const checkUniqueInDb = useCallback(async (rowId: string, field: string, value: string) => {
        if (!value || !DB_UNIQUE_FIELDS.includes(field)) return;

        const key = `${rowId}:${field}`;
        setCheckingDb(prev => new Set(prev).add(key));

        try {
            // Query specs column: specs->>'field' = value
            const { data, error } = await supabase
                .from('products')
                .select('id')
                .eq(`specs->>${field}`, value)
                .limit(1);

            if (error) throw error;

            const alreadyExists = data && data.length > 0;

            // Update error for this specific field
            onChange(rows.map(row => {
                if (row.id !== rowId) return row;
                const newErrors = { ...row.errors };
                if (alreadyExists) {
                    newErrors[field] = 'Já cadastrado no sistema';
                } else {
                    // Remove DB error if value changed and is now clean
                    if (newErrors[field] === 'Já cadastrado no sistema') {
                        delete newErrors[field];
                    }
                }
                return { ...row, errors: newErrors, isValid: Object.keys(newErrors).length === 0 && !!(row.imei1 || row.serial) };
            }));
        } catch (err) {
            console.error('[BatchEntryGrid] DB unique check failed:', err);
        } finally {
            setCheckingDb(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
    }, [rows, onChange]);

    // Technical: handleKeyDown - Keyboard navigation (Tab, Enter, Shift+Tab)
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        rowIndex: number,
        fieldIndex: number
    ) => {
        const isLastField = fieldIndex === uniqueFields.length - 1;
        const isLastRow = rowIndex === rows.length - 1;

        // Enter on last field of any row → Add new row and focus first field
        if (e.key === 'Enter' && isLastField) {
            e.preventDefault();
            addRow();

            // Focus first field of new row after state update
            setTimeout(() => {
                const firstInput = gridRef.current?.querySelector(
                    `input[data-row="${rows.length}"][data-field="0"]`
                ) as HTMLInputElement;
                firstInput?.focus();
            }, 50);
        }

        // Tab on last field → Move to first field of next row (or add new row)
        else if (e.key === 'Tab' && !e.shiftKey && isLastField) {
            if (isLastRow) {
                e.preventDefault();
                addRow();
            }
        }
    };

    // Technical: getFieldLabel - Convert field key to display label
    const getFieldLabel = (field: string): string => {
        const labels: Record<string, string> = {
            imei1: 'IMEI 1',
            imei2: 'IMEI 2',
            serial: 'Serial',
            color: 'Cor',
            storage: 'Armazenamento',
            ram: 'RAM',
            ean: 'EAN',
            sku: 'SKU'
        };
        return labels[field] || field;
    };

    // Technical: Load custom fields configuration
    useEffect(() => {
        const loadCustomFields = async () => {
            try {
                console.log('🔄 [BatchEntryGrid] Loading custom fields configuration...');
                const fields = await customFieldsService.list();

                // Create a map of field key -> field config
                const fieldsMap: Record<string, CustomField> = {};
                fields.forEach(field => {
                    fieldsMap[field.key] = field;
                });

                setCustomFields(fieldsMap);
                console.log('✅ [BatchEntryGrid] Custom fields loaded:', Object.keys(fieldsMap));

                // Load table options for table_relation fields
                await loadTableOptions(fields);
            } catch (error) {
                console.error('❌ [BatchEntryGrid] Error loading custom fields:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCustomFields();
    }, []);

    // Technical: Load options for table_relation fields
    const loadTableOptions = async (fields: CustomField[]) => {
        const options: Record<string, Array<{ id: string, name: string }>> = {};

        for (const field of fields) {
            if (field.field_type === 'table_relation' && field.table_config) {
                try {
                    const { table_name, label_column, value_column, order_by } = field.table_config;

                    console.log(`🔄 [BatchEntryGrid] Loading options for ${field.key} from ${table_name}...`);

                    let query = supabase
                        .from(table_name)
                        .select(`${value_column}, ${label_column}`);

                    if (order_by) {
                        query = query.order(order_by.replace(' ASC', '').replace(' DESC', ''), {
                            ascending: order_by.includes('ASC')
                        });
                    }

                    const { data, error } = await query;

                    if (error) throw error;

                    options[field.key] = (data || []).map(item => ({
                        id: item[value_column],
                        name: item[label_column]
                    }));

                    console.log(`✅ [BatchEntryGrid] Loaded ${options[field.key].length} options for ${field.key}`);
                } catch (error) {
                    console.error(`❌ [BatchEntryGrid] Error loading options for ${field.key}:`, error);
                    options[field.key] = [];
                }
            }
        }

        setTableOptions(options);
    };

    // Technical: Initialize with one empty row
    useEffect(() => {
        if (rows.length === 0) {
            addRow();
        }
    }, []);

    return (
        <div ref={gridRef} className="space-y-4">
            {/* Explanatory banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-blue-500 text-lg">📋</span>
                <div className="text-sm text-blue-800">
                    <strong>Cada linha = 1 produto.</strong> Preencha o campo único de cada unidade.
                    Pressione <kbd className="px-1 py-0.5 bg-white border border-blue-300 rounded text-xs">Enter</kbd> na última coluna ou clique em <strong>+ Adicionar produto</strong> para incluir mais.
                </div>
            </div>

            {/* Technical: Loading State */}
            {loading && (
                <div className="text-center py-4 text-slate-600">
                    🔄 Carregando configuração de campos...
                </div>
            )}

            {/* Technical: Grid Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full">
                    <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider w-12">
                                #
                            </th>
                            {uniqueFields.map((field, index) => (
                                <th
                                    key={field}
                                    className="px-3 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider"
                                >
                                    {getFieldLabel(field)}
                                    <span className="ml-2 text-xs text-slate-400 font-mono normal-case">specs.{field}</span>
                                </th>
                            ))}
                            <th className="px-3 py-2 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {rows.map((row, rowIndex) => (
                            <tr
                                key={row.id}
                                className={`
                                    ${Object.keys(row.errors).length > 0 ? 'bg-red-50' : ''}
                                    ${!row.isValid && (row.imei1 || row.serial) ? 'bg-yellow-50' : ''}
                                `}
                            >
                                {/* Technical: Row number */}
                                <td className="px-3 py-2 text-sm text-slate-500 text-center">
                                    {rowIndex + 1}
                                </td>

                                {/* Technical: Dynamic cells based on uniqueFields */}
                                {uniqueFields.map((field, fieldIndex) => {
                                    const fieldConfig = customFields[field];
                                    const isTableRelation = fieldConfig?.field_type === 'table_relation';
                                    const options = tableOptions[field] || [];

                                    return (
                                        <td key={field} className="px-3 py-2">
                                            {isTableRelation ? (
                                                /* Technical: Render SELECT for table_relation fields */
                                                <select
                                                    value={(row as any)[field] || ''}
                                                    onChange={(e) => updateCell(row.id, field, e.target.value)}
                                                    data-row={rowIndex}
                                                    data-field={fieldIndex}
                                                    className={`
                                                        w-full px-2 py-1 border rounded
                                                        focus:outline-none focus:ring-2 focus:ring-blue-500
                                                        ${row.errors[field] ? 'border-red-500 bg-red-50' : 'border-slate-300'}
                                                    `}
                                                >
                                                    <option value="">{getFieldLabel(field)}</option>
                                                    {options.map(opt => (
                                                        <option key={opt.id} value={opt.id}>
                                                            {opt.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                /* Technical: Render INPUT for text fields */
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={(row as any)[field] || ''}
                                                        onChange={(e) => updateCell(row.id, field, e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, fieldIndex)}
                                                        onBlur={(e) => {
                                                            if (DB_UNIQUE_FIELDS.includes(field) && e.target.value) {
                                                                checkUniqueInDb(row.id, field, e.target.value);
                                                            }
                                                        }}
                                                        data-row={rowIndex}
                                                        data-field={fieldIndex}
                                                        placeholder={getFieldLabel(field)}
                                                        // Technical: Limit IMEI fields to 15 digits
                                                        maxLength={field === 'imei1' || field === 'imei2' ? 15 : undefined}
                                                        inputMode={field === 'imei1' || field === 'imei2' ? 'numeric' : undefined}
                                                        className={`
                                                        w-full px-2 py-1 border rounded
                                                        focus:outline-none focus:ring-2 focus:ring-blue-500
                                                        ${row.errors[field] ? 'border-red-500 bg-red-50' : 'border-slate-300'}
                                                        ${checkingDb.has(`${row.id}:${field}`) ? 'pr-7' : ''}
                                                    `}
                                                    />
                                                    {checkingDb.has(`${row.id}:${field}`) && (
                                                        <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                                                    )}
                                                </div>
                                            )}
                                            {/* Technical: Show error message */}
                                            {row.errors[field] && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                                                    <AlertCircle size={12} />
                                                    {row.errors[field]}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* Technical: Delete button */}
                                <td className="px-3 py-2">
                                    {rows.length > 1 && (
                                        <button
                                            onClick={() => removeRow(row.id)}
                                            className="text-red-500 hover:text-red-700"
                                            title="Remover linha"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Technical: Add Row Button */}
            <button
                onClick={addRow}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
                <Plus size={18} />
                + Adicionar produto
            </button>

            {/* Technical: Keyboard shortcuts help */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                <span className="font-medium">💡 Atalhos de teclado:</span>
                {' '}
                <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded">Tab</kbd> → Próximo campo
                {' • '}
                <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded">Enter</kbd> na última coluna → Nova linha
                {' • '}
                <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded">Shift+Tab</kbd> → Campo anterior
            </div>
        </div>
    );
}
