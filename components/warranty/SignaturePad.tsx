/**
 * SignaturePad Component
 * Canvas-based signature capture for warranty documents
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Controlled component with clear state management
 * - Touch and mouse support
 * - Base64 export for storage
 */

import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SignaturePadProps {
    onSave: (signature: string) => void;
    onCancel: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Configure canvas
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Fill with white background
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();

        if ('touches' in e) {
            // Touch event
            const touch = e.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        } else {
            // Mouse event
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getCoordinates(e);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setIsEmpty(false);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getCoordinates(e);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const save = () => {
        const canvas = canvasRef.current;
        if (!canvas || isEmpty) return;

        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Assinatura do Cliente</h3>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            width={600}
                            height={200}
                            className="cursor-crosshair touch-none"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>

                    <p className="text-sm text-slate-600 mt-2">
                        Assine no espaço acima usando o mouse ou toque
                    </p>
                </div>

                <div className="flex items-center justify-between p-4 border-t bg-slate-50">
                    <button
                        onClick={clear}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Limpar
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={save}
                            disabled={isEmpty}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Salvar Assinatura
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
