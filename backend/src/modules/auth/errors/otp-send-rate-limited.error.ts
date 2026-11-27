import { BusinessError } from '../../../shared/errors/business-error';

export class OtpSendRateLimitedError extends BusinessError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      'OTP_SEND_RATE_LIMITED',
      'too_many_requests',
      'Too many OTP requests. Try again after the lock expires.',
    );
  }
}
