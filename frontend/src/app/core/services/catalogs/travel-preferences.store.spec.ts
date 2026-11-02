import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../ui/language.service';
import { CatalogsService, TravelPreferenceOptionItem } from './catalogs.service';
import { TRAVEL_PREFERENCE_OPTIONS_FIXTURE } from './catalogs.testing';
import { TravelPreferencesStore } from './travel-preferences.store';

describe('TravelPreferencesStore', () => {
  const language = signal<'es' | 'en'>('es');

  async function create(options: TravelPreferenceOptionItem[]): Promise<TravelPreferencesStore> {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CatalogsService,
          useValue: { travelPreferenceOptions: () => Promise.resolve(options) },
        },
        { provide: LanguageService, useValue: { currentLanguage: language } },
      ],
    });
    const store = TestBed.inject(TravelPreferencesStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return store;
  }

  beforeEach(() => language.set('es'));

  it('names the chosen options in the language of the app, in group order', async () => {
    const store = await create(TRAVEL_PREFERENCE_OPTIONS_FIXTURE);
    const preferences = { conversation: null, music: 'soft', smoking: 'no', pets: null } as const;

    expect(store.format(preferences)).toEqual(['Música suave', 'No se fuma']);
    language.set('en');
    expect(store.format(preferences)).toEqual(['Soft music', 'No smoking']);
    expect(store.format(undefined)).toEqual([]);
  });

  it('offers the active options and keeps the one already chosen', async () => {
    const options = TRAVEL_PREFERENCE_OPTIONS_FIXTURE.map((option) =>
      option.value === 'pet_friendly' ? { ...option, isActive: false } : option,
    );
    const store = await create(options);
    const petsOf = (pets: 'pet_friendly' | null) =>
      store
        .groupsFor({ conversation: null, music: null, smoking: null, pets })
        .find(({ key }) => key === 'pets')
        ?.options.map(({ value }) => value);

    expect(petsOf(null)).toEqual(['none', 'small_carrier']);
    expect(petsOf('pet_friendly')).toEqual(['none', 'small_carrier', 'pet_friendly']);
    expect(store.label('pets', 'pet_friendly')).toBe('Pet friendly');
  });

  it('has no texts until the options arrive', async () => {
    const store = await create([]);
    expect(store.label('music', 'soft')).toBeNull();
    expect(store.groupsFor(null).every(({ options }) => options.length === 0)).toBe(true);
  });
});
