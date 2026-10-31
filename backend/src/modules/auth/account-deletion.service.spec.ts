import { Test } from '@nestjs/testing';
import type { EntityManager } from 'typeorm';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import { AccountDeletionService } from './account-deletion.service';
import { EmailCodesService } from './email-codes.service';
import { RefreshTokensService } from './refresh-tokens.service';

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;
  const usersService = {
    findById: jest.fn(),
    deactivateAccount: jest.fn(),
  };
  const emailCodes = {
    issue: jest.fn(),
    consume: jest.fn(),
  };
  const refreshTokens = {
    revokeAllOfUser: jest.fn(),
  };
  const mailSender = {
    send: jest.fn(),
  };

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
        AccountDeletionService,
        { provide: UsersService, useValue: usersService },
        { provide: EmailCodesService, useValue: emailCodes },
        { provide: RefreshTokensService, useValue: refreshTokens },
        { provide: MailSender, useValue: mailSender },
      ],
    }).compile();

    service = moduleRef.get(AccountDeletionService);
  });

  describe('requestCode', () => {
    it('issues an account_deletion code and emails it to the user', async () => {
      usersService.findById.mockResolvedValue(activeUser());
      emailCodes.issue.mockResolvedValue('654321');

      await service.requestCode('user-1');

      expect(emailCodes.issue).toHaveBeenCalledWith(
        'user-1',
        'account_deletion',
      );
      expect(mailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ana@ual.es',
          subject: 'Tu código para eliminar la cuenta de Carpooling UAL',
          text: expect.stringContaining('654321') as string,
        }),
      );
    });

    it('does not send an email when the resend cooldown is active', async () => {
      usersService.findById.mockResolvedValue(activeUser());
      emailCodes.issue.mockResolvedValue(null);

      await service.requestCode('user-1');

      expect(mailSender.send).not.toHaveBeenCalled();
    });

    it('throws USER_NOT_FOUND when the user does not exist or is already deactivated', async () => {
      usersService.findById.mockResolvedValueOnce(null);
      await expect(service.requestCode('missing')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );

      usersService.findById.mockResolvedValueOnce(
        activeUser({ deactivatedAt: new Date() }),
      );
      await expect(service.requestCode('user-1')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  describe('confirmDeletion', () => {
    it('consumes the account_deletion code, deactivates the account and revokes all refresh tokens in the same transaction', async () => {
      usersService.findById.mockResolvedValue(activeUser());
      const fakeManager = {} as EntityManager;
      emailCodes.consume.mockImplementation(
        async (
          _userId: string,
          _purpose: string,
          _code: string,
          onValid: (manager: EntityManager) => Promise<void>,
        ) => {
          await onValid(fakeManager);
        },
      );

      await service.confirmDeletion('user-1', '654321');

      expect(emailCodes.consume).toHaveBeenCalledWith(
        'user-1',
        'account_deletion',
        '654321',
        expect.any(Function),
      );
      expect(usersService.deactivateAccount).toHaveBeenCalledWith(
        fakeManager,
        'user-1',
      );
      expect(refreshTokens.revokeAllOfUser).toHaveBeenCalledWith(
        fakeManager,
        'user-1',
      );
    });

    it('throws USER_NOT_FOUND when the user is already deactivated', async () => {
      usersService.findById.mockResolvedValue(
        activeUser({ deactivatedAt: new Date() }),
      );

      await expect(
        service.confirmDeletion('user-1', '654321'),
      ).rejects.toBeInstanceOf(UserNotFoundError);
      expect(emailCodes.consume).not.toHaveBeenCalled();
    });
  });
});
