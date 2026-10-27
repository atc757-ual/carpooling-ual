import { formatAddress, formatLocality, toTitleCase } from './address-format';

describe('address format', () => {
  it('writes the name as it reads, with the particles in lower case', () => {
    expect(toTitleCase('AVENIDA DEL MEDITERRANEO')).toBe(
      'Avenida del Mediterraneo',
    );
    expect(toTitleCase('LA CAÑADA DE SAN URBANO')).toBe(
      'La Cañada de San Urbano',
    );
  });

  it('moves the particle before the name and adds the number', () => {
    expect(
      formatAddress({
        streetType: 'AVENIDA',
        streetName: 'MEDITERRANEO (DEL)',
        portalNumber: 120,
      }),
    ).toBe('Avenida del Mediterraneo, 120');
  });

  it('keeps a bracket that is not a particle, and leaves out a missing number', () => {
    expect(
      formatAddress({
        streetType: 'CALLE',
        streetName: 'SACRAMENTO (CARRETERA)',
        portalNumber: null,
      }),
    ).toBe('Calle Sacramento (Carretera)');
  });

  it('names the town with its municipality only when they differ', () => {
    expect(formatLocality('La Cañada de San Urbano', 'Almería')).toBe(
      'La Cañada de San Urbano (Almería)',
    );
    expect(formatLocality('Almería', 'Almería')).toBe('Almería');
  });
});
