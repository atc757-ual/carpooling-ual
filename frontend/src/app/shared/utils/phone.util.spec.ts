import { FormControl, FormGroup } from '@angular/forms';
import {
  buildPhone,
  formatPhone,
  formatPhoneNumber,
  phoneNumberValidator,
  splitPhone,
  toDigits,
} from './phone.util';

describe('phone util', () => {
  // Como en el registro: el prefijo y el número en el mismo formulario
  function validate(prefix: string, number: string) {
    const form = new FormGroup({
      phonePrefix: new FormControl(prefix),
      phone: new FormControl(number, { nonNullable: true }),
    });
    return phoneNumberValidator('phonePrefix')(form.controls.phone);
  }

  it.each([
    ['+34', '612345678'],
    ['+34', '912 34 56 78'],
    ['+39', '3331234567'],
    ['+44', '2079460958'],
    ['+1', '2025550123'],
  ])('accepts %s %s', (prefix, number) => {
    expect(validate(prefix, number)).toBeNull();
  });

  it.each([
    ['+34', '512345678'],
    ['+34', '61234567'],
    ['+39', '123'],
    ['+351', '1234567890123456'],
  ])('rejects %s %s', (prefix, number) => {
    expect(validate(prefix, number)).toEqual({ phone: true });
  });

  it('leaves the empty number to Validators.required', () => {
    expect(validate('+34', '')).toBeNull();
  });

  it('keeps only the digits of the number', () => {
    expect(toDigits('612-34 (56) 78a')).toBe('612345678');
  });

  it.each([
    ['+34', '612345678', '612 345 678'],
    ['+34', '6123', '612 3'],
    ['+34', '612', '612'],
    ['+39', '3331234567', '3331234567'],
  ])('shows %s %s as «%s»', (prefix, number, shown) => {
    expect(formatPhoneNumber(prefix, number)).toBe(shown);
  });

  it('joins the prefix and the number in international format', () => {
    expect(buildPhone('+34', '612 345 678')).toBe('+34612345678');
  });

  it.each([
    ['612 345 678', '+34', { prefix: '+34', number: '612345678' }],
    ['+39 333 123 4567', '+34', { prefix: '+39', number: '3331234567' }],
    ['0044 20 7946 0958', '+34', { prefix: '+44', number: '2079460958' }],
    ['+351 912 345 678', '+34', { prefix: '+351', number: '912345678' }],
    ['+999 123', '+34', { prefix: '+34', number: '999123' }],
  ])('splits %s pasted with %s selected', (value, currentPrefix, split) => {
    expect(splitPhone(value, currentPrefix)).toEqual(split);
  });

  it('formats a saved phone to read it', () => {
    expect(formatPhone('+34612345678')).toBe('+34 612 345 678');
    expect(formatPhone('+351912345678')).toBe('+351 912345678');
  });
});
