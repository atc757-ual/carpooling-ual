import { QueryFailedError } from 'typeorm';
import { isUniqueViolation } from './postgres-errors';

function queryError(code: string, constraint: string): QueryFailedError {
  return new QueryFailedError('INSERT ...', [], { code, constraint });
}

describe('isUniqueViolation', () => {
  it('detects a duplicate value in the given constraint', () => {
    const error = queryError('23505', 'users_email_key');

    expect(isUniqueViolation(error, 'users_email_key')).toBe(true);
  });

  it('ignores duplicates in other constraints', () => {
    const error = queryError('23505', 'vehicles_plate_key');

    expect(isUniqueViolation(error, 'users_email_key')).toBe(false);
  });

  it('ignores other database errors', () => {
    const error = queryError('23503', 'users_email_key');

    expect(isUniqueViolation(error, 'users_email_key')).toBe(false);
  });

  it('ignores errors that do not come from the database', () => {
    expect(isUniqueViolation(new Error('boom'), 'users_email_key')).toBe(false);
  });
});
