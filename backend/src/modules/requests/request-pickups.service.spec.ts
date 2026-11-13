import type { EntityManager, Point } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import type {
  PickupPlan,
  TripPickupsService,
} from '../trips/trip-pickups.service';
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
  const service = new RequestPickupsService(
    { planWith, apply, remove } as unknown as TripPickupsService,
    changes,
  );
  const update = jest.fn();
  const manager = { update } as unknown as EntityManager;
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

    void service.planAcceptance(seatRequest(), trip);

    expect(planWith).toHaveBeenCalledWith(
      trip,
      { id: 'r1', location: PICKUP },
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
      { id: 'new-request', location: PICKUP },
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
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      SeatRequest,
      { id: 'r2' },
      { pickupAt: later },
    );
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
    expect(update).toHaveBeenCalledWith(
      SeatRequest,
      { id: 'r2' },
      { pickupAt: later },
    );
  });

  it('leaves the route alone once the trip is under way', async () => {
    await listener(manager, {
      type: 'request.cancelled',
      request: seatRequest(),
      trip: { ...trip, status: 'in_progress' },
    });

    expect(remove).not.toHaveBeenCalled();
  });
});
