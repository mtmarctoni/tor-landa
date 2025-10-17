import React from 'react';
import { motion } from 'framer-motion';

interface GalleryLoadingProps {
    photosCount: number;
    loadedCount: number;
}

const GalleryLoading: React.FC<GalleryLoadingProps> = ({ photosCount, loadedCount }) => {
    const progressPercentage = photosCount > 0 ? (loadedCount / photosCount) * 100 : 0;

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="text-4xl"
            >
                ✨
            </motion.div>
            <p className="text-rose-600 font-semibold">Cargando recuerdos...</p>
            {photosCount > 0 && (
                <div className="w-48 bg-rose-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-rose-400 to-pink-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            )}
        </div>
    );
};

export default GalleryLoading;