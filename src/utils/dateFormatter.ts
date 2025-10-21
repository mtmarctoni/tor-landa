export const format = (date: Date): string => {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const getCurrentWeekAndYear = () => {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
  );
  return { week, year: now.getFullYear() };
};

export const getWeekFromDate = (date: Date) => {
  const onejan = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((date.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
  );
  return { week, year: date.getFullYear() };
};

// Landa's birthday utilities
export const LANDA_BIRTHDAY = {
  month: 10, // October
  day: 23,
};

export const getLandaBirthdayWeek = (year: number) => {
  const birthdayDate = new Date(
    year,
    LANDA_BIRTHDAY.month - 1,
    LANDA_BIRTHDAY.day
  );
  return getWeekFromDate(birthdayDate);
};

export const isLandaBirthdayWeek = (week: number, year: number) => {
  const birthdayWeek = getLandaBirthdayWeek(year);
  const isCorrectWeek =
    week === birthdayWeek.week && year === birthdayWeek.year;

  // Only show birthday message from October 23rd onwards
  if (isCorrectWeek) {
    const today = new Date();
    const birthdayDate = new Date(
      year,
      LANDA_BIRTHDAY.month - 1,
      LANDA_BIRTHDAY.day
    );
    return today >= birthdayDate;
  }

  return false;
};

export const isLandaBirthday = (date = new Date()) => {
  return (
    date.getMonth() + 1 === LANDA_BIRTHDAY.month &&
    date.getDate() === LANDA_BIRTHDAY.day
  );
};

export const getDaysUntilLandaBirthday = (currentDate = new Date()) => {
  const currentYear = currentDate.getFullYear();
  const birthdayThisYear = new Date(
    currentYear,
    LANDA_BIRTHDAY.month - 1,
    LANDA_BIRTHDAY.day
  );

  // If birthday has passed this year, calculate for next year
  if (currentDate > birthdayThisYear) {
    const birthdayNextYear = new Date(
      currentYear + 1,
      LANDA_BIRTHDAY.month - 1,
      LANDA_BIRTHDAY.day
    );
    return Math.ceil(
      (birthdayNextYear.getTime() - currentDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }

  return Math.ceil(
    (birthdayThisYear.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
};
