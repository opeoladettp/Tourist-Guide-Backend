/**
 * Calendar date utilities for Gregorian and Islamic dates
 * This is a simplified implementation for demonstration purposes
 */

export interface CalendarDate {
  gregorian: Date;
  islamic?: string; // Simplified Islamic date representation
}

/**
 * Convert Gregorian date to Islamic date (simplified)
 * In a real implementation, you would use a proper Islamic calendar library
 */
export function gregorianToIslamic(gregorianDate: Date): string {
  // This is a very simplified approximation
  // In reality, you would use a proper Islamic calendar conversion library
  const islamicYear = gregorianDate.getFullYear() - 579; // Rough approximation
  const islamicMonth = getIslamicMonthName(gregorianDate.getMonth() + 1);
  const islamicDay = gregorianDate.getDate();
  
  return `${islamicDay} ${islamicMonth} ${islamicYear} AH`;
}

/**
 * Get Islamic month name (simplified mapping)
 */
function getIslamicMonthName(gregorianMonth: number): string {
  const islamicMonths = [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Shaban',
    'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah'
  ];
  
  // This is a simplified mapping - in reality, Islamic months don't align with Gregorian months
  return islamicMonths[(gregorianMonth - 1) % 12];
}

/**
 * Format date for display with both Gregorian and Islamic dates
 */
export function formatCalendarDate(date: Date, includeIslamic: boolean = true): CalendarDate {
  const result: CalendarDate = {
    gregorian: date
  };
  
  if (includeIslamic) {
    result.islamic = gregorianToIslamic(date);
  }
  
  return result;
}

/**
 * Get date range string
 */
export function formatDateRange(startDate: Date, endDate: Date, includeIslamic: boolean = true): string {
  const start = formatCalendarDate(startDate, includeIslamic);
  const end = formatCalendarDate(endDate, includeIslamic);
  
  let result = `${start.gregorian.toLocaleDateString()} - ${end.gregorian.toLocaleDateString()}`;
  
  if (includeIslamic && start.islamic && end.islamic) {
    result += ` (${start.islamic} - ${end.islamic})`;
  }
  
  return result;
}

/**
 * Check if a date falls within Hajj season (simplified)
 */
export function isHajjSeason(date: Date): boolean {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  const day = date.getDate();
  
  // Simplified check for Hajj season (typically around August-September)
  // In reality, this would be based on the Islamic calendar
  return (month === 8 && day >= 15) || (month === 9 && day <= 15);
}

/**
 * Check if a date falls within Ramadan (simplified)
 */
export function isRamadan(date: Date): boolean {
  // This is a very simplified check
  // In reality, Ramadan dates change each year based on the Islamic calendar
  const month = date.getMonth() + 1;
  return month === 4; // Simplified assumption
}

/**
 * Get Islamic holidays for a given Gregorian year (simplified)
 */
export function getIslamicHolidays(year: number): { name: string; date: Date; islamicDate: string }[] {
  // This is a simplified implementation
  // In reality, you would calculate these based on the Islamic calendar
  return [
    {
      name: 'Eid al-Fitr',
      date: new Date(year, 4, 15), // Simplified date
      islamicDate: '1 Shawwal'
    },
    {
      name: 'Eid al-Adha',
      date: new Date(year, 7, 20), // Simplified date
      islamicDate: '10 Dhu al-Hijjah'
    },
    {
      name: 'Islamic New Year',
      date: new Date(year, 8, 1), // Simplified date
      islamicDate: '1 Muharram'
    }
  ];
}