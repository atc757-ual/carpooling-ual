import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAdminDto } from './create-admin.dto';

// Comprueba que PickType copia las reglas de RegisterDto (nombre, apellidos
// y correo)
describe('CreateAdminDto', () => {
  function invalidFields(values: object): string[] {
    return validateSync(plainToInstance(CreateAdminDto, values)).map(
      ({ property }) => property,
    );
  }

  it('accepts a first name, the surnames and an email', () => {
    expect(
      invalidFields({
        firstName: 'Ana',
        lastName: 'García de la Fuente',
        email: 'ana@ual.es',
      }),
    ).toEqual([]);
  });

  it('applies the registration rules: trimmed names and valid email', () => {
    expect(
      invalidFields({ firstName: '   ', lastName: 'G4rcía', email: 'nope' }),
    ).toEqual(['firstName', 'lastName', 'email']);
  });

  it('requires all the arguments', () => {
    expect(invalidFields({})).toEqual(['firstName', 'lastName', 'email']);
  });
});
