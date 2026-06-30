import mongoose from 'mongoose';
import {
  ageFromBirthDate,
  birthDateFromStatedAge,
  parseLocalDateFromYyyyMmDd,
  UserSchema,
} from './user.schema';
import { AccountType } from '../enums/account-type.enum';

describe('user.schema', () => {
  describe('birthDateFromStatedAge', () => {
    it('returns UTC Jan 1 of (refYear - age)', () => {
      const ref = new Date(Date.UTC(2024, 5, 15));
      const bd = birthDateFromStatedAge(10, ref);
      expect(bd.toISOString().startsWith('2014-01-01')).toBe(true);
    });
  });

  describe('parseLocalDateFromYyyyMmDd', () => {
    it('returns null for invalid strings', () => {
      expect(parseLocalDateFromYyyyMmDd('')).toBeNull();
      expect(parseLocalDateFromYyyyMmDd('2010-13-01')).toBeNull();
      expect(parseLocalDateFromYyyyMmDd('2010-02-30')).toBeNull();
    });

    it('parses valid YYYY-MM-DD in local calendar', () => {
      const d = parseLocalDateFromYyyyMmDd('2010-06-15');
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2010);
      expect(d!.getMonth()).toBe(5);
      expect(d!.getDate()).toBe(15);
    });
  });

  describe('ageFromBirthDate', () => {
    // Local calendar dates — matches getFullYear/getMonth/getDate logic in the helper.
    const ref = new Date(2026, 3, 8);

    it('returns 12 for birthDate on same calendar day 12 years earlier', () => {
      expect(ageFromBirthDate(new Date(2014, 3, 8), ref)).toBe(12);
    });

    it('returns 13 for birthDate 13 years earlier on same month/day', () => {
      expect(ageFromBirthDate(new Date(2013, 3, 8), ref)).toBe(13);
    });

    it('returns 17 for birthDate 17 years earlier', () => {
      expect(ageFromBirthDate(new Date(2009, 3, 8), ref)).toBe(17);
    });

    it('returns 18 for birthDate 18 years earlier', () => {
      expect(ageFromBirthDate(new Date(2008, 3, 8), ref)).toBe(18);
    });
  });

  describe('age virtual', () => {
    it('returns whole-year age from birthDate in toJSON', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
      try {
        const name = 'UserAgeVirtualTest';
        if (mongoose.models[name]) {
          delete mongoose.models[name];
        }

        const M = mongoose.model(name, UserSchema);
        const u = new M({
          accountType: AccountType.ManagedUser,
          birthDate: new Date(Date.UTC(2014, 6, 4)),
        });
        const j = u.toJSON() as { age?: number };
        // 2026-04-08 vs birthDate 2014-07-04 — birthday not yet in 2026
        expect(j.age).toBe(11);
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns undefined when birthDate is missing', () => {
      const name = 'UserAgeVirtualTest2';
      if (mongoose.models[name]) {
        delete mongoose.models[name];
      }

      const M = mongoose.model(name, UserSchema);
      const u = new M({ accountType: AccountType.ManagedUser });
      expect((u.toJSON() as { age?: number }).age).toBeUndefined();
    });
  });
});
