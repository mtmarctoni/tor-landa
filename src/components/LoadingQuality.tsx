import React from 'react';
import { motion } from 'framer-motion';

const LoadingQuality: React.FC = () => {
    return (
        <motion.div
            className="surface-card flex w-full max-w-2xl flex-col items-center justify-center px-5 py-8 text-center sm:px-8 sm:py-12"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
        >
            <motion.div
                animate={{ rotate: [0, 360, 0], scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="mb-4 sm:mb-6"
            >
                <span className="select-none text-5xl sm:text-6xl" role="img" aria-label="hourglass">⏳</span>
            </motion.div>
            <h2 className="mb-2 text-[1.7rem] font-bold leading-tight text-dream-800 sm:text-2xl">Cargando el mensaje...</h2>
            <p className="mb-4 max-w-[30rem] text-base leading-7 text-dream-700 sm:text-lg">
                Si puedes leer esto, tu internet es más lento que una tortuga filosofando.<br />
                ¡Pero tranquilo, el mensaje siempre llega!
            </p>
            <motion.div
                className="mt-8"
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            >
                <span className="text-3xl select-none" role="img" aria-label="sparkles">✨</span>
            </motion.div>
        </motion.div>
    );
};

export default LoadingQuality;
