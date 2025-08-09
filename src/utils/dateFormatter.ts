export const format = (date: Date): string => {
    return new Intl.DateTimeFormat('es-ES', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
};

export const getCurrentWeekAndYear = () => {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return { week, year: now.getFullYear() };
}
