import { Test } from '@nestjs/testing';
import { compare, hash } from 'bcryptjs';
import { EntityManager } from 'typeorm';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { EmailCodesService } from './email-codes.service';
import { InvalidVerificationCodeError } from './errors/invalid-verification-code.error';
import { PasswordUnchangedError } from './errors/password-unchanged.error';
import { PasswordResetService } from './password-reset.service';
import { RefreshTokensService } from './refresh-tokens.service';

const CURRENT_PASSWORD = 'current-password';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  const usersService = {
    findByEmail: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    changePassword: jest.fn(),
  };
  const emailCodes = {
    issue: jest.fn(),
    check: jest.fn(),
    consume: jest.fn(),
  };
  const refreshTokens = { revokeAllOfUser: jest.fn() };
  const mailSender = { send: jest.fn() };
  const manager = {} as EntityManager;
  let currentHash: string;

  function storedUser(): User {
    return Object.assign(new User(), {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@ual.es',
      passwordHash: currentHash,
    });
  }

  beforeAll(async () => {
    currentHash = await hash(CURRENT_PASSWORD, 4);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    // consume ejecuta onValid como lo haría con un código correcto
    emailCodes.consume.mockImplementation(
      async (
        _userId: string,
        _purpose: string,
        _code: string,
        onValid: (manager: EntityManager) => Promise<void>,
      ) => onValid(manager),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: UsersService, useValue: usersService },
        { provide: EmailCodesService, useValue: emailCodes },
        { provide: RefreshTokensService, useValue: refreshTokens },
        { provide: MailSender, useValue: mailSender },
      ],
    }).compile();
    service = moduleRef.get(PasswordResetService);
  });

  describe('requestCode', () => {
    it('sends a code to an existing account', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser());
      emailCodes.issue.mockResolvedValue('042137');
      mailSender.send.mockResolvedValue(undefined);

      await service.requestCode('ana@ual.es');

      expect(emailCodes.issue).toHaveBeenCalledWith('user-1', 'password_reset');
      const [mail] = mailSender.send.mock.calls[0] as [
        { to: string; text: string },
      ];
      expect(mail.to).toBe('ana@ual.es');
      expect(mail.text).toContain('042137');
    });

    it('does nothing for an unknown email, without an error', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.requestCode('nobody@ual.es')).resolves.toBe(
        undefined,
      );
      expect(emailCodes.issue).not.toHaveBeenCalled();
      expect(mailSender.send).not.toHaveBeenCalled();
    });

    it('does not send another email within the minute', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser());
      emailCodes.issue.mockResolvedValue(null);

      await service.requestCode('ana@ual.es');

      expect(mailSender.send).not.toHaveBeenCalled();
    });

    it('does not fail if the email cannot be sent', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser());
      emailCodes.issue.mockResolvedValue('042137');
      mailSender.send.mockRejectedValue(new Error('SMTP server down'));

      await expect(service.requestCode('ana@ual.es')).resolves.toBe(undefined);
    });
  });

  describe('checkCode', () => {
    it('checks the code of the user without using it up', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(storedUser());

      await service.checkCode('ana@ual.es', '042137');

      expect(emailCodes.check).toHaveBeenCalledWith(
        'user-1',
        'password_reset',
        '042137',
      );
      expect(emailCodes.consume).not.toHaveBeenCalled();
    });

    it('answers an unknown email like a wrong code', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.checkCode('nobody@ual.es', '042137'),
      ).rejects.toBeInstanceOf(InvalidVerificationCodeError);
    });
  });

  describe('resetPassword', () => {
    const reset = {
      email: 'ana@ual.es',
      code: '042137',
      password: 'new-secret-password',
    };

    it('sets a bcrypt hash of the new password and closes every session', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(storedUser());

      await service.resetPassword(reset);

      const [usedManager, userId, passwordHash] = usersService.changePassword
        .mock.calls[0] as [EntityManager, string, string];
      expect(usedManager).toBe(manager);
      expect(userId).toBe('user-1');
      expect(passwordHash).not.toBe(reset.password);
      expect(await compare(reset.password, passwordHash)).toBe(true);
      expect(refreshTokens.revokeAllOfUser).toHaveBeenCalledWith(
        manager,
        'user-1',
      );
    });

    it('rejects the current password without changing anything', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(storedUser());

      await expect(
        service.resetPassword({ ...reset, password: CURRENT_PASSWORD }),
      ).rejects.toBeInstanceOf(PasswordUnchangedError);
      expect(usersService.changePassword).not.toHaveBeenCalled();
      expect(refreshTokens.revokeAllOfUser).not.toHaveBeenCalled();
    });

    it('changes nothing when the code is wrong', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(storedUser());
      emailCodes.consume.mockRejectedValue(new InvalidVerificationCodeError());

      await expect(service.resetPassword(reset)).rejects.toBeInstanceOf(
        InvalidVerificationCodeError,
      );
      expect(usersService.changePassword).not.toHaveBeenCalled();
    });

    it('answers an unknown email like a wrong code', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.resetPassword(reset)).rejects.toBeInstanceOf(
        InvalidVerificationCodeError,
      );
      expect(emailCodes.consume).not.toHaveBeenCalled();
    });
  });
});
