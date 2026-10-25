import { FormControl } from '@angular/forms';
import { getUalEmailErrorText, ualEmailValidator } from './ual-email.util';

describe('ualEmailValidator', () => {
  const validate = (email: string) =>
    ualEmailValidator(['ual.es', 'inlumine.ual.es'])(new FormControl(email));

  it.each(['ana@ual.es', 'ana@inlumine.ual.es', 'Ana@UAL.ES', ' ana@ual.es '])(
    'accepts %s',
    (email) => {
      expect(validate(email)).toBeNull();
    },
  );

  it.each(['ana@gmail.com', 'ana@fakeual.es', 'ana@ual.es.atacante.com', 'ana@'])(
    'rejects %s',
    (email) => {
      expect(validate(email)).toEqual({ ualEmail: true });
    },
  );

  it('leaves empty values and values without @ to the other validators', () => {
    expect(validate('')).toBeNull();
    expect(validate('no-es-un-correo')).toBeNull();
  });

  it('uses the domains of the environment by default', () => {
    expect(ualEmailValidator()(new FormControl('ana@inlumine.ual.es'))).toBeNull();
  });
});

describe('getUalEmailErrorText', () => {
  it('explains the domain or the format', () => {
    expect(
      getUalEmailErrorText(new FormControl('ana@gmail.com', ualEmailValidator(['ual.es']))),
    ).toBe('Usa tu correo de la Universidad de Almería.');
    expect(getUalEmailErrorText(new FormControl('no-es-un-correo'))).toBe(
      'Introduce un correo válido.',
    );
  });
});
