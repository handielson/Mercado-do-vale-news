import React from 'react';

import type {
    MarketingTypographyField,
    MarketingTypographySegment,
    MarketingTypographyStyle,
} from '../../../../utils/marketing-typography';
import {
    resolveMarketingStickerText,
    type MarketingStickerTokenValues,
} from '../../../../utils/marketing-sticker';

interface MarketingTypographyTextProps {
    field: MarketingTypographyField;
    tokens: MarketingStickerTokenValues;
    fallbackText?: string;
    className?: string;
    style?: React.CSSProperties;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hexToRgb = (color: string): [number, number, number] | null => {
    const normalized = color.trim().toLowerCase();
    const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;

    if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;

    const full = hex.length === 3
        ? hex.split('').map((token) => `${token}${token}`).join('')
        : hex;

    const value = Number.parseInt(full, 16);
    if (Number.isNaN(value)) return null;

    return [
        (value >> 16) & 255,
        (value >> 8) & 255,
        value & 255,
    ];
};

const toRgba = (color: string, alpha: number): string => {
    const channels = hexToRgb(color);
    if (!channels) return color;

    const [red, green, blue] = channels;
    return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
};

const buildSharedTypographyStyle = (
    textStyle: MarketingTypographyStyle,
): React.CSSProperties => ({
    display: 'block',
    fontFamily: textStyle.fontFamily,
    fontStyle: textStyle.italic ? 'italic' : 'normal',
    letterSpacing: `${textStyle.letterSpacing}em`,
    lineHeight: 'inherit',
    whiteSpace: 'pre-wrap',
});

const buildDepthLayerStyles = (
    textStyle: MarketingTypographyStyle,
): React.CSSProperties[] => {
    const totalLayers = clamp(Math.round(textStyle.depth), 0, 12);
    if (totalLayers === 0) return [];

    return Array.from({ length: totalLayers }, (_, index) => {
        const step = index + 1;
        const progress = step / totalLayers;
        const offsetX = Number((step * 0.58).toFixed(2));
        const offsetY = Number((step * 0.9).toFixed(2));
        const alpha = 0.92 - (progress * 0.38);
        const strokeWidth = Math.max(1, Math.round(textStyle.outlineWidth * 0.55));
        const blurAmount = progress > 0.8 ? Number((textStyle.shadowBlur * 0.06).toFixed(2)) : 0;

        return {
            ...buildSharedTypographyStyle(textStyle),
            color: toRgba(textStyle.depthColor, alpha),
            filter: blurAmount > 0 ? `blur(${blurAmount}px)` : undefined,
            gridArea: '1 / 1',
            pointerEvents: 'none',
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            WebkitTextStroke: strokeWidth > 0
                ? `${strokeWidth}px ${toRgba(textStyle.depthColor, Math.min(1, alpha + 0.08))}`
                : undefined,
            zIndex: step,
        };
    });
};

const buildFaceTextShadow = (textStyle: MarketingTypographyStyle): string | undefined => {
    if (textStyle.depth <= 0 && textStyle.shadowBlur <= 0) return undefined;

    const shadows = [
        `${-1}px ${-1}px 0 ${toRgba('#ffffff', 0.82)}`,
        `${-1}px ${-2}px ${Math.max(1, Math.round(textStyle.shadowBlur * 0.18))}px ${toRgba('#ffffff', 0.28)}`,
        `0 ${Math.max(1, Math.round(textStyle.depth * 0.45))}px ${Math.max(1, Math.round(textStyle.shadowBlur * 0.35))}px ${toRgba(textStyle.shadowColor, 0.18)}`,
    ].filter(Boolean);

    return shadows.length > 0 ? shadows.join(', ') : undefined;
};

const buildFaceFilter = (textStyle: MarketingTypographyStyle): string | undefined => {
    if (textStyle.depth <= 0 && textStyle.shadowBlur <= 0) return undefined;

    const castDistance = Math.max(3, Math.round(textStyle.depth * 0.85));
    const castBlur = Math.max(4, Math.round(textStyle.shadowBlur * 0.75));
    const groundBlur = Math.max(6, castBlur + 4);

    return [
        `drop-shadow(0 ${castDistance}px ${castBlur}px ${toRgba(textStyle.shadowColor, 0.28)})`,
        `drop-shadow(0 ${castDistance + 2}px ${groundBlur}px ${toRgba('#000000', 0.18)})`,
    ].join(' ');
};

const buildFaceStyle = (
    textStyle: MarketingTypographyStyle,
): React.CSSProperties => ({
    ...buildSharedTypographyStyle(textStyle),
    color: textStyle.color,
    filter: buildFaceFilter(textStyle),
    gridArea: '1 / 1',
    paintOrder: 'stroke fill',
    position: 'relative',
    textShadow: buildFaceTextShadow(textStyle),
    WebkitTextStroke: textStyle.outlineWidth > 0 ? `${textStyle.outlineWidth}px ${textStyle.outlineColor}` : undefined,
    zIndex: Math.max(2, Math.round(textStyle.depth) + 2),
});

const buildLayerWrapperStyle = (style: React.CSSProperties = {}): React.CSSProperties => ({
    ...style,
    display: 'inline-grid',
    position: 'relative',
});

const renderTypographyLayer = (
    text: string,
    textStyle: MarketingTypographyStyle,
    key?: string,
): React.ReactElement => {
    const depthLayers = buildDepthLayerStyles(textStyle);

    return (
        <span key={key} style={buildLayerWrapperStyle()} className="align-baseline">
            {depthLayers.map((layerStyle, index) => (
                <span
                    key={`${key ?? textStyle.fontId}-depth-${index}`}
                    aria-hidden="true"
                    style={layerStyle}
                >
                    {text}
                </span>
            ))}
            <span style={buildFaceStyle(textStyle)}>{text}</span>
        </span>
    );
};

const resolveSegmentText = (
    segment: MarketingTypographySegment,
    tokens: MarketingStickerTokenValues,
): string => resolveMarketingStickerText(segment.text, tokens);

export default function MarketingTypographyText({
    field,
    tokens,
    fallbackText = '',
    className,
    style,
}: MarketingTypographyTextProps) {
    const resolvedText = resolveMarketingStickerText(field.text, tokens) || fallbackText;

    if (field.mode === 'advanced' && field.segments.length > 0) {
        return (
            <span className={className} style={style}>
                {field.segments.map((segment) => {
                    const segmentText = resolveSegmentText(segment, tokens);
                    if (!segmentText) return null;

                    return renderTypographyLayer(segmentText, segment.style, segment.id);
                })}
            </span>
        );
    }

    return (
        <span className={className} style={style}>
            {renderTypographyLayer(resolvedText, field.simpleStyle)}
        </span>
    );
}
