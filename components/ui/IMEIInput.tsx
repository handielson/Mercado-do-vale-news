
import React from 'react';
import { cn } from '../../utils/cn';

interface IMEIInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  technicalName?: string;
}

/**
 * IMEI Input Component
 * ANTIGRAVITY PROTOCOL: 15-digit validation enforced
 * - Only numeric input allowed
 * - Max 15 digits
 * - Auto-uppercase and trim
 * - Visual validation feedback
 */
export const IMEIInput: React.FC<IMEIInputProps> = ({
  value,
  onChange,
  label,
  placeholder = "Digite 15 dígitos",
  className,
  required = false,
  error,
  onKeyDown,
  id,
  technicalName
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Only allow numbers
    const numericOnly = raw.replace(/\D/g, '');

    // Limit to 15 digits
    const limited = numericOnly.slice(0, 15);

    // Auto-uppercase and trim
    onChange(limited.toUpperCase().trim());
  };

  const isInvalid = value.length > 0 && value.length !== 15;
  const isValid = value.length === 15;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
          {technicalName && <span className="ml-2 text-xs text-slate-400 font-mono">{technicalName}</span>}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={15}
        className={cn(
          "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm uppercase tracking-wider placeholder:normal-case focus-visible:outline-none focus-visible:ring-2",
          isInvalid && "border-red-300 focus-visible:ring-red-500",
          isValid && "border-green-300 focus-visible:ring-green-500",
          !isInvalid && !isValid && "border-slate-200 focus-visible:ring-blue-500",
          className
        )}
      />
      <div className="flex items-center justify-between text-[10px] mt-0.5">
        <span className={cn(
          "font-medium",
          isValid && "text-green-600",
          isInvalid && "text-orange-600",
          !isValid && !isInvalid && "text-slate-400"
        )}>
          {value.length}/15 dígitos
        </span>
        {isInvalid && (
          <span className="text-red-600 font-medium">
            ⚠️ Deve ter 15 dígitos
          </span>
        )}
        {isValid && (
          <span className="text-green-600 font-medium">
            ✓ Válido
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};
