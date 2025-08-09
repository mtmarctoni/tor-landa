import React from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface EasterEggModalProps {
    onClose: () => void;
}


const EasterEggModal: React.FC<EasterEggModalProps> = ({ onClose }) => {
    if (typeof window === 'undefined') return null;
    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <motion.div
                className="bg-white rounded-3xl p-10 shadow-2xl border-4 border-dream-200 flex flex-col items-center surreal-bg max-w-3xl mx-auto"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
            >
                <Sparkles size={48} className="text-dream-400 mb-4 animate-spin-slow" />
                <h2 className="text-2xl font-bold text-dream-700 mb-2">¡Sorpresa Surrealista!</h2>
                <p className="text-dream-800 mb-4 text-center">Esta sorpresa es para ti, de alguien que te quiere mucho. A veces el cariño no se ve, pero siempre está contigo, incluso en los momentos más simples.</p>
                <button
                    className="mt-2 px-6 py-2 bg-dream-400 text-white rounded-full shadow hover:bg-dream-600 transition"
                    onClick={onClose}
                >
                    Cerrar
                </button>
            </motion.div>
        </div>,
        document.body
    );
};

export default EasterEggModal;
