import { TripNotFoundError } from '../trips/errors/trip-not-found.error';
import type { TripsService } from '../trips/trips.service';
import type { UsersService } from '../users/users.service';
import { ParticipantProfileForbiddenError } from './errors/participant-profile-forbidden.error';
import type { RequestsService } from './requests.service';
import {
  passengerOfPair,
  TripParticipantsService,
} from './trip-participants.service';

const TRIP_ID = 'trip-1';
const DRIVER = 'driver-1';
const PASSENGER = 'passenger-1';
const OTHER_PASSENGER = 'passenger-2';
const STRANGER = 'stranger-1';

// Con quién se viaja: el perfil entre el conductor y cada pasajero con plaza,
// y los compañeros de viaje de un pasajero
describe('TripParticipantsService', () => {
  let tripsService: { getByIds: jest.Mock };
  let requestsService: {
    hadSeat: jest.Mock;
    acceptedPassengersByTrip: jest.Mock;
  };
  let usersService: {
    getParticipantProfile: jest.Mock;
    getPublicProfiles: jest.Mock;
  };
  let service: TripParticipantsService;

  const withTrip = (status = 'confirmed') =>
    tripsService.getByIds.mockResolvedValue(
      new Map([[TRIP_ID, { id: TRIP_ID, driverId: DRIVER, status }]]),
    );

  beforeEach(() => {
    tripsService = { getByIds: jest.fn() };
    requestsService = {
      hadSeat: jest.fn().mockResolvedValue(true),
      acceptedPassengersByTrip: jest.fn(),
    };
    usersService = {
      getParticipantProfile: jest
        .fn()
        .mockImplementation((id: string) => Promise.resolve({ id })),
      getPublicProfiles: jest.fn(),
    };
    service = new TripParticipantsService(
      tripsService as unknown as TripsService,
      requestsService as unknown as RequestsService,
      usersService as unknown as UsersService,
    );
  });

  describe('passengerOfPair', () => {
    it.each([
      ['the driver asks for a passenger', DRIVER, PASSENGER, PASSENGER],
      ['a passenger asks for the driver', PASSENGER, DRIVER, PASSENGER],
      [
        'a passenger asks for another passenger',
        PASSENGER,
        OTHER_PASSENGER,
        null,
      ],
      ['the driver asks for themself', DRIVER, DRIVER, null],
      ['a passenger asks for themself', PASSENGER, PASSENGER, null],
      ['a stranger asks for a passenger', STRANGER, PASSENGER, null],
    ])('%s', (_case, viewerId, userId, expected) => {
      expect(passengerOfPair(DRIVER, viewerId, userId)).toBe(expected);
    });
  });

  describe('getProfile', () => {
    it('lets the driver see a passenger who had a seat', async () => {
      withTrip();

      await expect(
        service.getProfile(DRIVER, { tripId: TRIP_ID, userId: PASSENGER }),
      ).resolves.toEqual({ id: PASSENGER });
      expect(requestsService.hadSeat).toHaveBeenCalledWith(TRIP_ID, PASSENGER);
    });

    it.each(['confirmed', 'in_progress', 'finished', 'cancelled'])(
      'lets a passenger who had a seat see the driver with the trip %s',
      async (status) => {
        withTrip(status);

        await expect(
          service.getProfile(PASSENGER, { tripId: TRIP_ID, userId: DRIVER }),
        ).resolves.toEqual({ id: DRIVER });
      },
    );

    it('refuses a passenger without a seat (pending or rejected)', async () => {
      withTrip();
      requestsService.hadSeat.mockResolvedValue(false);

      await expect(
        service.getProfile(PASSENGER, { tripId: TRIP_ID, userId: DRIVER }),
      ).rejects.toBeInstanceOf(ParticipantProfileForbiddenError);
      expect(usersService.getParticipantProfile).not.toHaveBeenCalled();
    });

    // Quien no va en el viaje y pide al conductor: se comprueba su plaza y no la tiene
    it('refuses someone outside the trip asking for the driver', async () => {
      withTrip();
      requestsService.hadSeat.mockResolvedValue(false);

      await expect(
        service.getProfile(STRANGER, { tripId: TRIP_ID, userId: DRIVER }),
      ).rejects.toBeInstanceOf(ParticipantProfileForbiddenError);
      expect(requestsService.hadSeat).toHaveBeenCalledWith(TRIP_ID, STRANGER);
    });

    it.each([
      ['two passengers', PASSENGER, OTHER_PASSENGER],
      ['someone outside the trip asking for a passenger', STRANGER, PASSENGER],
      ['oneself', DRIVER, DRIVER],
    ])('refuses %s', async (_case, viewerId, userId) => {
      withTrip();

      await expect(
        service.getProfile(viewerId, { tripId: TRIP_ID, userId }),
      ).rejects.toBeInstanceOf(ParticipantProfileForbiddenError);
      expect(requestsService.hadSeat).not.toHaveBeenCalled();
    });

    it('fails with a trip that does not exist', async () => {
      tripsService.getByIds.mockResolvedValue(new Map());

      await expect(
        service.getProfile(DRIVER, { tripId: TRIP_ID, userId: PASSENGER }),
      ).rejects.toBeInstanceOf(TripNotFoundError);
    });
  });

  describe('listCoPassengers', () => {
    const page = { offset: 0, limit: 20 };

    beforeEach(() => {
      withTrip();
      requestsService.acceptedPassengersByTrip.mockResolvedValue(
        new Map([[TRIP_ID, [PASSENGER, OTHER_PASSENGER, 'passenger-3']]]),
      );
      usersService.getPublicProfiles.mockImplementation((ids: string[]) =>
        Promise.resolve(new Map(ids.map((id) => [id, { id, name: id }]))),
      );
    });

    it('lists the other passengers with a seat, not the one asking', async () => {
      const result = await service.listCoPassengers(PASSENGER, TRIP_ID, page);

      expect(result).toEqual({
        items: [
          { id: OTHER_PASSENGER, name: OTHER_PASSENGER },
          { id: 'passenger-3', name: 'passenger-3' },
        ],
        total: 2,
      });
    });

    it('returns only the page asked for, with the total', async () => {
      const result = await service.listCoPassengers(PASSENGER, TRIP_ID, {
        offset: 1,
        limit: 1,
      });

      expect(result).toEqual({
        items: [{ id: 'passenger-3', name: 'passenger-3' }],
        total: 2,
      });
      expect(usersService.getPublicProfiles).toHaveBeenCalledWith([
        'passenger-3',
      ]);
    });

    it('returns an empty list to the only passenger', async () => {
      requestsService.acceptedPassengersByTrip.mockResolvedValue(
        new Map([[TRIP_ID, [PASSENGER]]]),
      );

      await expect(
        service.listCoPassengers(PASSENGER, TRIP_ID, page),
      ).resolves.toEqual({ items: [], total: 0 });
    });

    it.each([
      ['the driver', DRIVER],
      ['someone without a seat', STRANGER],
    ])('refuses %s', async (_case, viewerId) => {
      await expect(
        service.listCoPassengers(viewerId, TRIP_ID, page),
      ).rejects.toBeInstanceOf(ParticipantProfileForbiddenError);
    });

    it('refuses everyone on a trip with no passengers', async () => {
      requestsService.acceptedPassengersByTrip.mockResolvedValue(new Map());

      await expect(
        service.listCoPassengers(PASSENGER, TRIP_ID, page),
      ).rejects.toBeInstanceOf(ParticipantProfileForbiddenError);
    });

    it('fails with a trip that does not exist', async () => {
      tripsService.getByIds.mockResolvedValue(new Map());

      await expect(
        service.listCoPassengers(PASSENGER, TRIP_ID, page),
      ).rejects.toBeInstanceOf(TripNotFoundError);
    });
  });
});
