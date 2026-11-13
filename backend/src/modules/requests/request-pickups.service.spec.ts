import type { EntityManager, Point } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import type {
  PickupPlan,
  TripPickupsService,
} from '../trips/trip-pickups.service';
import { StopNotInTripError } from '../trips/errors/stop-not-in-trip.error';
import { StopRequiredError } from '../trips/errors/stop-required.error';
import type { TripStopsService } from '../trips/trip-stops.service';
import { InvalidRequestPickupError } from './errors/invalid-request-pickup.error';
import { SeatRequest } from './entities/seat-request.entity';
import type {
  RequestChangeListener,
  RequestChangesRecorder,
} from './request-changes';
import { RequestPickupsService } from './request-pickups.service';

const PICKUP: Point = { type: 'Point', coordinates: [-2.45, 36.84] };

describe('RequestPickupsService', () => {
  const planWith = jest.fn();
  const apply = jest.fn();
  const remove = jest.fn();
  let listener: RequestChangeListener;
  const changes = {
    onRequestChanged: (registered: RequestChangeListener) => {
      listener = registered;
    },
  } as unknown as RequestChangesRecorder;
  const findStop = jest.fn();
  const service = new RequestPickupsService(
    { planWith, apply, remove } as unknown as TripPickupsService,
    { findOne: findStop } as unknown as TripStopsService,
    changes,
  );
  const query = jest.fn();
  const manager = { query } as unknown as EntityManager;
  const trip = { id: 't1', status: 'published' } as Trip;

  beforeEach(() => {
    jest.resetAllMocks();
    service.onModuleInit();
  });

  function seatRequest(overrides: Partial<SeatRequest> = {}): SeatRequest {
    return {
      id: 'r1',
      tripId: 't1',
      direction: 'to-campus',
      pickupLocation: PICKUP,
      pickupAt: null,
      ...overrides,
    } as SeatRequest;
  }

  it('plans a pickup only towards the campus and with a pickup point', () => {
    expect(
      service.planAcceptance(seatRequest({ direction: 'from-campus' }), trip),
    ).toBeNull();
    expect(
      service.planAcceptance(seatRequest({ pickupLocation: null }), trip),
    ).toBeNull();

    void service.planAcceptance(seatRequest({ stopId: null }), trip);

    expect(planWith).toHaveBeenCalledWith(
      trip,
      { id: 'r1', location: PICKUP, stopId: null },
      null,
    );
  });

  it('estimates the pickup time of a new request after the accepted pickups', async () => {
    const departure = new Date('2026-11-20T07:30:00Z');
    planWith.mockResolvedValue({
      pickups: [
        { requestId: 'r0', etaOffsetMin: 3 },
        { requestId: 'new-request', etaOffsetMin: 9 },
      ],
    });

    const pickupAt = await service.estimatePickupAt(
      { ...trip, departureAt: departure },
      PICKUP,
    );

    expect(planWith).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      { id: 'new-request', location: PICKUP, stopId: null },
      null,
    );
    expect(pickupAt).toEqual(new Date('2026-11-20T07:39:00Z'));
  });

  it('gives the accepted request its time and moves the others', async () => {
    const accepted = seatRequest();
    const time = new Date('2026-11-20T07:35:00Z');
    const later = new Date('2026-11-20T07:41:00Z');
    apply.mockResolvedValue(
      new Map([
        ['r1', time],
        ['r2', later],
      ]),
    );

    await service.applyAcceptance(manager, trip, accepted, {} as PickupPlan);

    expect(accepted.pickupAt).toEqual(time);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('unnest'), [
      ['r2'],
      [later],
    ]);
  });

  it('does not touch the database when no other pickup moves', async () => {
    const accepted = seatRequest();
    apply.mockResolvedValue(new Map([['r1', new Date()]]));

    await service.applyAcceptance(manager, trip, accepted, {} as PickupPlan);

    expect(query).not.toHaveBeenCalled();
  });

  it('releases the pickup of a seat cancelled before the trip', async () => {
    const later = new Date('2026-11-20T07:41:00Z');
    remove.mockResolvedValue(new Map([['r2', later]]));

    await listener(manager, {
      type: 'request.cancelled',
      request: seatRequest(),
      trip,
    });

    expect(remove).toHaveBeenCalledWith(manager, trip, 'r1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('unnest'), [
      ['r2'],
      [later],
    ]);
  });

  it('leaves the route alone once the trip is under way', async () => {
    await listener(manager, {
      type: 'request.cancelled',
      request: seatRequest(),
      trip: { ...trip, status: 'in_progress' },
    });

    expect(remove).not.toHaveBeenCalled();
  });

  describe('resolve (asking for a seat)', () => {
    const departure = new Date('2026-11-20T07:30:00Z');
    const ORIGIN: Point = { type: 'Point', coordinates: [-2.46, 36.84] };
    const onRoute = {
      ...trip,
      origin: ORIGIN,
      originName: 'Plaza Circular',
      departureAt: departure,
      pickupMode: 'on_route',
    } as Trip;
    const atStops = { ...onRoute, pickupMode: 'stops' } as Trip;
    const STOP = {
      id: 's1',
      name: 'Av. Cabo de Gata',
      location: PICKUP,
    };

    it('boards everyone at the driver start when leaving the campus', async () => {
      await expect(
        service.resolve(onRoute, { direction: 'from-campus' }),
      ).resolves.toEqual({
        location: ORIGIN,
        name: 'Plaza Circular',
        stopId: null,
        pickupAt: departure,
      });
    });

    it('picks up at the passenger point, at once when it is the start', async () => {
      await expect(
        service.resolve(onRoute, {
          direction: 'to-campus',
          pickupLocation: ORIGIN,
          pickupName: 'Plaza Circular',
        }),
      ).resolves.toMatchObject({ stopId: null, pickupAt: departure });
      expect(planWith).not.toHaveBeenCalled();
      await expect(
        service.resolve(onRoute, { direction: 'to-campus' }),
      ).rejects.toThrow(InvalidRequestPickupError);
    });

    it('picks up at the chosen stop, at its time', async () => {
      findStop.mockResolvedValue(STOP);
      planWith.mockResolvedValue({
        pickups: [{ requestId: 'new-request', etaOffsetMin: 6 }],
      });

      const pickup = await service.resolve(atStops, {
        direction: 'to-campus',
        stopId: 's1',
      });

      expect(findStop).toHaveBeenCalledWith('t1', 's1');
      expect(planWith).toHaveBeenCalledWith(
        atStops,
        { id: 'new-request', location: PICKUP, stopId: 's1' },
        null,
      );
      expect(pickup).toEqual({
        location: PICKUP,
        name: 'Av. Cabo de Gata',
        stopId: 's1',
        pickupAt: new Date('2026-11-20T07:36:00Z'),
      });
    });

    it('asks for a stop of the trip when it picks up at stops', async () => {
      await expect(
        service.resolve(atStops, { direction: 'to-campus' }),
      ).rejects.toThrow(StopRequiredError);
      findStop.mockResolvedValue(null);
      await expect(
        service.resolve(atStops, { direction: 'to-campus', stopId: 'other' }),
      ).rejects.toThrow(StopNotInTripError);
    });

    it('refuses a stop on a trip without stops or from the campus', async () => {
      await expect(
        service.resolve(onRoute, { direction: 'to-campus', stopId: 's1' }),
      ).rejects.toThrow(StopNotInTripError);
      await expect(
        service.resolve(atStops, { direction: 'from-campus', stopId: 's1' }),
      ).rejects.toThrow(StopNotInTripError);
    });
  });
});
