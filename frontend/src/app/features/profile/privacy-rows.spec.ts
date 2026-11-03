import { ConsentRecord } from '../../core/models/user-consent.model';
import { LegalDocumentView } from '../../core/services/users/legal-documents.service';
import { toLegalDocRow } from './privacy-rows';

const ACCEPTED: ConsentRecord = {
  id: 'c1',
  type: 'privacy',
  documentVersion: '1.0',
  action: 'granted',
  source: 'registration',
  recordedAt: '2026-10-21T09:00:00.000Z',
  fingerprint: 'abcdef0123456789'.repeat(4),
  vehicleId: null,
};

const current = (version: string): LegalDocumentView => ({
  type: 'privacy',
  version,
  content: '<p>Texto</p>',
  changeType: 'minor',
  summary: 'Una aclaración.',
  publishedAt: '2026-11-03T09:00:00.000Z',
});

describe('privacy rows', () => {
  it('shows the accepted version, its date and the start of its code', () => {
    expect(toLegalDocRow('privacy', 'Política', ACCEPTED, current('1.0'))).toEqual({
      id: 'privacy',
      title: 'Política',
      acceptedVersion: '1.0',
      acceptedAt: '21 oct 2026',
      fingerprint: 'abcdef012345…',
      update: null,
    });
  });

  it('tells about a newer current version (a minor change)', () => {
    expect(toLegalDocRow('privacy', 'Política', ACCEPTED, current('1.1')).update).toEqual({
      version: '1.1',
      date: '3 nov 2026',
    });
  });

  it('shows nothing when it is not accepted or the versions are unknown', () => {
    const revoked = { ...ACCEPTED, action: 'revoked' as const };
    expect(toLegalDocRow('privacy', 'Política', revoked, current('1.1'))).toMatchObject({
      acceptedVersion: null,
      acceptedAt: null,
      update: null,
    });
    expect(toLegalDocRow('privacy', 'Política', null, undefined).acceptedAt).toBeNull();
    expect(toLegalDocRow('privacy', 'Política', ACCEPTED, undefined).update).toBeNull();
  });
});
