import { describe, it, expect } from 'vitest';
import { 
  gregorianToIslamic, 
  formatCalendarDate, 
  formatDateRange,
  isHajjSeason,
  isRamadan,
  getIslamicHolidays
} from '../../utils/calendar';

describe('Calendar Utilities', () => {
  describe('gregorianToIslamic', () => {
    it('should convert Gregorian date to Islamic date format', () => {
      const gregorianDate = new Date('2024-01-01');
      const islamicDate = gregorianToIslamic(gregorianDate);
      
      expect(islamicDate).toContain('AH');
      expect(islamicDate).toContain('1');
      expect(islamicDate).toContain('Muharram');
    });

    it('should handle different months', () => {
      const gregorianDate = new Date('2024-06-15');
      const islamicDate = gregorianToIslamic(gregorianDate);
      
      expect(islamicDate).toContain('AH');
      expect(islamicDate).toContain('15');
    });
  });

  describe('formatCalendarDate', () => {
    it('should format date with Gregorian only', () => {
      const date = new Date('2024-01-01');
      const formatted = formatCalendarDate(date, false);
      
      expect(formatted.gregorian).toEqual(date);
      expect(formatted.islamic).toBeUndefined();
    });

    it('should format date with both Gregorian and Islamic', () => {
      const date = new Date('2024-01-01');
      const formatted = formatCalendarDate(date, true);
      
      expect(formatted.gregorian).toEqual(date);
      expect(formatted.islamic).toBeDefined();
      expect(formatted.islamic).toContain('AH');
    });
  });

  describe('formatDateRange', () => {
    it('should format date range with Gregorian dates', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-15');
      const formatted = formatDateRange(startDate, endDate, false);
      
      expect(formatted).toContain('1/1/2024');
      expect(formatted).toContain('1/15/2024');
      expect(formatted).toContain('-');
    });

    it('should format date range with Islamic dates', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-15');
      const formatted = formatDateRange(startDate, endDate, true);
      
      expect(formatted).toContain('AH');
      expect(formatted).toContain('-');
    });
  });

  describe('isHajjSeason', () => {
    it('should identify dates in Hajj season', () => {
      const hajjDate = new Date('2024-08-20');
      expect(isHajjSeason(hajjDate)).toBe(true);
    });

    it('should identify dates outside Hajj season', () => {
      const nonHajjDate = new Date('2024-01-01');
      expect(isHajjSeason(nonHajjDate)).toBe(false);
    });

    it('should handle edge cases', () => {
      const edgeDate1 = new Date('2024-08-15');
      const edgeDate2 = new Date('2024-09-15');
      
      expect(isHajjSeason(edgeDate1)).toBe(true);
      expect(isHajjSeason(edgeDate2)).toBe(true);
    });
  });

  describe('isRamadan', () => {
    it('should identify dates in Ramadan', () => {
      const ramadanDate = new Date('2024-04-15');
      expect(isRamadan(ramadanDate)).toBe(true);
    });

    it('should identify dates outside Ramadan', () => {
      const nonRamadanDate = new Date('2024-01-01');
      expect(isRamadan(nonRamadanDate)).toBe(false);
    });
  });

  describe('getIslamicHolidays', () => {
    it('should return Islamic holidays for a given year', () => {
      const holidays = getIslamicHolidays(2024);
      
      expect(holidays).toHaveLength(3);
      expect(holidays.some(h => h.name === 'Eid al-Fitr')).toBe(true);
      expect(holidays.some(h => h.name === 'Eid al-Adha')).toBe(true);
      expect(holidays.some(h => h.name === 'Islamic New Year')).toBe(true);
    });

    it('should include proper Islamic date information', () => {
      const holidays = getIslamicHolidays(2024);
      
      holidays.forEach(holiday => {
        expect(holiday.name).toBeDefined();
        expect(holiday.date).toBeInstanceOf(Date);
        expect(holiday.islamicDate).toBeDefined();
      });
    });

    it('should handle different years', () => {
      const holidays2023 = getIslamicHolidays(2023);
      const holidays2024 = getIslamicHolidays(2024);
      
      expect(holidays2023).toHaveLength(3);
      expect(holidays2024).toHaveLength(3);
      
      // Years should be different
      expect(holidays2023[0].date.getFullYear()).toBe(2023);
      expect(holidays2024[0].date.getFullYear()).toBe(2024);
    });
  });
});