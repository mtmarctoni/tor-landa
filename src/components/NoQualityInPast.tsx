import React from 'react';
import { motion } from 'framer-motion';

const NoQualityInPast: React.FC = () => {
    return (
        <motion.div
            className="flex flex-col items-center justify-center py-16"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
        >
            <motion.div
                animate={{ rotate: [0, 360, 0], scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="mb-6"
            >
                <span className="text-6xl select-none" role="img" aria-label="calendar">📅</span>
            </motion.div>
            <h2 className="text-2xl font-bold text-dream-700 mb-2 text-center">¡Ups! Semana sin mensaje...</h2>
            <motion.div
                className="mb-4"
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
                <span className="text-3xl font-extrabold text-dream-500 drop-shadow animate-bounce select-none">Ni el oráculo lo vio venir 😅</span>
            </motion.div>
            <p className="text-dream-600 text-lg mb-4 text-center">
                Esta semana ya pasó y el mensaje se fue de vacaciones.<br />
                ¡Pero no te preocupes! La próxima semana seguro trae algo especial.
            </p>
            <motion.div
                className="mt-8"
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
                <span className="text-3xl select-none" role="img" aria-label="sparkles">✨</span>
            </motion.div>
            <p className="mt-4 text-dream-500 italic text-center">
                Los errores son historia, los mensajes son eternos. <br />
                (A no ser que se caiga esta página, claro)
            </p>
        </motion.div>
    );
};

export default NoQualityInPast;
