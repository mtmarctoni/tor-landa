import React from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { Photo } from '@/types';

interface PhotoCaptionProps {
    photo: Photo;
    currentIndex: number;
}

const PhotoCaption: React.FC<PhotoCaptionProps> = ({ photo, currentIndex }) => {
    return (
        <div className="p-6 text-center">
            <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2"
            >
                <Heart className="text-rose-500" size={20} />
                <p className="text-lg text-rose-700 font-serif italic">
                    {photo?.caption || 'Un momento especial 💖'}
                </p>
                <Heart className="text-rose-500" size={20} />
            </motion.div>
        </div>
    );
};

export default PhotoCaption;