import { FormControl } from '@angular/forms';
import { normalizePhone, phoneValidator } from './phone.util';

describe('phone util', () => {
  const validate = (phone: string) => phoneValidator()(new FormControl(phone));

  it.each([
    ['612 345 678', '+34612345678'],
    ['912-34-56-78', '+34912345678'],
    ['+34 (600) 12-34 56', '+34600123456'],
    ['+39 333 123 4567', '+393331234567'],
    ['0039 333 123 4567', '+393331234567'],
  ])('turns %s into %s', (phone, normalized) => {
    expect(normalizePhone(phone)).toBe(normalized);
  });

  it.each(['612 345 678', '+34 612 345 678', '+44 20 7946 0958', '0049 151 2345 6789'])(
    'accepts %s',
    (phone) => {
      expect(validate(phone)).toBeNull();
    },
  );

  it.each(['512 345 678', '61234567', '+34 6', '+34 600 abc 456'])('rejects %s', (phone) => {
    expect(validate(phone)).toEqual({ phone: true });
  });

  it('leaves the empty value to Validators.required', () => {
    expect(validate('')).toBeNull();
  });
});
