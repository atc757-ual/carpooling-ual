import { FormControl } from '@angular/forms';
import {
  formatPersonName,
  normalizePersonName,
  personNameValidator,
  stripNameSymbols,
} from './person-name.util';

describe('person name util', () => {
  const validate = (name: string) => personNameValidator()(new FormControl(name));

  it.each(['María Núñez', 'Ana-María', "Seán O'Connor", 'Zoë Çelik', '  Ana   García '])(
    'accepts %s',
    (name) => {
      expect(validate(name)).toBeNull();
    },
  );

  it.each(['Ana 2', 'Ana_García!', '-Ana', 'Ana--María', 'ana@ual.es'])('rejects %s', (name) => {
    expect(validate(name)).toEqual({ personName: true });
  });

  it('leaves the empty value to Validators.required', () => {
    expect(validate('   ')).toBeNull();
  });

  it('removes digits and symbols while typing, but keeps letters, spaces, hyphens and apostrophes', () => {
    expect(stripNameSymbols("Ana_María 2 O'Connor-Núñez!")).toBe("AnaMaría  O'Connor-Núñez");
  });

  it('joins separate accents and extra spaces like the API', () => {
    expect(normalizePersonName('  María   Pérez ')).toBe('María Pérez');
  });

  it('capitalizes each part and preserves accents for display', () => {
    expect(formatPersonName('  ANA  GARCÍA pérez ')).toBe('Ana García Pérez');
  });

  it('capitalizes hyphenated names for display', () => {
    expect(formatPersonName('MARÍA-JOSÉ')).toBe('María-José');
  });
});
