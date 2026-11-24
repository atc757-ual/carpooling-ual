import { BusinessError } from '../../../shared/errors/business-error';

// Los días que se repiten no valen: alguno no existe, no es posterior al
// primero o pasa de un mes desde hoy, o hay repetidos. La capa API lo traduce
// a un 400 (INVALID_REPEAT_DATES)
export class InvalidRepeatDatesError extends BusinessError {
  constructor(
    readonly date: string | null,
    readonly firstDate: string,
    readonly lastDate: string,
  ) {
    super(
      'INVALID_REPEAT_DATES',
      'invalid',
      date === null
        ? 'The repeat dates must be different, and at most 30'
        : `The repeat date ${date} must be after ${firstDate} and no later than ${lastDate}`,
    );
  }
}
