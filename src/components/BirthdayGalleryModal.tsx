"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import type { Photo } from '@/types';
import type { BirthdayGalleryModalProps } from '@/types/components';

const BirthdayGalleryModal: React.FC<BirthdayGalleryModalProps> = ({ isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showConfetti, setShowConfetti] = useState(true);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch photos from Notion when modal opens
    useEffect(() => {
        const fetchPhotos = async () => {
            if (!isOpen) return;
            
            setLoading(true);
            setError(null);
            
            try {
                const response = await fetch('/api/birthday-photos');
                if (!response.ok) {
                    throw new Error('Failed to fetch photos');
                }
                
                const data = await response.json();
                
                // If no photos from Notion, use placeholders
                if (!data.photos || data.photos.length === 0) {
                    setPhotos([
                        {
                            url: '/images/dali1.webp',
                            caption: 'Cada momento contigo es un regalo ✨'
                        },
                        {
                            url: '/images/dali2.webp',
                            caption: 'Los mejores recuerdos están por venir 💖'
                        },
                        {
                            url: '/images/thekiss.jpg',
                            caption: 'Feliz cumpleaños, mi amor 🎂'
                        }
                    ]);
                } else {
                    setPhotos(data.photos);
                }
            } catch (err) {
                console.error('Error fetching birthday photos:', err);
                setError('Error loading photos');
                // Use placeholders on error
                setPhotos([
                    {
                        url: '/images/dali1.webp',
                        caption: 'Cada momento contigo es un regalo ✨'
                    },
                    {
                        url: '/images/dali2.webp',
                        caption: 'Los mejores recuerdos están por venir 💖'
                    },
                    {
                        url: '/images/thekiss.jpg',
                        caption: 'Feliz cumpleaños, mi amor 🎂'
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchPhotos();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }
    }, [isOpen]);

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
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                    onClick={onClose}
                >
                    {/* Confetti celebration */}
                    {showConfetti && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {[...Array(30)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute text-2xl"
                                    initial={{
                                        top: '-10%',
                                        left: `${Math.random() * 100}%`,
                                        opacity: 0,
                                        rotate: 0,
                                    }}
                                    animate={{
                                        top: '110%',
                                        opacity: [0, 1, 1, 0],
                                        rotate: 360 * 3,
                                    }}
                                    transition={{
                                        duration: 4 + Math.random() * 2,
                                        delay: Math.random() * 2,
                                        ease: 'linear',
                                    }}
                                >
                                    {['🎂', '🎉', '🎁', '✨', '💖', '🌟', '🎈'][i % 7]}
                                </motion.div>
                            ))}
                        </div>
                    )}

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="relative max-w-4xl w-full bg-gradient-to-br from-rose-50 to-pink-50 rounded-3xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur-sm rounded-full p-2 text-rose-600 hover:text-rose-800 hover:bg-white transition-all shadow-lg"
                        >
                            <X size={24} />
                        </button>

                        {/* Header */}
                        <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 p-6 text-center">
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                }}
                            >
                                <h2 className="text-3xl font-serif text-white mb-2">
                                    🎂 Para Ti, Landa 💖
                                </h2>
                            </motion.div>
                            <p className="text-white/90 text-sm">
                                Momentos especiales capturados con amor
                            </p>
                        </div>

                        {/* Photo Gallery */}
                        <div className="relative aspect-video bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center overflow-hidden">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center gap-4">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        className="text-4xl"
                                    >
                                        ✨
                                    </motion.div>
                                    <p className="text-rose-600 font-semibold">Cargando recuerdos...</p>
                                </div>
                            ) : photos.length === 0 ? (
                                <div className="text-center p-8">
                                    <p className="text-rose-600 text-lg mb-2">💖</p>
                                    <p className="text-rose-700">Pronto habrá fotos especiales aquí</p>
                                </div>
                            ) : (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentIndex}
                                    initial={{ opacity: 0, x: 100 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    className="w-full h-full flex items-center justify-center p-8"
                                >
                                    <img
                                        src={photos[currentIndex].url}
                                        alt={`Memory ${currentIndex + 1}`}
                                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                                    />
                                </motion.div>
                            </AnimatePresence>
                            )}

                            {/* Navigation buttons */}
                            {!loading && photos.length > 1 && (
                                <>
                                    <button
                                        onClick={handlePrev}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 text-rose-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 text-rose-600 hover:bg-white hover:scale-110 transition-all shadow-lg"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}

                            {/* Counter */}
                            {!loading && photos.length > 0 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-rose-700 font-semibold shadow-lg">
                                {currentIndex + 1} / {photos.length}
                            </div>
                            )}
                        </div>

                        {/* Caption */}
                        {!loading && photos.length > 0 && (
                        <div className="p-6 text-center">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-center gap-2"
                            >
                                <Heart className="text-rose-500" size={20} />
                                <p className="text-lg text-rose-700 font-serif italic">
                                    {photos[currentIndex]?.caption || 'Un momento especial 💖'}
                                </p>
                                <Heart className="text-rose-500" size={20} />
                            </motion.div>
                        </div>
                        )}

                        {/* Footer message */}
                        <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 border-t-2 border-rose-200">
                            <p className="text-center text-rose-700 leading-relaxed">
                                Feliz cumpleaños. Estos son solo algunos de los momentos mágicos que hemos vivido juntos. 
                                Que este nuevo año esté lleno de más aventuras, risas y amor. Te quiero. 💖✨
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BirthdayGalleryModal;
