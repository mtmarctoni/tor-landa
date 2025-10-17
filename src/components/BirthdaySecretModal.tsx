"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Sparkles } from 'lucide-react';
import type { BirthdaySecretModalProps } from '@/types/components';

const PASSWORD = '2329';

const BirthdaySecretModal: React.FC<BirthdaySecretModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [error, setError] = useState('');
    const [isShaking, setIsShaking] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.toLowerCase().trim() === PASSWORD) {
            setError('');
            onSuccess();
            setPassword('');
            setAttempts(0);
        } else {
            setAttempts(prev => prev + 1);
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
            
            if (attempts >= 2) {
                setError('Casi lo logras... tal vez mañana tengas más suerte 💫');
                setTimeout(() => {
                    onClose();
                    setPassword('');
                    setAttempts(0);
                    setError('');
                }, 3000);
            } else {
                setError('Mmm... no es esa. Piensa en un lugar especial ✨');
                setPassword('');
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ 
                            scale: 1, 
                            opacity: 1, 
                            y: 0,
                            x: isShaking ? [-10, 10, -10, 10, 0] : 0
                        }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative max-w-md w-full bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 rounded-3xl shadow-2xl border-2 border-rose-200 p-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-rose-400 hover:text-rose-600 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        {/* Header */}
                        <motion.div
                            className="text-center mb-6"
                            animate={{
                                y: [0, -5, 0],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            <div className="flex justify-center mb-4">
                                <div className="relative">
                                    <Lock size={48} className="text-rose-400" />
                                    <motion.div
                                        className="absolute -top-2 -right-2"
                                        animate={{
                                            rotate: [0, 360],
                                            scale: [1, 1.2, 1]
                                        }}
                                        transition={{
                                            duration: 3,
                                            repeat: Infinity,
                                        }}
                                    >
                                        <Sparkles size={24} className="text-amber-400" />
                                    </motion.div>
                                </div>
                            </div>
                            <h2 className="text-3xl font-serif text-rose-700 mb-2">
                                El Secreto de Landa
                            </h2>
                            <p className="text-rose-600 text-sm">
                                Descubre algo especial preparado solo para ti
                            </p>
                        </motion.div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-rose-700 mb-2">
                                    ¿Cuál es el código secreto? ✨
                                </label>
                                <input
                                    type="text"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Escribe aquí..."
                                    className="w-full px-4 py-3 rounded-xl border-2 border-rose-200 focus:border-rose-400 focus:outline-none bg-white/80 text-rose-900 placeholder-rose-300 transition-colors"
                                    autoFocus
                                    disabled={attempts >= 3}
                                />
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-sm text-rose-600 text-center bg-rose-100 rounded-lg p-3"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <motion.button
                                type="submit"
                                disabled={attempts >= 3 || !password.trim()}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {attempts >= 3 ? 'Intentos agotados' : 'Descubrir el secreto'}
                            </motion.button>

                            <p className="text-xs text-center text-rose-400">
                                Pista: El mensaje tiene la respuesta 💫
                            </p>
                        </form>

                        {/* Decorative elements */}
                        <div className="absolute -top-3 -left-3 text-4xl">🎁</div>
                        <div className="absolute -bottom-3 -right-3 text-4xl">✨</div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BirthdaySecretModal;
