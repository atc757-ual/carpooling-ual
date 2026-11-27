import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { OtpSendRateLimitedError } from './errors/otp-send-rate-limited.error';
import { OtpSendLimitsService } from './otp-send-limits.service';

describe('OtpSendLimitsService', () => {
  const secret = 'test-jwt-secret';
  let service: OtpSendLimitsService;
  let managerQuery: jest.Mock;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let row: {
    window_started_at: Date;
    send_count: number;
    locked_until: Date | null;
  };

  const recipientHash = (recipient: string) =>
    createHmac('sha256', secret)
      .update(`otp-recipient:${recipient.trim().toLowerCase()}`)
      .digest('hex');

  beforeEach(() => {
    row = {
      window_started_at: new Date(),
      send_count: 0,
      locked_until: null,
    };
    managerQuery = jest.fn((query: string) => {
      if (query.includes('SELECT window_started_at')) return [row];
      return [];
    });
    dataSource = {
      transaction: jest.fn((callback: (manager: EntityManager) => unknown) =>
        callback({ query: managerQuery } as unknown as EntityManager),
      ),
      query: jest.fn(),
    };
    service = new OtpSendLimitsService(
      dataSource as unknown as DataSource,
      {
        getOrThrow: jest.fn().mockReturnValue(secret),
      } as unknown as ConfigService,
    );
  });

  it('allows the fifth send and stores a normalized HMAC instead of the recipient', async () => {
    row.send_count = 4;

    await expect(
      service.registerSendAttempt(' Ana@UAL.ES '),
    ).resolves.toBeUndefined();

    expect(managerQuery).toHaveBeenCalledWith(
      expect.stringContaining('send_count = $3'),
      [recipientHash('ana@ual.es'), false, 5],
    );
    expect(managerQuery).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['ana@ual.es']),
    );
  });

  it('locks the sixth send for five minutes', async () => {
    row.send_count = 5;

    await expect(
      service.registerSendAttempt('ana@ual.es'),
    ).rejects.toMatchObject({
      constructor: OtpSendRateLimitedError,
      retryAfterSeconds: 300,
    });
    expect(managerQuery).toHaveBeenCalledWith(
      expect.stringContaining('make_interval(mins => $2)'),
      [recipientHash('ana@ual.es'), 5],
    );
  });

  it('starts a fresh window after fifteen minutes', async () => {
    row.window_started_at = new Date(Date.now() - 16 * 60_000);
    row.send_count = 5;

    await expect(
      service.registerSendAttempt('ana@ual.es'),
    ).resolves.toBeUndefined();

    expect(managerQuery).toHaveBeenCalledWith(
      expect.stringContaining('send_count = $3'),
      [recipientHash('ana@ual.es'), true, 1],
    );
  });

  it('blocks OTP validation while a recipient is locked', async () => {
    dataSource.query.mockResolvedValue([
      { locked_until: new Date(Date.now() + 60_000) },
    ]);

    await expect(service.assertNotLocked('ana@ual.es')).rejects.toBeInstanceOf(
      OtpSendRateLimitedError,
    );
  });

  it('allows OTP validation when there is no active lock', async () => {
    dataSource.query.mockResolvedValue([{ locked_until: null }]);

    await expect(
      service.assertNotLocked('ana@ual.es'),
    ).resolves.toBeUndefined();
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT locked_until'),
      [recipientHash('ana@ual.es')],
    );
  });
});
