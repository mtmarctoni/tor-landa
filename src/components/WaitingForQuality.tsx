import React from 'react';
import { motion } from 'framer-motion';

const WaitingForQuality: React.FC = () => {
    return (
        <motion.div
            className="flex flex-col items-center justify-center py-16"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
        >
            <motion.div
                animate={{ rotate: [0, 360, 0], scale: [1, 2, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="mb-6"
            >
                <span className="text-6xl select-none" role="img" aria-label="hourglass">⏳</span>
            </motion.div>
            <h2 className="text-2xl font-bold text-dream-700 mb-2 text-center">¡Todavía no hay mensaje!</h2>
            <motion.div
                className="mb-4"
                animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
                <span className="text-3xl font-extrabold text-dream-500 drop-shadow animate-bounce select-none">Tú solo confía 😎</span>
            </motion.div>
            <p className="text-dream-600 text-lg mb-4 text-center">
                Confía en el proceso. El universo (y el autor) están trabajando en ello.<br />
                ¡A veces lo mejor llega para quienes saben esperar!
            </p>
            <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95, rotate: -5 }}
                className="px-6 py-2 bg-dream-200 text-dream-800 rounded-full shadow hover:bg-dream-300 transition-colors"
                onClick={() => window.location.reload()}
            >
                Volver a comprobar quality
            </motion.button>
            <motion.div
                className="mt-8"
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
                <span className="text-3xl select-none" role="img" aria-label="sparkles">✨</span>
            </motion.div>
            <p className="mt-4 text-dream-500 italic text-center">
                Ten paciencia, ¡el próximo quality caerá pronto!
            </p>
        </motion.div>
    );
};

export default WaitingForQuality;
