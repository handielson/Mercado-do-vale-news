import React, { Suspense, lazy } from 'react';
import { labelPrintProduct } from './labelPrintProduct.js';

// Janela de etiqueta carregada só quando abre (o gerador de PDF/código de barras é pesado).
const LabelPrintModal = lazy(() => import('./LabelPrintModal').then(module => ({ default: module.LabelPrintModal })));

interface Props {
    product: any | null;
    parent?: any | null;
    onClose: () => void;
}

export function LazyLabelPrintModal({ product, parent = null, onClose }: Props) {
    if (!product) return null;
    return (
        <Suspense fallback={null}>
            <LabelPrintModal isOpen onClose={onClose} product={labelPrintProduct(product, parent)} />
        </Suspense>
    );
}
