import { useEffect, useState } from 'react';
import { unitService } from './units';
import { describeRegisteredUnitShort, shouldLookupIdentifier } from './deviceIdentifiers.mjs';

// Consulta imediata (ao digitar ou ler pela câmera) se o IMEI/serial já está em algum aparelho cadastrado.
// Procura na tabela de aparelhos (unidades), onde ficam os IMEIs dos celulares.

export interface RegisteredIdentifier {
  message: string;
  /** Tela de serializados já filtrada pelo identificador. */
  link: string;
  unitId: string;
  productId: string | null;
}

const recent = new Map<string, { at: number; promise: Promise<RegisteredIdentifier | null> }>();
const CACHE_MS = 30_000;

export function lookupRegisteredIdentifier(value: string, excludeProductId?: string | null): Promise<RegisteredIdentifier | null> {
  const key = `${String(value).trim().toLowerCase()}|${excludeProductId || ''}`;
  const cached = recent.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = unitService.searchByIdentifier(String(value).trim())
    .then(units => {
      // Ao editar um produto, os aparelhos dele mesmo não contam como repetidos.
      const others = units.filter(unit => !excludeProductId || unit.product_id !== excludeProductId);
      if (!others.length) return null;
      // unitService devolve a data como "created".
      const createdOf = (unit: any) => String(unit.created || unit.created_at || '');
      const latest = [...others].sort((a: any, b: any) => createdOf(b).localeCompare(createdOf(a)))[0] as any;
      return {
        message: describeRegisteredUnitShort({ status: latest.status, created_at: createdOf(latest) || undefined, product_name: latest.product_name }),
        link: `/admin/serializados?search=${encodeURIComponent(String(value).trim())}`,
        unitId: String(latest.id),
        productId: latest.product_id || null,
      };
    })
    .catch(() => {
      recent.delete(key);
      return null;
    });
  recent.set(key, { at: Date.now(), promise });
  return promise;
}

export type RegisteredCheckState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'free' }
  | { state: 'found'; info: RegisteredIdentifier };

/** Hook: consulta quando o valor fica completo (IMEI 15 dígitos; serial ≥ 6, com pausa curta de digitação). */
export function useRegisteredIdentifier(kind: 'imei' | 'serial', value: string, options: { enabled?: boolean; excludeProductId?: string | null } = {}): RegisteredCheckState {
  const { enabled = true, excludeProductId = null } = options;
  const [result, setResult] = useState<RegisteredCheckState>({ state: 'idle' });
  useEffect(() => {
    const text = String(value || '').trim();
    if (!enabled || !shouldLookupIdentifier(kind, text)) { setResult({ state: 'idle' }); return; }
    let cancelled = false;
    const delay = kind === 'serial' ? 500 : 0;
    const timer = window.setTimeout(() => {
      setResult({ state: 'checking' });
      lookupRegisteredIdentifier(text, excludeProductId).then(info => {
        if (!cancelled) setResult(info ? { state: 'found', info } : { state: 'free' });
      });
    }, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [kind, value, enabled, excludeProductId]);
  return result;
}
