import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SmartphonePhotoIntakePage } from '../../pages/admin/products/SmartphonePhotoIntakePage';
import type { SmartphonePhotoIntake } from '../../types/smartphone-photo-intake';
import { createPhotoLine, hasPhotoIntake } from './entryList.js';
import { useEntryLocations } from './EntryLockFields';
import type { EntryLine, EntryState } from './EntryListPanel';

export interface PhotoEntryTabProps {
    onAddLines: (lines: EntryLine[]) => void;
    /** Lista atual da tela, para não adicionar de novo o mesmo pré-cadastro. */
    existingState: EntryState;
    /** Muda a cada confirmação da Lista de entrada: a fila de foto é recarregada. */
    confirmCount?: number;
    busy?: boolean;
}

type Notice = { kind: 'added' | 'duplicate' | 'busy'; label: string } | null;

const fieldCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

/**
 * Aba Foto: captura, análise e conferência da fila de foto (a mesma tela de hoje, embutida).
 * O aparelho conferido vira uma linha `{ source:'foto', photo_intake_id, location_id }`; quem grava é a confirmação da Lista.
 */
export const PhotoEntryTab: React.FC<PhotoEntryTabProps> = ({ onAddLines, existingState, confirmCount = 0, busy }) => {
    const [notice, setNotice] = useState<Notice>(null);
    const [locationId, setLocationId] = useState('');
    const { locations, locationsError } = useEntryLocations(setLocationId);
    // O envio lê a lista mais recente (dois cliques seguidos não podem duplicar a linha).
    const stateRef = useRef(existingState);
    stateRef.current = existingState;
    const busyRef = useRef(busy);
    busyRef.current = busy;
    const locationRef = useRef(locationId);
    locationRef.current = locationId;

    // Depois de uma confirmação o aviso do último envio já não vale.
    const lastConfirm = useRef(confirmCount);
    useEffect(() => {
        if (confirmCount === lastConfirm.current) return;
        lastConfirm.current = confirmCount;
        setNotice(null);
    }, [confirmCount]);

    const onSendToList = useCallback((intake: SmartphonePhotoIntake) => {
        const location = locationRef.current;
        if (!location) return;
        const line = createPhotoLine(intake, location) as EntryLine;
        if (busyRef.current) { setNotice({ kind: 'busy', label: line.label }); return; }
        if (hasPhotoIntake(stateRef.current, intake.id)) { setNotice({ kind: 'duplicate', label: line.label }); return; }
        stateRef.current = { ...stateRef.current, lines: [...stateRef.current.lines, line] };
        onAddLines([line]);
        setNotice({ kind: 'added', label: line.label });
    }, [onAddLines]);

    return (
        <div className="space-y-3">
            <div className="max-w-xs">
                <label htmlFor="photo-location" className={labelCls}>Local</label>
                <select id="photo-location" className={fieldCls} value={locationId} onChange={e => setLocationId(e.target.value)}>
                    <option value="">Selecione o local</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {locationsError && <p role="alert" className="text-xs text-red-600 mt-1">Não foi possível carregar os locais.</p>}
                {!locationId && !locationsError && <p className="text-xs text-amber-700 mt-1">Escolha o local de estoque.</p>}
            </div>
            {notice && (
                <p role="status" aria-live="polite"
                    className={`rounded-lg border px-3 py-2 text-sm ${notice.kind === 'added' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    <span className="font-semibold">
                        {notice.kind === 'added' ? 'Adicionado à lista' : notice.kind === 'duplicate' ? 'Já está na lista' : 'Aguarde a conferência da lista terminar'}
                    </span>
                    {' · '}{notice.label}
                </p>
            )}
            <SmartphonePhotoIntakePage embedded onSendToList={onSendToList} reloadSignal={confirmCount} sendDisabled={!locationId} />
        </div>
    );
};
