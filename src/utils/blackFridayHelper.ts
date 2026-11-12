/**
 * AirBus Black Friday Quarterly Date Helper
 *
 * Black Friday happens quarterly, on the LAST FRIDAY of the last month of each quarter:
 * - Q1: March
 * - Q2: June
 * - Q3: September
 * - Q4: December
 *
 * This utility dynamically computes the exact upcoming event date without hardcoding.
 */

export interface BlackFridayEvent {
  year: number;
  month: number; // 0-indexed (2=Mar, 5=Jun, 8=Sep, 11=Dec)
  monthName: string;
  quarter: number; // 1, 2, 3, 4
  eventDate: Date; // Start of Black Friday 00:00:00 local
  eventEndDate: Date; // End of Black Friday weekend (Sunday 23:59:59)
  isActive: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
  totalMsRemaining: number;
  formattedDate: string;
}

/**
 * Returns the Date of the last Friday of a given month & year
 */
export function getLastFridayOfMonth(year: number, monthIndex: number): Date {
  // Go to the last day of the month
  const lastDay = new Date(year, monthIndex + 1, 0, 0, 0, 0, 0);
  const dayOfWeek = lastDay.getDay(); // 0 = Sunday, 5 = Friday
  const diff = (dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2);
  const lastFridayDate = new Date(year, monthIndex, lastDay.getDate() - diff, 0, 0, 0, 0);
  return lastFridayDate;
}

/**
 * Calculates the next quarterly AirBus Black Friday event relative to a given date (defaults to now)
 */
export function getNextBlackFridayEvent(from: Date = new Date()): BlackFridayEvent {
  const currentYear = from.getFullYear();
  const quarterMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
  const monthNames = ['March', 'June', 'September', 'December'];

  // Check candidate quarters across this year and next year
  const candidates: { year: number; month: number; quarter: number; monthName: string; date: Date }[] = [];

  for (let y = currentYear; y <= currentYear + 1; y++) {
    for (let q = 0; q < 4; q++) {
      const m = quarterMonths[q];
      const lastFriday = getLastFridayOfMonth(y, m);
      candidates.push({
        year: y,
        month: m,
        quarter: q + 1,
        monthName: monthNames[q],
        date: lastFriday,
      });
    }
  }

  // Find the first candidate whose event period (Friday 00:00 through Sunday 23:59:59) is active or in the future
  for (const cand of candidates) {
    const start = new Date(cand.date.getTime());
    // Event runs through Sunday 23:59:59 of that weekend (3 full days)
    const end = new Date(cand.date.getTime() + (3 * 24 * 60 * 60 * 1000) - 1000);

    if (from.getTime() <= end.getTime()) {
      const isActive = from.getTime() >= start.getTime() && from.getTime() <= end.getTime();
      const diffMs = Math.max(0, start.getTime() - from.getTime());

      const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const minutesRemaining = Math.floor((diffMs / (1000 * 60)) % 60);
      const secondsRemaining = Math.floor((diffMs / 1000) % 60);

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
      const formattedDate = cand.date.toLocaleDateString('en-US', options);

      return {
        year: cand.year,
        month: cand.month,
        monthName: cand.monthName,
        quarter: cand.quarter,
        eventDate: start,
        eventEndDate: end,
        isActive,
        daysRemaining,
        hoursRemaining,
        minutesRemaining,
        secondsRemaining,
        totalMsRemaining: diffMs,
        formattedDate,
      };
    }
  }

  // Fallback (should never be reached)
  const fallbackDate = getLastFridayOfMonth(currentYear, 11);
  return {
    year: currentYear,
    month: 11,
    monthName: 'December',
    quarter: 4,
    eventDate: fallbackDate,
    eventEndDate: new Date(fallbackDate.getTime() + 3 * 864e5),
    isActive: false,
    daysRemaining: 30,
    hoursRemaining: 0,
    minutesRemaining: 0,
    secondsRemaining: 0,
    totalMsRemaining: 30 * 864e5,
    formattedDate: fallbackDate.toDateString(),
  };
}
