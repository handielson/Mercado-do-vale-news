
import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface CurrencyInputProps {
  value?: number; // Integer in cents (e.g., 1050 for R$ 10,50)
  onChange?: (value: number) => void;
  onValueChange?: (value: number) => void; // Alias for compatibility
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * CurrencyInput Component
 * Custom implementation with native HTML input for better comma support
 * 
 * ANTIGRAVITY PROTOCOL:
 * - NEVER use type="number" for money
 * - Always store as INTEGER CENTS (1050 = R$ 10,50)
 * - Prevents floating-point errors
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value = 0,
  onChange,
  onValueChange,
  label,
  placeholder = 'R$ 0,00',
  className,
  disabled,
  error
}) => {
  const handleChange = onChange || onValueChange || (() => { });

  // Local state for the raw input value (what user is typing)
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Format cents to Brazilian Real string (only when NOT focused)
  const formatCurrency = (cents: number): string => {
    if (cents === 0) return '';
    const reais = cents / 100;
    return reais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Parse user input to cents
  const parseCurrency = (str: string): number => {
    if (!str) return 0;

    // Remove everything except digits, comma and dot
    const cleaned = str.replace(/[^\d,.]/g, '');

    // Replace comma with dot for parseFloat
    const normalized = cleaned.replace(',', '.');

    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  // Update input value when value prop changes (only if not focused)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatCurrency(value));
    }
  }, [value, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow only numbers, comma, and dot
    const filtered = input.replace(/[^\d,.]/g, '');

    // Update local state (raw input)
    setInputValue(filtered);

    // Parse and send to parent immediately
    const cents = parseCurrency(filtered);
    handleChange(cents);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format on blur for clean display
    setInputValue(formatCurrency(value));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select all on focus for easy replacement
    e.target.select();
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-600 pointer-events-none">
          R$
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder.replace('R$ ', '')}
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm ring-offset-white",
            "placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
        />
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};
