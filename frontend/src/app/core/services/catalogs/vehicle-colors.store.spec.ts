import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../ui/theme.service';
import { CatalogsService, VehicleColorItem } from './catalogs.service';
import { VehicleColorsStore } from './vehicle-colors.store';

const COLORS: VehicleColorItem[] = [
  { key: 'blue', name: 'Azul', hexLight: '#2673c9', hexDark: '#5b9be0', isActive: true },
  { key: 'gold', name: 'Oro', hexLight: '#c9a227', hexDark: '#e0c060', isActive: false },
];

describe('VehicleColorsStore', () => {
  const isDark = signal(false);

  function create(vehicleColors: () => Promise<VehicleColorItem[]>): VehicleColorsStore {
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogsService, useValue: { vehicleColors } },
        { provide: ThemeService, useValue: { isDark } },
      ],
    });
    return TestBed.inject(VehicleColorsStore);
  }

  beforeEach(() => isDark.set(false));

  it('names and paints every color, but offers only the active ones', async () => {
    const store = create(() => Promise.resolve(COLORS));
    await Promise.resolve();

    expect(store.offered().map(({ key }) => key)).toEqual(['blue']);
    expect(store.label('gold')).toBe('Oro');
    expect(store.swatch('blue')).toBe('#2673c9');
    isDark.set(true);
    expect(store.swatch('blue')).toBe('#5b9be0');
  });

  it('says when there is no color and stays quiet for an unknown one', async () => {
    const store = create(() => Promise.resolve(COLORS));
    await Promise.resolve();

    expect(store.label(null)).toBe('Color sin indicar');
    expect(store.label('pink')).toBe('');
    expect(store.swatch(null)).toBe('transparent');
    expect(store.swatch('pink')).toBe('transparent');
  });

  it('keeps working without colors when the catalog fails', async () => {
    const store = create(() => Promise.reject(new Error('offline')));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.offered()).toEqual([]);
    expect(store.label('blue')).toBe('');
  });
});
