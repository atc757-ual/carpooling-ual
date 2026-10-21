import type { Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestIdMiddleware', () => {
  function run(clientRequestId?: string): string {
    const request = { get: () => clientRequestId } as unknown as Request;
    const setHeader = jest.fn();
    const next = jest.fn();

    requestIdMiddleware(request, { setHeader } as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    return (setHeader.mock.calls[0] as [string, string])[1];
  }

  it('reuses a valid id sent by the client', () => {
    expect(run('client-id_1.2')).toBe('client-id_1.2');
  });

  it('generates a uuid when the client sends none', () => {
    expect(run()).toMatch(UUID_PATTERN);
  });

  it.each([
    ['with a line break', 'abc\nfake log line'],
    ['with spaces', 'abc def'],
    ['empty', ''],
    ['longer than 128 characters', 'a'.repeat(129)],
  ])('replaces an invalid id (%s) with a uuid', (_case, clientRequestId) => {
    expect(run(clientRequestId)).toMatch(UUID_PATTERN);
  });
});
