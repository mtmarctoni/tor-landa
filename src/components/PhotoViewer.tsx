import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import type { Photo } from '@/types';

interface PhotoViewerProps {
    photos: Photo[];
    currentIndex: number;
    imageLoadStates: { [key: number]: boolean };
    onNext: () => void;
    onPrev: () => void;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({
    photos,
    currentIndex,
    imageLoadStates,
    onNext,
    onPrev
}) => {
    if (photos.length === 0) {
        return (
            <div className="text-center p-8">
                <p className="text-rose-600 text-lg mb-2">💖</p>
                <p className="text-rose-700">Pronto habrá fotos especiales aquí</p>
            </div>
        );
    }

    return (
        <>
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="w-full h-full flex items-center justify-center p-8 relative"
                >
                    {/* Show loading spinner for individual image if not loaded */}
                    {!imageLoadStates[currentIndex] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-100 to-pink-100">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="text-3xl"
                            >
                                ✨
                            </motion.div>
                        </div>
                    )}
                    
                    <img
                        src={photos[currentIndex].url}
                        alt={`Memory ${currentIndex + 1}`}
                        className={`max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-opacity duration-300 ${
                            imageLoadStates[currentIndex] ? 'opacity-100' : 'opacity-0'
                        }`}
                        loading="eager"
                    />
                </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            {photos.length > 1 && (
                <>
                    <button
                        onClick={onPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 text-rose-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={onNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 text-rose-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
                    >
                        <ChevronRight size={24} />
                    </button>
                </>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-rose-700 font-semibold shadow-lg">
                {currentIndex + 1} / {photos.length}
            </div>
        </>
    );
};

export default PhotoViewer;