import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import type { TripsService } from '../trips/trips.service';
import type { UsersService } from '../users/users.service';
import type {
  RequestChange,
  RequestChangeListener,
  RequestChangesRecorder,
} from './request-changes';
import { TripEmailsListener } from './trip-emails.listener';

const REQUEST = {
  id: 'r1',
  tripId: 't1',
  passengerId: 'p1',
  pickupName: null,
  pickupAt: null,
};

describe('TripEmailsListener', () => {
  let listener: TripEmailsListener;
  let onChange: RequestChangeListener;
  let send: jest.Mock<(message: unknown) => Promise<void>>;
  let findById: jest.Mock<(id: string) => Promise<unknown>>;

  beforeEach(() => {
    send = jest.fn<(message: unknown) => Promise<void>>().mockResolvedValue();
    findById = jest.fn<(id: string) => Promise<unknown>>().mockResolvedValue({
      email: 'mario@ual.es',
      firstName: 'Mario',
      deactivatedAt: null,
    });
    const changes = {
      onRequestChanged: (callback: RequestChangeListener) => {
        onChange = callback;
      },
    } as unknown as RequestChangesRecorder;
    listener = new TripEmailsListener(
      { subscribers: [] } as unknown as DataSource,
      changes,
      { send },
      {
        findById,
        getNames: () => Promise.resolve(new Map([['d1', 'Lucía Cortés']])),
      } as unknown as UsersService,
      {
        getById: () =>
          Promise.resolve({
            trip: {
              driverId: 'd1',
              departureAt: new Date('2026-11-20T07:00:00.000Z'),
              originName: 'Roquetas de Mar',
              destinationName: 'Campus UAL',
            },
          }),
      } as unknown as TripsService,
      {
        getOrThrow: () => ({ publicWebUrl: 'https://carpooling.test' }),
      } as unknown as ConfigService,
    );
    listener.onModuleInit();
  });

  function transaction(isActive = true) {
    const queryRunner = {
      data: {},
      isTransactionActive: isActive,
    } as unknown as QueryRunner;
    return {
      queryRunner,
      manager: { queryRunner } as unknown as EntityManager,
    };
  }

  async function change(manager: EntityManager, type: string): Promise<void> {
    await onChange(manager, {
      type,
      request: REQUEST,
    } as unknown as RequestChange);
  }

  // El envío va sin esperar (void): deja que terminen sus promesas
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('sends the seat confirmed email only after the commit', async () => {
    const { queryRunner, manager } = transaction();
    await change(manager, 'request.accepted');
    expect(send).not.toHaveBeenCalled();

    listener.afterTransactionCommit({ queryRunner } as never);
    await flush();

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'mario@ual.es',
        subject: 'Tienes plaza en el viaje de Lucía',
      }),
    );
    // Ya enviado: otro commit del mismo QueryRunner no lo repite
    listener.afterTransactionCommit({ queryRunner } as never);
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends the trip finished email with the link to the seat', async () => {
    const { queryRunner, manager } = transaction();
    await change(manager, 'request.completed');
    listener.afterTransactionCommit({ queryRunner } as never);
    await flush();

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Tu viaje con Lucía ha terminado',
        text: expect.stringContaining(
          'https://carpooling.test/tabs/trips/requests/r1',
        ) as unknown,
      }),
    );
  });

  it('drops the emails of a rolled back transaction', async () => {
    const { queryRunner, manager } = transaction();
    await change(manager, 'request.accepted');
    listener.afterTransactionRollback({ queryRunner } as never);
    listener.afterTransactionCommit({ queryRunner } as never);
    await flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('ignores other changes and changes outside a transaction', async () => {
    const pending = transaction();
    await change(pending.manager, 'request.created');
    const outside = transaction(false);
    await change(outside.manager, 'request.accepted');
    listener.afterTransactionCommit({
      queryRunner: pending.queryRunner,
    } as never);
    listener.afterTransactionCommit({
      queryRunner: outside.queryRunner,
    } as never);
    await flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing to a deleted account', async () => {
    findById.mockResolvedValueOnce({ deactivatedAt: new Date() });
    await listener.deliver({ kind: 'seat_confirmed', ...pendingEmail() });
    findById.mockResolvedValueOnce(null);
    await listener.deliver({ kind: 'seat_confirmed', ...pendingEmail() });

    expect(send).not.toHaveBeenCalled();
  });

  it('logs a failed delivery without throwing', async () => {
    send.mockRejectedValueOnce(new Error('smtp down'));
    const error = jest
      .spyOn(listener['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(
      listener.deliver({ kind: 'trip_finished', ...pendingEmail() }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'Could not send the trip_finished email of a seat request',
      expect.any(String),
    );
  });
});

function pendingEmail() {
  return {
    requestId: 'r1',
    tripId: 't1',
    passengerId: 'p1',
    pickupName: null,
    pickupAt: null,
  };
}
