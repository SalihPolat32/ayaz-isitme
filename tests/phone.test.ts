import { describe, it, expect } from 'vitest';
import { normalizeTrPhone, isValidName } from '../src/scripts/phone';

describe('normalizeTrPhone', () => {
  it('normalises common Turkish formats to E.164', () => {
    expect(normalizeTrPhone('0507 155 11 51')).toBe('+905071551151');
    expect(normalizeTrPhone('+90 507 155 11 51')).toBe('+905071551151');
    expect(normalizeTrPhone('5071551151')).toBe('+905071551151');
    expect(normalizeTrPhone('00905071551151')).toBe('+905071551151');
    expect(normalizeTrPhone('(0312) 123 45 67')).toBe('+903121234567');
  });
  it('rejects invalid numbers', () => {
    expect(normalizeTrPhone('123')).toBeNull();
    expect(normalizeTrPhone('0507 155 11')).toBeNull();
    expect(normalizeTrPhone('+44 20 7946 0958')).toBeNull();
    expect(normalizeTrPhone('abc')).toBeNull();
    expect(normalizeTrPhone('')).toBeNull();
  });
});

describe('isValidName', () => {
  it('accepts Turkish names', () => {
    expect(isValidName('Emre Dağlıoğlu')).toBe(true);
    expect(isValidName("Ayşe Şükran O'Neil-Çelik")).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidName('A')).toBe(false);
    expect(isValidName('http://spam')).toBe(false);
    expect(isValidName('1234')).toBe(false);
    expect(isValidName('x'.repeat(81))).toBe(false);
  });
});

it('uses the same validation as the API for pasted input', () => {
  expect(normalizeTrPhone('abc05071551151')).toBeNull();
  expect(normalizeTrPhone('5555555555')).toBeNull();
  expect(isValidName('A.')).toBe(false);
  expect(isValidName('O’Neil')).toBe(true);
});
