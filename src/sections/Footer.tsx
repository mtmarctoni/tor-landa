"use client"

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

import EasterEggModal from '@/components/EasterEggModal';
import FloatingIcons from '@/components/FloatingIcons';

const Footer: React.FC = () => {
    const [showEasterEgg, setShowEasterEgg] = useState(false);
    const handleClick = () => setShowEasterEgg(true);
    const handleClose = () => setShowEasterEgg(false);

    return (
        <footer className="py-8 px-4 bg-gradient-to-r from-white/80 via-dream-100/90 to-dream-200/80 shadow-[0_2px_24px_#38bdf855] backdrop-blur-lg border-t border-dream-200/40">
            <div className="container mx-auto text-center relative min-h-[120px]">
                {/* Scattered Surreal Icons */}
                <FloatingIcons />
                {/* Sparkles icon triggers the easter egg */}
                <motion.button
                    className="absolute text-dream-400 hover:bg-dream-200 rounded-full p-2 transition z-10"
                    style={{ transform: 'translate(-50%, 50%)' }}
                    whileHover={{ scale: 1.5, rotate: 0 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClick}
                    aria-label="Sparkles Easter Egg"
                    animate={{
                        x: [0, 34, 100, -20, 50, 0, 20, 0],
                        y: [0, 30, 100, 20, 40, 0, -1, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        repeatType: 'loop',
                        ease: 'easeInOut',
                        delay: 0.7,
                    }}
                >
                    <Sparkles size={36} strokeWidth={2.5} className="animate-pulse" />
                </motion.button>


                <p className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-base justify-center align-middle text-dream-800 font-semibold z-20">
                    Capturando momentos en el paisaje onírico del tiempo
                </p>
            </div>
            {/* Easter Egg Modal */}
            {showEasterEgg && <EasterEggModal onClose={handleClose} />}
        </footer>
    );
}

export default Footer;
