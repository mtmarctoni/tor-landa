import { Cloud, Moon, Stars, Sun, Rainbow, CloudRain, CloudSnow, CloudLightning, CloudFog } from 'lucide-react';
import { type IconConfig } from '@/types';


export const ICONS: IconConfig[] = [
    {
        key: 'cloud',
        Icon: Cloud,
        className: 'absolute left-6 top-2 text-dream-500',
        hover: { scale: 1.3, rotate: 10 },
        label: 'Cloud',
    },
    {
        key: 'moon',
        Icon: Moon,
        className: 'absolute right-10 top-4 text-dream-700',
        hover: { scale: 1.3, rotate: -10 },
        label: 'Moon',
    },
    {
        key: 'stars',
        Icon: Stars,
        className: 'absolute left-1/4 bottom-2 text-dream-400',
        hover: { scale: 1.3, rotate: 8 },
        label: 'Stars',
    },
    {
        key: 'sun',
        Icon: Sun,
        className: 'absolute right-1/4 bottom-4 text-dream-600',
        hover: { scale: 1.3, rotate: 12 },
        label: 'Sun',
    },
    {
        key: 'rainbow',
        Icon: Rainbow,
        className: 'absolute left-1/2 top-0 text-dream-800',
        hover: { scale: 1.3, rotate: -8 },
        label: 'Rainbow',
        style: { transform: 'translateX(-50%)' },
    },
    {
        key: 'cloudrain',
        Icon: CloudRain,
        className: 'absolute left-1/3 top-8 text-dream-400',
        hover: { scale: 1.3, rotate: 6 },
        label: 'CloudRain',
    },
    {
        key: 'cloudsnow',
        Icon: CloudSnow,
        className: 'absolute right-1/3 top-10 text-dream-700',
        hover: { scale: 1.3, rotate: -6 },
        label: 'CloudSnow',
    },
    {
        key: 'cloudlightning',
        Icon: CloudLightning,
        className: 'absolute left-1/5 bottom-8 text-dream-600',
        hover: { scale: 1.3, rotate: 4 },
        label: 'CloudLightning',
    },
    {
        key: 'cloudfog',
        Icon: CloudFog,
        className: 'absolute right-1/5 bottom-6 text-dream-800',
        hover: { scale: 1.3, rotate: -4 },
        label: 'CloudFog',
    },
];
