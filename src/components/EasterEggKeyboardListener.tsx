"use client";

import React, { useEffect, useState } from 'react';
import AmorEasterEggModal from './AmorEasterEggModal';

const targetSequence = ['a', 'm', 'o', 'r']; // "AMOR" sequence
const sequenceTimeout = 3000; // 3 seconds timeout between keys

const EasterEggKeyboardListener: React.FC = () => {
    const [showEasterEgg, setShowEasterEgg] = useState(false);
    const [keySequence, setKeySequence] = useState<string[]>([]);
    const [lastKeyTime, setLastKeyTime] = useState<number>(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only listen for letter keys, ignore if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const key = e.key.toLowerCase();
            const currentTime = Date.now();
            
            // Reset sequence if too much time has passed since last key
            if (currentTime - lastKeyTime > sequenceTimeout) {
                setKeySequence([]);
            }
            
            setLastKeyTime(currentTime);
            
            // Check if this key is the next expected key in the sequence
            const nextExpectedKey = targetSequence[keySequence.length];
            
            if (key === nextExpectedKey) {
                const newSequence = [...keySequence, key];
                setKeySequence(newSequence);
                
                // Check if sequence is complete
                if (newSequence.length === targetSequence.length) {
                    setShowEasterEgg(true);
                    setKeySequence([]); // Reset for next time
                }
            } else if (key === targetSequence[0]) {
                // If they pressed the first key, start over
                setKeySequence([key]);
            } else {
                // Wrong key, reset sequence
                setKeySequence([]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keySequence, lastKeyTime]);

    const handleClose = () => {
        setShowEasterEgg(false);
    };

    return (
        <>
            {showEasterEgg && <AmorEasterEggModal onClose={handleClose} />}
        </>
    );
};

export default EasterEggKeyboardListener;