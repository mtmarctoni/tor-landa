import React from 'react';
import { ICONS } from '../utils/footerIcons';
import { motion } from 'framer-motion';

export type SurrealFooterIconProps = {
    icon: typeof ICONS[number];
    idx: number;
};

const SurrealFooterIcon: React.FC<SurrealFooterIconProps> = ({ icon, idx }) => {
    const { key, Icon, className, hover, label, style, onClick } = icon;
    return (
        <motion.button
            key={key}
            className={className + ' bg-white/10 rounded-full hover:bg-dream-100 transition z-10'}
            whileHover={hover}
            whileTap={{ scale: 0.95 }}
            aria-label={label}
            style={style}
            onClick={onClick}
            animate={{
                x: [
                    0,
                    idx % 2 === 0 ? 40 : -40,
                    idx % 2 === 0 ? 60 : -60,
                    idx % 2 === 0 ? -30 : 30,
                    idx % 2 === 0 ? -50 : 50,
                    0,
                    idx % 2 === 0 ? 20 : -20,
                    0,
                ],
                y: [
                    0,
                    idx % 3 === 0 ? -30 : 30,
                    idx % 3 === 0 ? -50 : 50,
                    idx % 3 === 0 ? 20 : -20,
                    idx % 3 === 0 ? 40 : -40,
                    0,
                    idx % 3 === 0 ? -10 : 10,
                    0,
                ],
            }}
            transition={{
                duration: 12 + idx * 1.5,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'easeInOut',
                delay: idx * 0.7,
            }}
        >
            <Icon size={32} strokeWidth={2.2} />
        </motion.button>
    );
};

const FloatingIcons: React.FC = () => {
    return (
        <>
            {ICONS.map((icon, idx) => (
                <SurrealFooterIcon icon={icon} idx={idx} key={icon.key} />
            ))}
        </>
    );
};

export default FloatingIcons;
