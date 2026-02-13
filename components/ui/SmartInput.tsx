
import React, { useRef, useEffect } from 'react';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { getFieldDefinitionRuntime, applyFieldFormat } from '../../config/field-dictionary';

interface SmartInputProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    className?: string;
    disabled?: boolean;
}

/**
 * SmartInput Component
 * Intelligent input that automatically formats text based on field dictionary rules
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Integrates with React Hook Form
 * - Auto-formats text (capitalize, uppercase, lowercase)
 * - Fetches label/placeholder from runtime field dictionary
 * - Preserves cursor position during formatting
 */
export function SmartInput<T extends FieldValues>({
    control,
    name,
    className = '',
    disabled = false
}: SmartInputProps<T>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const fieldDef = getFieldDefinitionRuntime(name as string);

    if (!fieldDef) {
        console.warn(`Field "${name}" not found in FIELD_DICTIONARY`);
        return null;
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                {fieldDef.label}
                {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                <span className="ml-2 text-xs text-slate-400 font-mono">{name}</span>
            </label>

            <Controller
                control={control}
                name={name}
                render={({ field, fieldState }) => {
                    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                        const cursorPosition = e.target.selectionStart || 0;
                        const rawValue = e.target.value;
                        const formattedValue = applyFieldFormat(rawValue, fieldDef.format);

                        field.onChange(formattedValue);

                        // Restore cursor position after formatting
                        setTimeout(() => {
                            if (inputRef.current) {
                                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                            }
                        }, 0);
                    };

                    return (
                        <>
                            <input
                                ref={inputRef}
                                type="text"
                                value={field.value || ''}
                                onChange={handleChange}
                                onBlur={field.onBlur}
                                placeholder={fieldDef.placeholder}
                                disabled={disabled}
                                minLength={fieldDef.minLength}
                                maxLength={fieldDef.maxLength}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${fieldState.error
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-slate-200 focus:ring-blue-500'
                                    } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
                            />
                            {fieldState.error && (
                                <p className="text-xs text-red-600 mt-1">
                                    {fieldState.error.message}
                                </p>
                            )}
                            {fieldDef.description && !fieldState.error && (
                                <p className="text-xs text-slate-500 mt-1">
                                    {fieldDef.description}
                                </p>
                            )}
                            {fieldDef.maxLength && !fieldState.error && (
                                <p className="text-xs text-slate-400 mt-1">
                                    {(field.value || '').length} / {fieldDef.maxLength} caracteres
                                </p>
                            )}
                        </>
                    );
                }}
            />
        </div>
    );
}
