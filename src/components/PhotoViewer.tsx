import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    const handlePanEnd = (_event: Event, info: PanInfo) => {
        const swipeThreshold = 50;
        
        if (info.offset.x > swipeThreshold) {
            onPrev();
        } else if (info.offset.x < -swipeThreshold) {
            onNext();
        }
    };

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
                    className="w-full h-full flex items-center justify-center p-2 md:p-8 relative"
                    onPanEnd={handlePanEnd}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
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
                    
                    <Image
                        src={photos[currentIndex].url}
                        alt={`Memory ${currentIndex + 1}`}
                        className={`w-full h-full object-contain rounded-xl md:rounded-2xl shadow-2xl transition-opacity duration-300 ${imageLoadStates[currentIndex] ? 'opacity-100' : 'opacity-0'}`}
                        fill
                        sizes="(max-width: 768px) 90vw, 70vw"
                        priority
                        style={{ objectFit: 'contain' }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            {photos.length > 1 && (
                <>
                    <button
                        onClick={onPrev}
                        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-2 md:p-3 text-rose-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
                    >
                        <ChevronLeft size={20} className="md:w-6 md:h-6" />
                    </button>
                    <button
                        onClick={onNext}
                        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-2 md:p-3 text-rose-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
                    >
                        <ChevronRight size={20} className="md:w-6 md:h-6" />
                    </button>
                </>
            )}

            {/* Counter */}
            <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm px-3 md:px-4 py-1 md:py-2 rounded-full text-xs md:text-sm text-rose-700 font-semibold shadow-lg">
                {currentIndex + 1} / {photos.length}
            </div>
        </>
    );
};

export default PhotoViewer;