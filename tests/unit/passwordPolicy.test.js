import { describe, it, expect } from 'vitest';
import { validatePassword, passwordPolicyMessage, PASSWORD_POLICY } from '../../src/auth/passwordPolicy.js';

describe('validatePassword', () => {
  it('rejects an empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.checks.length).toBe(false);
  });

  it('rejects a password missing each individual requirement', () => {
    expect(validatePassword('alllowercase123!!').checks.upper).toBe(false);
    expect(validatePassword('ALLUPPERCASE123!!').checks.lower).toBe(false);
    expect(validatePassword('NoNumbersHere!!!!!').checks.number).toBe(false);
    expect(validatePassword('NoSymbolsHere12345').checks.symbol).toBe(false);
    expect(validatePassword('Short1!').checks.length).toBe(false);
  });

  it('accepts a password meeting every requirement', () => {
    const result = validatePassword('Str0ng!Passw0rd#');
    expect(result.valid).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
  });

  it('accepts Greek letters for the upper/lower checks', () => {
    const result = validatePassword('Καλημέρα123!@#');
    expect(result.checks.upper).toBe(true);
    expect(result.checks.lower).toBe(true);
  });

  it('enforces the minimum length constant, not a hardcoded number', () => {
    const justUnderMin = 'A1!'.padEnd(PASSWORD_POLICY.minLength - 1, 'a');
    const exactlyMin = 'A1!'.padEnd(PASSWORD_POLICY.minLength, 'a');
    expect(validatePassword(justUnderMin).checks.length).toBe(false);
    expect(validatePassword(exactlyMin).checks.length).toBe(true);
  });
});

describe('passwordPolicyMessage', () => {
  it('returns a Greek message by default', () => {
    expect(passwordPolicyMessage()).toMatch(/χαρακτήρες/);
  });

  it('returns an English message when locale is "en"', () => {
    expect(passwordPolicyMessage('en')).toMatch(/characters/);
  });
});
