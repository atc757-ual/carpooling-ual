import { provideAppTransloco } from '../../i18n/testing-transloco';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../ui/language.service';
import { ThemeService } from '../ui/theme.service';
import { CatalogsService, VehicleColorItem } from './catalogs.service';
import { VehicleColorsStore } from './vehicle-colors.store';

const COLORS: VehicleColorItem[] = [
  {
    key: 'blue',
    name: 'Azul',
    nameEn: 'Blue',
    hexLight: '#2673c9',
    hexDark: '#5b9be0',
    isActive: true,
  },
  {
    key: 'gold',
    name: 'Oro',
    nameEn: 'Gold',
    hexLight: '#c9a227',
    hexDark: '#e0c060',
    isActive: false,
  },
];

describe('VehicleColorsStore', () => {
  const isDark = signal(false);
  const language = signal('es');

  async function create(
    vehicleColors: () => Promise<VehicleColorItem[]>,
  ): Promise<VehicleColorsStore> {
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        { provide: CatalogsService, useValue: { vehicleColors } },
        { provide: ThemeService, useValue: { isDark } },
        { provide: LanguageService, useValue: { currentLanguage: language } },
      ],
    });
    const store = TestBed.inject(VehicleColorsStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return store;
  }

  beforeEach(() => {
    isDark.set(false);
    language.set('es');
  });

  it('names the color in the language of the app', async () => {
    const store = await create(() => Promise.resolve(COLORS));

    expect(store.label('blue')).toBe('Azul');
    language.set('en');
    expect(store.label('blue')).toBe('Blue');
    expect(store.label('gold')).toBe('Gold');
  });

  it('names and paints every color, but offers only the active ones', async () => {
    const store = await create(() => Promise.resolve(COLORS));

    expect(store.offered().map(({ key }) => key)).toEqual(['blue']);
    expect(store.label('gold')).toBe('Oro');
    expect(store.swatch('blue')).toBe('#2673c9');
    isDark.set(true);
    expect(store.swatch('blue')).toBe('#5b9be0');
  });

  it('says when there is no color and stays quiet for an unknown one', async () => {
    const store = await create(() => Promise.resolve(COLORS));

    expect(store.label(null)).toBe('Color sin indicar');
    expect(store.label('pink')).toBe('');
    expect(store.swatch(null)).toBe('transparent');
    expect(store.swatch('pink')).toBe('transparent');
  });

  it('keeps working without colors when the catalog fails', async () => {
    const store = await create(() => Promise.reject(new Error('offline')));

    expect(store.offered()).toEqual([]);
    expect(store.label('blue')).toBe('');
  });
});
