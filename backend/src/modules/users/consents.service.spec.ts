import { LegalDocumentsService } from './legal-documents.service';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { ConsentsService } from './consents.service';
import { UserConsent } from './entities/user-consent.entity';
import { UserNotFoundError } from './errors/user-not-found.error';
import { computeConsentFingerprint } from './user-consent';

describe('ConsentsService', () => {
  let service: ConsentsService;
  const userRepo = { existsBy: jest.fn() };
  const consentsRepository = { find: jest.fn(), findOne: jest.fn() };
  const legalDocuments = { requiredVersion: jest.fn() };
  const dataSource = {
    getRepository: jest.fn(() => userRepo),
  };

  beforeEach(async () => {
    userRepo.existsBy.mockReset();
    consentsRepository.find.mockReset();
    consentsRepository.findOne.mockReset();
    legalDocuments.requiredVersion.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(UserConsent),
          useValue: consentsRepository,
        },
        { provide: EventsService, useValue: { record: jest.fn() } },
        { provide: LegalDocumentsService, useValue: legalDocuments },
      ],
    }).compile();

    service = moduleRef.get(ConsentsService);
  });

  describe('computeConsentFingerprint', () => {
    it('computes the SHA-256 hex digest of user_id|type|document_version|action|recorded_at', () => {
      const recordedAt = new Date('2026-10-21T09:15:00.123Z');
      const base = {
        userId: '00000000-0000-4000-8000-000000000002',
        type: 'terms' as const,
        documentVersion: '1.0',
        action: 'granted' as const,
        recordedAt,
      };

      const fp1 = computeConsentFingerprint(base);
      const fp2 = computeConsentFingerprint({ ...base, action: 'revoked' });

      expect(fp1).toMatch(/^[0-9a-f]{64}$/);
      expect(fp1).toBe(computeConsentFingerprint(base));
      expect(fp2).not.toBe(fp1);
    });
  });

  describe('getMyConsents', () => {
    it('returns the latest state of each consent type and the full history', async () => {
      userRepo.existsBy.mockResolvedValue(true);
      const olderLocation = Object.assign(new UserConsent(), {
        id: 'c-2',
        userId: 'u-1',
        type: 'location',
        documentVersion: '1.0',
        action: 'granted',
        source: 'settings',
        recordedAt: new Date('2026-10-21T10:00:00.000Z'),
        fingerprint: 'f'.repeat(64),
      });
      const newerLocation = Object.assign(new UserConsent(), {
        id: 'c-3',
        userId: 'u-1',
        type: 'location',
        documentVersion: '1.0',
        action: 'revoked',
        source: 'settings',
        recordedAt: new Date('2026-10-22T10:00:00.000Z'),
        fingerprint: 'e'.repeat(64),
      });
      const terms = Object.assign(new UserConsent(), {
        id: 'c-1',
        userId: 'u-1',
        type: 'terms',
        documentVersion: '1.0',
        action: 'granted',
        source: 'registration',
        recordedAt: new Date('2026-10-20T09:00:00.000Z'),
        fingerprint: 'a'.repeat(64),
      });
      consentsRepository.find.mockResolvedValue([
        newerLocation,
        olderLocation,
        terms,
      ]);

      const view = await service.getMyConsents('u-1');

      expect(view.current.terms?.id).toBe('c-1');
      expect(view.current.privacy).toBeNull();
      expect(view.current.location).toMatchObject({
        id: 'c-3',
        action: 'revoked',
      });
      expect(view.history.map((item) => item.id)).toEqual([
        'c-3',
        'c-2',
        'c-1',
      ]);
    });

    it('throws USER_NOT_FOUND when the user does not exist', async () => {
      userRepo.existsBy.mockResolvedValue(false);

      await expect(service.getMyConsents('missing')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  // P. ej. la declaración del conductor para poder publicar
  describe('isAccepted', () => {
    const accepted = (documentVersion: string, action = 'granted') => ({
      documentVersion,
      action,
    });

    it('is up to date with the version of the last major change or a later one', async () => {
      legalDocuments.requiredVersion.mockResolvedValue('2.0');

      consentsRepository.findOne.mockResolvedValue(accepted('2.0'));
      await expect(
        service.isAccepted('u1', 'driver_declaration'),
      ).resolves.toBe(true);
      consentsRepository.findOne.mockResolvedValue(accepted('2.1'));
      await expect(
        service.isAccepted('u1', 'driver_declaration'),
      ).resolves.toBe(true);
      expect(consentsRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', type: 'driver_declaration' },
        }),
      );
    });

    it('asks again after a major change, a withdrawal or without accepting it', async () => {
      legalDocuments.requiredVersion.mockResolvedValue('2.0');

      consentsRepository.findOne.mockResolvedValue(accepted('1.9'));
      await expect(
        service.isAccepted('u1', 'driver_declaration'),
      ).resolves.toBe(false);
      consentsRepository.findOne.mockResolvedValue(accepted('2.0', 'revoked'));
      await expect(
        service.isAccepted('u1', 'driver_declaration'),
      ).resolves.toBe(false);
      consentsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.isAccepted('u1', 'driver_declaration'),
      ).resolves.toBe(false);
    });
  });
});
