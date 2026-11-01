import { formatTravelPreferences } from './travel-preferences.model';

describe('formatTravelPreferences', () => {
  it('lists the chosen preferences in the order of the groups', () => {
    expect(
      formatTravelPreferences({
        conversation: 'quiet',
        music: null,
        smoking: 'no',
        pets: 'pet_friendly',
      }),
    ).toEqual(['Prefiero ir tranquilo', 'No se fuma en el coche', 'Pet friendly']);
  });

  it('lists nothing when no preference is chosen', () => {
    expect(formatTravelPreferences(undefined)).toEqual([]);
    expect(
      formatTravelPreferences({ conversation: null, music: null, smoking: null, pets: null }),
    ).toEqual([]);
  });
});
