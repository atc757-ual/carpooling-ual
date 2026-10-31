import { BusinessError } from '../../../shared/errors/business-error';

export class PhoneRequiredError extends BusinessError {
  constructor() {
    super(
      'PHONE_REQUIRED',
      'conflict',
      'Save a phone number in your profile before verifying it',
    );
  }
}
