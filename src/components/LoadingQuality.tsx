import React from 'react';
import { motion } from 'framer-motion';

const LoadingQuality: React.FC = () => {
    return (
        <motion.div
            className="flex flex-col items-center justify-center py-16"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
        >
            <motion.div
                animate={{ rotate: [0, 360, 0], scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="mb-6"
            >
                <span className="text-6xl select-none" role="img" aria-label="hourglass">⏳</span>
            </motion.div>
            <h2 className="text-2xl font-bold text-dream-700 mb-2 text-center">Cargando el mensaje...</h2>
            <p className="text-dream-600 text-lg mb-4 text-center">
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
