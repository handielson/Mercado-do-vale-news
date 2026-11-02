
import React from 'react';
import { cn } from '../../utils/cn';
import { BarcodeScanButton } from './BarcodeScanButton';
import { RegisteredIdentifierNotice } from './RegisteredIdentifierNotice';
import { useRegisteredIdentifier } from '../../services/registeredIdentifier';

interface IMEIInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  id?: string;
  technicalName?: string;
  /** Mostra o botão 📷 para ler o IMEI pela câmera (padrão: sim). */
  scan?: boolean;
  /** Quando a câmera lê IMEI 1 e IMEI 2 juntos ("usar os dois"). */
  onScanPair?: (imeis: string[]) => void;
  /** Confere na hora (ao completar 15 dígitos) se o IMEI já está em algum aparelho cadastrado (padrão: sim). */
  checkRegistered?: boolean;
  /** Ao editar: aparelhos deste produto não contam como repetidos. */
  excludeProductId?: string | null;
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
  onBlur,
  id,
  technicalName,
  scan = true,
  onScanPair,
  checkRegistered = true,
  excludeProductId = null,
}) => {
  const registered = useRegisteredIdentifier('imei', value, { enabled: checkRegistered, excludeProductId });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Only allow numbers
    const numericOnly = raw.replace(/\D/g, '');

    // Limit to 15 digits
    const limited = numericOnly.slice(0, 15);

    // Auto-uppercase and trim
    onChange(limited.toUpperCase().trim());
  };

  const lengthInvalid = value.length > 0 && value.length !== 15;
  const isInvalid = lengthInvalid || registered.state === 'found';
  const isValid = value.length === 15 && registered.state !== 'found';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
          {technicalName && <span className="ml-2 hidden md:inline text-xs text-slate-400 font-mono">{technicalName}</span>}
        </label>
      )}
      <div className="flex min-w-0 items-center gap-2">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={15}
        className={cn(
          "flex h-11 md:h-10 min-w-0 w-full rounded-md border bg-white px-3 py-2 text-base md:text-sm uppercase tracking-wider placeholder:normal-case focus-visible:outline-none focus-visible:ring-2",
          isInvalid && "border-red-300 focus-visible:ring-red-500",
          isValid && "border-green-300 focus-visible:ring-green-500",
          !isInvalid && !isValid && "border-slate-200 focus-visible:ring-blue-500",
          className
        )}
      />
      {scan && (
        <BarcodeScanButton
          kind="imei"
          allowPair={Boolean(onScanPair)}
          onScan={values => {
            onChange(values[0] || '');
            if (values.length > 1 && onScanPair) onScanPair(values);
          }}
        />
      )}
      </div>
      <div className="flex items-center justify-between text-[10px] mt-0.5">
        <span className={cn(
          "font-medium",
          isValid && "text-green-600",
          isInvalid && "text-orange-600",
          !isValid && !isInvalid && "text-slate-400"
        )}>
          {value.length}/15 dígitos
        </span>
        {lengthInvalid && (
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
      <RegisteredIdentifierNotice check={registered} />
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};
