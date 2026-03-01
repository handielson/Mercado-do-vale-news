import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';

export const FeedbackFloatingButton: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-24 right-6 z-40 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all duration-200 group flex items-center justify-center"
                aria-label="Fale Conosco"
                title="Dúvidas ou Sugestões?"
            >
                <MessageSquare className="w-6 h-6 group-hover:animate-pulse" />

                {/* Tooltip on hover (desktop only) */}
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
                    Dúvidas ou Sugestões?
                    {/* Arrow */}
                    <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800"></span>
                </span>
            </button>

            <FeedbackModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
};
