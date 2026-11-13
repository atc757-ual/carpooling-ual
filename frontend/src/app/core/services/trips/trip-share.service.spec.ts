import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { buildWhatsAppUrl, ShareContent, TripShareService } from './trip-share.service';

const CONTENT: ShareContent = {
  title: 'Carpooling UAL',
  text: 'Tengo 2 plazas libres: Roquetas → Campus',
  url: 'https://carpooling.example',
};

describe('TripShareService', () => {
  let service: TripShareService;
  let open: ReturnType<typeof vi.fn>;
  const originalShare = Object.getOwnPropertyDescriptor(globalThis.navigator, 'share');

  function mockShare(implementation?: () => Promise<void>): ReturnType<typeof vi.fn> {
    const share = vi.fn(implementation ?? (() => Promise.resolve()));
    Object.defineProperty(globalThis.navigator, 'share', { value: share, configurable: true });
    return share;
  }

  beforeEach(() => {
    service = TestBed.inject(TripShareService);
    open = vi.fn();
    vi.stubGlobal('open', open);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalShare) {
      Object.defineProperty(globalThis.navigator, 'share', originalShare);
    } else {
      Reflect.deleteProperty(globalThis.navigator, 'share');
    }
  });

  it('builds a WhatsApp link with the text and the link on separate lines', () => {
    expect(buildWhatsAppUrl(CONTENT)).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${CONTENT.text}\n${CONTENT.url}`)}`,
    );
    expect(buildWhatsAppUrl({ title: 'x', text: 'Hola & adiós' })).toBe(
      'https://wa.me/?text=Hola%20%26%20adi%C3%B3s',
    );
  });

  it('uses the system share sheet when the browser has one', async () => {
    const share = mockShare();

    await expect(service.share(CONTENT)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(CONTENT);
    expect(open).not.toHaveBeenCalled();
  });

  it('does nothing else when the user closes the share sheet', async () => {
    mockShare(() => Promise.reject(new DOMException('closed', 'AbortError')));

    await expect(service.share(CONTENT)).resolves.toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to WhatsApp when the share sheet is not allowed', async () => {
    mockShare(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));

    await expect(service.share(CONTENT)).resolves.toBe('whatsapp');
    expect(open).toHaveBeenCalledWith(buildWhatsAppUrl(CONTENT), '_blank', 'noopener');
  });

  it('lets unexpected share errors through', async () => {
    const failure = new DOMException('bad data', 'DataError');
    mockShare(() => Promise.reject(failure));

    await expect(service.share(CONTENT)).rejects.toBe(failure);
  });

  it('opens WhatsApp when the browser cannot share', async () => {
    Object.defineProperty(globalThis.navigator, 'share', {
      value: undefined,
      configurable: true,
    });

    await expect(service.share(CONTENT)).resolves.toBe('whatsapp');
    expect(open).toHaveBeenCalledWith(buildWhatsAppUrl(CONTENT), '_blank', 'noopener');
  });
});
