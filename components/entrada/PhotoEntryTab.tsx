import React, { useCallback, useRef, useState } from 'react';
import { SmartphonePhotoIntakePage } from '../../pages/admin/products/SmartphonePhotoIntakePage';
import type { SmartphonePhotoIntake } from '../../types/smartphone-photo-intake';
import { createPhotoLine, hasPhotoIntake } from './entryList.js';
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

/**
 * Aba Foto: captura, análise e conferência da fila de foto (a mesma tela de hoje, embutida).
 * O aparelho conferido vira uma linha `{ source:'foto', photo_intake_id }`; quem grava é a confirmação da Lista.
 */
export const PhotoEntryTab: React.FC<PhotoEntryTabProps> = ({ onAddLines, existingState, confirmCount = 0, busy }) => {
    const [notice, setNotice] = useState<Notice>(null);
    // O envio lê a lista mais recente (dois cliques seguidos não podem duplicar a linha).
    const stateRef = useRef(existingState);
    stateRef.current = existingState;
    const busyRef = useRef(busy);
    busyRef.current = busy;

    const onSendToList = useCallback((intake: SmartphonePhotoIntake) => {
        const line = createPhotoLine(intake) as EntryLine;
        if (busyRef.current) { setNotice({ kind: 'busy', label: line.label }); return; }
        if (hasPhotoIntake(stateRef.current, intake.id)) { setNotice({ kind: 'duplicate', label: line.label }); return; }
        stateRef.current = { ...stateRef.current, lines: [...stateRef.current.lines, line] };
        onAddLines([line]);
        setNotice({ kind: 'added', label: line.label });
    }, [onAddLines]);

    return (
        <div className="space-y-3">
            {notice && (
                <p role="status" aria-live="polite"
                    className={`rounded-lg border px-3 py-2 text-sm ${notice.kind === 'added' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    <span className="font-semibold">
                        {notice.kind === 'added' ? 'Adicionado à lista' : notice.kind === 'duplicate' ? 'Já está na lista' : 'Aguarde a conferência da lista terminar'}
                    </span>
                    {' · '}{notice.label}
                </p>
            )}
            <SmartphonePhotoIntakePage embedded onSendToList={onSendToList} reloadSignal={confirmCount} />
        </div>
    );
};
