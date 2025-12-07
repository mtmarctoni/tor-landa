"use client";

import React from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

interface AmorEasterEggModalProps {
    onClose: () => void;
}

const AmorEasterEggModal: React.FC<AmorEasterEggModalProps> = ({ onClose }) => {
    if (typeof window === 'undefined') return null;
    
    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div
                className="bg-gradient-to-br from-dream-500 to-dream-700 rounded-2xl p-8 shadow-2xl border-2 border-dream-300/50 flex flex-col items-center max-w-2xl mx-4 backdrop-blur-sm"
                initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                animate={{ 
                    scale: 1, 
                    opacity: 1, 
                    rotate: 0,
                    transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 20
                    }
                }}
                exit={{ scale: 0.3, opacity: 0, rotate: 10 }}
            >
                <motion.div
                    className="mb-6"
                    animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 10, -10, 0]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <Heart size={52} className="text-white/90 fill-white/20" />
                </motion.div>
                
                <motion.h2 
                    className="text-3xl font-bold text-white mb-6 text-center"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    💖 Momento Especial 💖
                </motion.h2>
                
                <motion.p 
                    className="text-white/95 mb-8 text-center text-lg leading-relaxed font-medium"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    A veces lo mejor aparece cuando menos te lo esperas.
                </motion.p>
                
                <motion.button
                    className="px-8 py-3 bg-white/20 text-white rounded-full shadow-lg hover:bg-white/30 transition-all duration-300 backdrop-blur-sm border border-white/30 font-semibold"
                    onClick={onClose}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    ✨ Continuar ✨
                </motion.button>
            </motion.div>
        </div>,
        document.body
    );
};

export default AmorEasterEggModal;