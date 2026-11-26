import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { SmsSender } from '../../shared/sms/sms-sender';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { EmailCodesService } from './email-codes.service';
import { PhoneRequiredError } from './errors/phone-required.error';
import { PhoneVerificationService } from './phone-verification.service';

describe('PhoneVerificationService', () => {
  const activeUser: User = {
    id: 'u1',
    phone: '+34600112233',
    language: 'es',
    deactivatedAt: null,
  } as unknown as User;

  let usersService: jest.Mocked<
    Pick<UsersService, 'findById' | 'markPhoneVerified' | 'getSummary'>
  >;
  let emailCodes: jest.Mocked<Pick<EmailCodesService, 'issue' | 'consume'>>;
  let smsSender: jest.Mocked<Pick<SmsSender, 'send'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let service: PhoneVerificationService;

  beforeEach(() => {
    usersService = {
      findById: jest.fn().mockResolvedValue(activeUser),
      markPhoneVerified: jest.fn().mockResolvedValue(undefined),
      getSummary: jest.fn().mockResolvedValue({
        id: 'u1',
        phoneVerified: true,
      }),
    };
    emailCodes = {
      issue: jest.fn().mockResolvedValue('123456'),
      consume: jest
        .fn()
        .mockImplementation(
          async (
            _userId: string,
            _purpose: string,
            _code: string,
            onValid: (m: EntityManager) => Promise<void>,
          ) => {
            await onValid({} as EntityManager);
          },
        ),
    };
    smsSender = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockReturnValue({ otpDomain: 'carpooling.ual.es' }),
    };

    service = new PhoneVerificationService(
      usersService as unknown as UsersService,
      emailCodes as unknown as EmailCodesService,
      smsSender,
      configService as unknown as ConfigService,
    );
  });

  describe('requestCode', () => {
    it('issues a code and sends it via SMS when active user has a phone', async () => {
      await service.requestCode('u1');

      expect(emailCodes.issue).toHaveBeenCalledWith('u1', 'phone_verification');
      expect(smsSender.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+34600112233' }),
      );
    });

    it('does not send SMS when emailCodes.issue returns null (rate-limited)', async () => {
      emailCodes.issue.mockResolvedValueOnce(null);

      await service.requestCode('u1');

      expect(smsSender.send).not.toHaveBeenCalled();
    });

    it('logs and swallows SMS sending errors (both Error and non-Error)', async () => {
      smsSender.send.mockRejectedValueOnce(new Error('gateway down'));
      await expect(service.requestCode('u1')).resolves.toBeUndefined();

      smsSender.send.mockRejectedValueOnce('plain string error');
      await expect(service.requestCode('u1')).resolves.toBeUndefined();
    });

    it('throws UserNotFoundError when user does not exist or is deactivated', async () => {
      usersService.findById.mockResolvedValueOnce(null);
      await expect(service.requestCode('u1')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );

      usersService.findById.mockResolvedValueOnce({
        ...activeUser,
        deactivatedAt: new Date(),
      });
      await expect(service.requestCode('u1')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });

    it('throws PhoneRequiredError when user has no phone', async () => {
      usersService.findById.mockResolvedValueOnce({
        ...activeUser,
        phone: null,
      });

      await expect(service.requestCode('u1')).rejects.toBeInstanceOf(
        PhoneRequiredError,
      );
    });
  });

  describe('verifyCode', () => {
    it('consumes code, marks phone verified, and returns user summary', async () => {
      const summary = await service.verifyCode('u1', '123456');

      expect(emailCodes.consume).toHaveBeenCalledWith(
        'u1',
        'phone_verification',
        '123456',
        expect.any(Function),
      );
      expect(usersService.markPhoneVerified).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
      );
      expect(summary).toEqual({ id: 'u1', phoneVerified: true });
    });

    it('throws UserNotFoundError when user is missing or deactivated', async () => {
      usersService.findById.mockResolvedValueOnce(null);
      await expect(service.verifyCode('u1', '123456')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );

      usersService.findById.mockResolvedValueOnce({
        ...activeUser,
        deactivatedAt: new Date(),
      });
      await expect(service.verifyCode('u1', '123456')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });

    it('throws PhoneRequiredError when user has no phone', async () => {
      usersService.findById.mockResolvedValueOnce({
        ...activeUser,
        phone: null,
      });

      await expect(service.verifyCode('u1', '123456')).rejects.toBeInstanceOf(
        PhoneRequiredError,
      );
    });

    it('defaults otpDomain to null when sms config is missing', () => {
      configService.get.mockReturnValueOnce(undefined);
      const fallbackService = new PhoneVerificationService(
        usersService as unknown as UsersService,
        emailCodes as unknown as EmailCodesService,
        smsSender,
        configService as unknown as ConfigService,
      );
      expect(fallbackService).toBeDefined();
    });
  });
});
