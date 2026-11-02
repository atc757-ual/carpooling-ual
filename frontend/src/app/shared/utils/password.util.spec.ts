import { FormControl } from '@angular/forms';
import { NEW_PASSWORD_VALIDATORS, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password.util';

describe('password.util', () => {
  function isValid(password: string): boolean {
    return new FormControl(password, NEW_PASSWORD_VALIDATORS).valid;
  }

  it('accepts from 8 to 72 characters, like the API', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(72);
    expect(isValid('')).toBe(false);
    expect(isValid('a'.repeat(7))).toBe(false);
    expect(isValid('a'.repeat(8))).toBe(true);
    expect(isValid('a'.repeat(72))).toBe(true);
    expect(isValid('a'.repeat(73))).toBe(false);
  });
});
