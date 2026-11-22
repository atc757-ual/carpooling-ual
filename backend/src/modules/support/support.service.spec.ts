import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MailSender } from '../../shared/mail/mail-sender';
import type { MailMessage } from '../../shared/mail/mail-sender';
import { RequestsService } from '../requests/requests.service';
import type { Trip } from '../trips/entities/trip.entity';
import { TripNotFoundError } from '../trips/errors/trip-not-found.error';
import { TripsService } from '../trips/trips.service';
import { User } from '../users/entities/user.entity';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let service: SupportService;
  const usersService = { findById: jest.fn() };
  const mailSender = { send: jest.fn<Promise<void>, [MailMessage]>() };
  const tripsService = { getByIds: jest.fn() };
  const requestsService = { tripIdsRequestedBy: jest.fn() };

  const TRIP = {
    id: 'trip-1',
    number: 42,
    driverId: 'driver-1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: new Date('2026-11-20T06:30:00Z'),
  } as Trip;

  function activeUser(overrides: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: 'user-1',
      firstName: 'Ana',
      lastName: 'García',
      email: 'ana@ual.es',
      deactivatedAt: null,
      ...overrides,
    });
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: UsersService, useValue: usersService },
        { provide: TripsService, useValue: tripsService },
        { provide: RequestsService, useValue: requestsService },
        { provide: MailSender, useValue: mailSender },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => ({ supportTo: 'soporte@ual.es' }),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(SupportService);
  });

  it('emails the trimmed message to support, replying to the user', async () => {
    usersService.findById.mockResolvedValue(activeUser());

    await service.sendMessage('user-1', {
      topic: 'suggestion',
      message: '  Estaría bien poder elegir el parking.  ',
    });

    expect(mailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'soporte@ual.es',
        replyTo: 'ana@ual.es',
        subject: '[Soporte] Sugerencia · Ana García',
        text: expect.stringContaining(
          'Estaría bien poder elegir el parking.',
        ) as string,
      }),
    );
  });

  it('throws USER_NOT_FOUND for a missing or deactivated user', async () => {
    usersService.findById.mockResolvedValueOnce(null);
    await expect(
      service.sendMessage('missing', { topic: 'other', message: 'x' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);

    usersService.findById.mockResolvedValueOnce(
      activeUser({ deactivatedAt: new Date() }),
    );
    await expect(
      service.sendMessage('user-1', { topic: 'other', message: 'x' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(mailSender.send).not.toHaveBeenCalled();
  });

  describe('with a trip (topic trip)', () => {
    const MESSAGE = 'El conductor no llegó al punto de recogida.';

    beforeEach(() => {
      usersService.findById.mockResolvedValue(activeUser());
      tripsService.getByIds.mockResolvedValue(new Map([[TRIP.id, TRIP]]));
      requestsService.tripIdsRequestedBy.mockResolvedValue(new Set(['trip-1']));
    });

    it('puts the code, the route and the departure of a trip of hers in the email', async () => {
      await service.sendMessage('user-1', {
        topic: 'trip',
        message: MESSAGE,
        tripId: 'trip-1',
      });

      const [mail] = mailSender.send.mock.calls[0];
      expect(mail.subject).toBe('[Soporte] Un viaje VJ-0042 · Ana García');
      expect(mail.text).toContain(
        'Viaje: VJ-0042 · Roquetas de Mar → Campus UAL · ',
      );
      expect(mail.text).toContain('(trip-1)');
      expect(mail.html).toContain('<b>Viaje:</b> VJ-0042');
    });

    it('takes the trips she drives too', async () => {
      requestsService.tripIdsRequestedBy.mockResolvedValue(new Set());
      tripsService.getByIds.mockResolvedValue(
        new Map([[TRIP.id, { ...TRIP, driverId: 'user-1' }]]),
      );

      await service.sendMessage('user-1', {
        topic: 'trip',
        message: MESSAGE,
        tripId: 'trip-1',
      });

      expect(mailSender.send).toHaveBeenCalled();
    });

    it('answers TRIP_NOT_FOUND for a trip that is not hers or does not exist', async () => {
      requestsService.tripIdsRequestedBy.mockResolvedValue(new Set());
      await expect(
        service.sendMessage('user-1', {
          topic: 'trip',
          message: MESSAGE,
          tripId: 'trip-1',
        }),
      ).rejects.toBeInstanceOf(TripNotFoundError);

      tripsService.getByIds.mockResolvedValue(new Map());
      await expect(
        service.sendMessage('user-1', {
          topic: 'trip',
          message: MESSAGE,
          tripId: 'trip-2',
        }),
      ).rejects.toBeInstanceOf(TripNotFoundError);
      expect(mailSender.send).not.toHaveBeenCalled();
    });

    it('ignores the trip with another topic', async () => {
      await service.sendMessage('user-1', {
        topic: 'account',
        message: MESSAGE,
        tripId: 'trip-1',
      });

      expect(tripsService.getByIds).not.toHaveBeenCalled();
      expect(mailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[Soporte] Mi cuenta · Ana García',
        }),
      );
    });
  });
});
