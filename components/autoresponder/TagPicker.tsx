import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { AutoResponderTag, AutoResponderTagScope } from '../../types/autoResponder';

function tagHasScope(tag: AutoResponderTag, scope?: AutoResponderTagScope): boolean {
    if (!scope) return true;
    if (Array.isArray(tag.scopes)) return tag.scopes.map(String).includes(String(scope));
    return String(tag.scopes || '').split(',').map((item) => item.trim()).includes(String(scope));
}

export interface TagPickerProps {
    tags: AutoResponderTag[];
    selectedTagIds: number[];
    scope?: AutoResponderTagScope;
    emptyLabel?: string;
    size?: 'sm' | 'md';
    onToggle: (tagId: number) => void;
}

export const TagPicker: React.FC<TagPickerProps> = ({
    tags,
    selectedTagIds,
    scope,
    emptyLabel = 'Nenhuma tag cadastrada.',
    size = 'md',
    onToggle,
}) => {
    const visibleTags = tags.filter((tag) => tagHasScope(tag, scope));
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
    const padding = size === 'sm' ? 'px-3 py-2' : 'px-3 py-2';

    if (visibleTags.length === 0) {
        return <span className="text-sm text-slate-500">{emptyLabel}</span>;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {visibleTags.map((tag) => {
                const selected = selectedTagIds.includes(Number(tag.id));
                return (
                    <button
                        key={tag.id}
                        type="button"
                        onClick={() => onToggle(Number(tag.id))}
                        className={`inline-flex items-center gap-1 rounded-lg border ${padding} ${textSize} font-semibold ${
                            selected
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        {selected ? <CheckCircle2 size={14} /> : (
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: tag.color || '#64748b' }}
                                aria-hidden="true"
                            />
                        )}
                        {tag.name}
                    </button>
                );
            })}
        </div>
    );
};

export default TagPicker;
