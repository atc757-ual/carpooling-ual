import { initAppTranslations } from '../../core/i18n/testing-transloco';
import { formatPlate, vehicleDisplayName, vehicleSpecs } from './vehicle-display.util';

describe('vehicle-display.util', () => {
  beforeEach(() => initAppTranslations());

  it('builds vehicleDisplayName from brand/model, falling back to plate or Coche', () => {
    expect(vehicleDisplayName({ brand: 'Seat', model: 'Ibiza', plate: '1234ABC' })).toBe(
      'Seat Ibiza',
    );
    expect(vehicleDisplayName({ brand: '', model: '', plate: '1234ABC' })).toBe('1234ABC');
    expect(vehicleDisplayName({ brand: '', model: '' })).toBe('Coche');
  });

  it('formats Spanish plates with a space and keeps non-standard plates intact', () => {
    expect(formatPlate('1234BGG')).toBe('1234 BGG');
    expect(formatPlate('1234 BGG')).toBe('1234 BGG');
    expect(formatPlate('AL-1234-B')).toBe('AL-1234-B');
  });

  it('builds vehicleSpecs with and without special engine types', () => {
    expect(vehicleSpecs({ capacity: 3, engine: 'electric' }, 'Blanco')).toContain('Eléctrico');
    expect(vehicleSpecs({ capacity: 3, engine: 'hybrid' }, 'Gris')).toContain('Híbrido');
    expect(vehicleSpecs({ capacity: 3, engine: 'other' }, 'Negro')).not.toContain('undefined');
    expect(vehicleSpecs({ capacity: 2, engine: null }, 'Azul')).toContain('Azul');
  });
});
