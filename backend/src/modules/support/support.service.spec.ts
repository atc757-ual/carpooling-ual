import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let service: SupportService;
  const usersService = { findById: jest.fn() };
  const mailSender = { send: jest.fn() };

  function activeUser(overrides: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: 'user-1',
      name: 'Ana',
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
        subject: '[Soporte] Sugerencia · Ana',
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
});
