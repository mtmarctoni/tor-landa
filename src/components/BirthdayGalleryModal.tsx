"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { BaseModalProps } from '@/types/components';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { useBirthdayPhotos } from '@/hooks/useBirthdayPhotos';
import BirthdayConfetti from './BirthdayConfetti';
import GalleryLoading from './GalleryLoading';
import PhotoViewer from './PhotoViewer';
import PhotoCaption from './PhotoCaption';

const BirthdayGalleryModal: React.FC<BaseModalProps> = ({ isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showConfetti, setShowConfetti] = useState(true);
    
    // Custom hooks for data and preloading
    const { photos, loading } = useBirthdayPhotos(isOpen);
    const { imageLoadStates, preloadImages, clearPreloadedImages, resetLoadStates } = useImagePreloader();
    
    // Calculate loading progress
    const loadedImagesCount = Object.keys(imageLoadStates).filter(key => imageLoadStates[parseInt(key)]).length;

    // Preload images when photos are loaded
    useEffect(() => {
        if (photos.length > 0 && !loading) {
            preloadImages(photos.map(photo => photo.url));
        }
    }, [photos, loading, preloadImages]);

    // Handle confetti animation
    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }
    }, [isOpen]);

    // Reset states when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCurrentIndex(0);
            resetLoadStates();
        }
    }, [isOpen, resetLoadStates]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearPreloadedImages();
        };
    }, [clearPreloadedImages]);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md"
                    onClick={onClose}
                >
                    {/* Confetti celebration */}
                    {showConfetti && <BirthdayConfetti />}

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="relative w-full h-full md:max-w-4xl md:h-auto bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-2 right-2 md:top-4 md:right-4 z-10 bg-white/80 backdrop-blur-sm rounded-full p-2 text-rose-600 hover:text-rose-800 hover:bg-white transition-all shadow-lg"
                        >
                            <X size={20} className="md:w-6 md:h-6" />
                        </button>

                        {/* Header */}
                        <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 p-3 md:p-6 text-center flex-shrink-0">
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                }}
                            >
                                <h2 className="text-xl md:text-3xl font-serif text-white mb-1 md:mb-2">
                                    🎂 Para Ti, Landa 💖
                                </h2>
                            </motion.div>
                            <p className="text-white/90 text-xs md:text-sm">
                                Momentos especiales (o las únicas fotos que tenemos juntos)
                            </p>
                        </div>

                        {/* Photo Gallery */}
                        <div className="relative flex-1 min-h-0 bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center overflow-hidden">
                            {loading ? (
                                <GalleryLoading photosCount={photos.length} loadedCount={loadedImagesCount} />
                            ) : (
                                <PhotoViewer
                                    photos={photos}
                                    currentIndex={currentIndex}
                                    imageLoadStates={imageLoadStates}
                                    onNext={handleNext}
                                    onPrev={handlePrev}
                                />
                            )}
                        </div>

                        {/* Caption */}
                        {!loading && photos.length > 0 && (
                            <div className="flex-shrink-0">
                                <PhotoCaption photo={photos[currentIndex]} currentIndex={currentIndex} />
                            </div>
                        )}

                        {/* Footer message */}
                        <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-3 md:p-6 border-t-2 border-rose-200 flex-shrink-0">
                            <p className="text-center text-rose-700 leading-relaxed text-sm md:text-base">
                                Feliz cumpleaños.
                            </p>
                            <p className="text-center text-rose-700 leading-relaxed text-sm md:text-base">
                                Te quiero.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BirthdayGalleryModal;
