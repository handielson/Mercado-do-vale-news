import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ImageZoomModalProps {
    imageUrl: string;
    title?: string;
    onClose: () => void;
}

/**
 * Modal para visualizar imagem em tamanho completo com zoom
 */
export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
    imageUrl,
    title,
    onClose
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Fechar modal ao pressionar ESC
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Prevenir scroll do body quando modal está aberto
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Fechar ao clicar fora da imagem
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === modalRef.current) {
            onClose();
        }
    };

    return (
        <div
            ref={modalRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 animate-fadeIn"
            onClick={handleBackdropClick}
        >
            {/* Botão de fechar */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all z-10"
                aria-label="Fechar"
            >
                <X className="w-6 h-6 text-white" />
            </button>

            {/* Título (se fornecido) */}
            {title && (
                <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
                    <h3 className="text-lg font-semibold">{title}</h3>
                </div>
            )}

            {/* Imagem com zoom */}
            <div className="relative max-w-7xl max-h-[90vh] overflow-auto">
                <img
                    src={imageUrl}
                    alt={title || 'Imagem ampliada'}
                    className="w-full h-full object-contain cursor-zoom-out animate-scaleIn"
                    onClick={onClose}
                />
            </div>

            {/* Dica de navegação */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                Clique na imagem ou pressione ESC para fechar
            </div>
        </div>
    );
};
