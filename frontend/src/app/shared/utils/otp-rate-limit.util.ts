import { WritableSignal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { ApiError } from '../../core/models/api-error.model';
import { Countdown } from './countdown.util';

export function applyOtpRateLimit(
  error: ApiError,
  isRateLimited: WritableSignal<boolean>,
  code: AbstractControl,
  countdown: Countdown,
): void {
  isRateLimited.set(true);
  code.disable();
  countdown.restart(error.retryAfterSeconds ?? 300);
}
