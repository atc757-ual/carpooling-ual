import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { PublishDraft, PublishDraftService } from './publish-draft.service';

const NOW = new Date('2026-11-28T10:00:00Z');
const DRAFT: PublishDraft = { savedAt: '2026-11-27T10:00:00.000Z', step: 2, value: { seats: 2 } };

describe('PublishDraftService', () => {
  let stored: Map<string, string>;
  let beforeLogout: () => Promise<void>;
  let service: PublishDraftService;

  beforeEach(() => {
    stored = new Map();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PreferencesPlugin,
          useValue: {
            get: (key: string) => Promise.resolve(stored.get(key) ?? null),
            set: (key: string, value: string) => Promise.resolve(void stored.set(key, value)),
            remove: (key: string) => Promise.resolve(void stored.delete(key)),
          },
        },
        {
          provide: AuthService,
          useValue: {
            onBeforeLogout: vi.fn((task: () => Promise<void>) => (beforeLogout = task)),
          },
        },
      ],
    });
    service = TestBed.inject(PublishDraftService);
  });

  it('keeps the draft on the device and gives it back', async () => {
    await service.save(DRAFT);

    expect(await service.load(NOW)).toEqual(DRAFT);
  });

  it('forgets it on request and when the session is closed', async () => {
    await service.save(DRAFT);
    await service.remove();
    expect(await service.load(NOW)).toBeNull();

    await service.save(DRAFT);
    await beforeLogout();
    expect(await service.load(NOW)).toBeNull();
  });

  // Más de 7 días: la fecha ya no serviría
  it('drops a draft older than a week', async () => {
    await service.save({ ...DRAFT, savedAt: '2026-11-20T09:00:00.000Z' });

    expect(await service.load(NOW)).toBeNull();
    expect(stored.size).toBe(0);
  });

  it('drops what is not a draft', async () => {
    stored.set('trips.publish-draft', '{"step":"2"}');
    expect(await service.load(NOW)).toBeNull();

    stored.set('trips.publish-draft', 'not json');
    expect(await service.load(NOW)).toBeNull();
    expect(stored.size).toBe(0);
  });
});
