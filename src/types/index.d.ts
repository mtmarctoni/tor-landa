import type { TargetAndTransition, VariantLabels } from 'framer-motion';

export interface QualityEntry {
    week: number;
    year: number;
    message: string;
}

export interface Photo {
    url: string;
    caption: string;
}

export type IconConfig = {
    key: string;
    Icon: React.ComponentType<{ size: number; strokeWidth: number }>;
    className: string;
    hover: TargetAndTransition | VariantLabels;
    label: string;
    style?: React.CSSProperties;
    onClick?: () => void;
};

export interface ColorCombo {
    border: string;
    shadow: string;
    bg: string;
}
