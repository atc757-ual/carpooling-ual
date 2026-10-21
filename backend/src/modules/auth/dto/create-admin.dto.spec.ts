import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAdminDto } from './create-admin.dto';

// Comprueba que PickType copia las reglas de RegisterDto (name y email)
describe('CreateAdminDto', () => {
  function invalidFields(values: object): string[] {
    return validateSync(plainToInstance(CreateAdminDto, values)).map(
      ({ property }) => property,
    );
  }

  it('accepts a name and an email', () => {
    expect(invalidFields({ name: 'Ana García', email: 'ana@ual.es' })).toEqual(
      [],
    );
  });

  it('applies the registration rules: trimmed name and valid email', () => {
    expect(invalidFields({ name: '   ', email: 'not-an-email' })).toEqual([
      'name',
      'email',
    ]);
  });

  it('requires both arguments', () => {
    expect(invalidFields({})).toEqual(['name', 'email']);
  });
});
