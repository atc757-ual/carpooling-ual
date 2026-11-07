import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatContact } from '../../models/chat.model';
import { ChatService } from '../chat/chat.service';
import { ToastService } from '../ui/toast.service';
import { provideTranslocoTestingSupport } from '../../i18n/testing-transloco';
import { TripCallService } from './trip-call.service';

describe('TripCallService', () => {
  let service: TripCallService;
  let chatMock: { listContacts: ReturnType<typeof vi.fn> };
  let toastMock: { showInfo: ReturnType<typeof vi.fn> };

  const CONTACT: ChatContact = {
    id: 'u1',
    name: 'Lucía Cortés',
    phone: '+34600111222',
    role: 'driver',
  };

  beforeEach(() => {
    chatMock = { listContacts: vi.fn().mockResolvedValue([CONTACT]) };
    toastMock = { showInfo: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        TripCallService,
        { provide: ChatService, useValue: chatMock },
        { provide: ToastService, useValue: toastMock },
        provideTranslocoTestingSupport({
          en: {
            common: {
              tripCall: {
                call: 'Call',
                callTo: 'Call {{ name }}',
                onlyAllowed: 'Calls are only available with the trip confirmed or in progress.',
                noVerifiedPhone: 'Nobody else on this trip has a verified phone number.',
              },
            },
          },
        }),
      ],
    });

    TestBed.inject(TranslocoService).setActiveLang('en');
    service = TestBed.inject(TripCallService);
  });

  it('loads contacts delegating to ChatService', async () => {
    const contacts = await service.loadContacts('t1');
    expect(chatMock.listContacts).toHaveBeenCalledWith('t1');
    expect(contacts).toEqual([CONTACT]);
  });

  it('returns empty array if loading contacts fails', async () => {
    chatMock.listContacts.mockRejectedValueOnce(new Error('Network error'));
    const contacts = await service.loadContacts('t1');
    expect(contacts).toEqual([]);
  });

  it('validates if calling is possible based on trip status and verified phone', () => {
    expect(service.canCall('confirmed', CONTACT)).toBe(true);
    expect(service.canCall('in_progress', CONTACT)).toBe(true);
    expect(service.canCall('published', CONTACT)).toBe(false);
    expect(service.canCall('finished', CONTACT)).toBe(false);
    expect(service.canCall('confirmed', { ...CONTACT, phone: '' })).toBe(false);
    expect(service.canCall('confirmed', null)).toBe(false);
  });

  it('opens phone URL on openPhone', () => {
    const originalLocation = globalThis.location;
    try {
      const mockLocation = { href: '' };
      Object.defineProperty(globalThis, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true,
      });

      service.openPhone('+34600111222');
      expect(mockLocation.href).toBe('tel:+34600111222');
    } finally {
      Object.defineProperty(globalThis, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it('returns explanatory reason when call is unavailable', () => {
    expect(service.getUnavailableReason('published')).toContain(
      'Calls are only available with the trip confirmed or in progress.',
    );
    expect(service.getUnavailableReason('confirmed')).toContain(
      'Nobody else on this trip has a verified phone number.',
    );
    expect(service.getUnavailableReason('in_progress')).toContain(
      'Nobody else on this trip has a verified phone number.',
    );
  });

  it('calls openPhone when canCall is true', () => {
    const openPhoneSpy = vi.spyOn(service, 'openPhone').mockImplementation(() => undefined);
    service.call(CONTACT, 'confirmed');
    expect(openPhoneSpy).toHaveBeenCalledWith('+34600111222');
    expect(toastMock.showInfo).not.toHaveBeenCalled();
  });

  it('shows informational toast when canCall is false', () => {
    const openPhoneSpy = vi.spyOn(service, 'openPhone').mockImplementation(() => undefined);
    service.call(null, 'published');
    expect(openPhoneSpy).not.toHaveBeenCalled();
    expect(toastMock.showInfo).toHaveBeenCalledWith(
      'Calls are only available with the trip confirmed or in progress.',
    );
  });

  it('generates call label with name or fallback', () => {
    expect(service.callLabel(CONTACT)).toBe('Call Lucía Cortés');
    expect(service.callLabel(null, 'Mario')).toBe('Call Mario');
    expect(service.callLabel(null)).toBe('Call');
  });
});
