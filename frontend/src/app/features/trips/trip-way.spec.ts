import { initAppTranslations } from '../../core/i18n/testing-transloco';
import { homeOutline, schoolOutline } from 'ionicons/icons';
import { tripWayOf } from './trip-way';

describe('tripWayOf', () => {
  beforeEach(() => initAppTranslations());

  it('tells the way to the campus from the way back home', () => {
    expect(
      tripWayOf({
        originName: 'Roquetas de Mar',
        destinationName: 'Campus UAL · Parking P2 (Sur)',
      }),
    ).toEqual({ label: 'Ida al campus', icon: schoolOutline });
    expect(
      tripWayOf({
        originName: 'Campus UAL · Parking P2 (Sur)',
        destinationName: 'Roquetas de Mar',
      }),
    ).toEqual({ label: 'Vuelta a casa', icon: homeOutline });
  });

  it('says nothing when the campus is not in the trip', () => {
    expect(tripWayOf({ originName: null, destinationName: 'Almería' })).toBeNull();
  });
});
