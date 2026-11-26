import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../i18n/testing-transloco';
import { ToastService } from '../ui/toast.service';
import { buildWhatsAppUrl, ShareContent, TripShareService } from './trip-share.service';

const CONTENT: ShareContent = {
  title: 'Carpooling UAL',
  text: 'Tengo 2 plazas libres: Roquetas → Campus',
  url: 'https://carpooling.example',
};

describe('TripShareService', () => {
  let service: TripShareService;
  let open: ReturnType<typeof vi.fn>;
  let toast: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };
  const originalShare = Object.getOwnPropertyDescriptor(globalThis.navigator, 'share');
  const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');

  function mockShare(implementation?: () => Promise<void>): ReturnType<typeof vi.fn> {
    const share = vi.fn(implementation ?? (() => Promise.resolve()));
    Object.defineProperty(globalThis.navigator, 'share', { value: share, configurable: true });
    return share;
  }

  function mockClipboard(
    implementation?: (text: string) => Promise<void>,
  ): ReturnType<typeof vi.fn> {
    const writeText = vi.fn(implementation ?? (() => Promise.resolve()));
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  }

  beforeEach(() => {
    toast = {
      showSuccess: vi.fn().mockResolvedValue(undefined),
      showError: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [provideAppTransloco(), { provide: ToastService, useValue: toast }],
    });
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
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(globalThis.navigator, 'clipboard');
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

  it('copies the link to clipboard when sharing is not allowed and url is present', async () => {
    mockShare(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    const writeText = mockClipboard();

    await expect(service.share(CONTENT)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(CONTENT.url);
    expect(toast.showSuccess).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to WhatsApp when share sheet is not allowed and there is no url', async () => {
    mockShare(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    const textOnly = { title: 'x', text: 'Hola' };

    await expect(service.share(textOnly)).resolves.toBe('whatsapp');
    expect(open).toHaveBeenCalledWith(buildWhatsAppUrl(textOnly), '_blank', 'noopener');
  });

  it('lets unexpected share errors through', async () => {
    const failure = new DOMException('bad data', 'DataError');
    mockShare(() => Promise.reject(failure));

    await expect(service.share(CONTENT)).rejects.toBe(failure);
  });

  it('copies link to clipboard when browser cannot share and url is present', async () => {
    Object.defineProperty(globalThis.navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    const writeText = mockClipboard();

    await expect(service.share(CONTENT)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(CONTENT.url);
    expect(toast.showSuccess).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens WhatsApp when browser cannot share and there is no url', async () => {
    Object.defineProperty(globalThis.navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    const textOnly = { title: 'x', text: 'Hola' };

    await expect(service.share(textOnly)).resolves.toBe('whatsapp');
    expect(open).toHaveBeenCalledWith(buildWhatsAppUrl(textOnly), '_blank', 'noopener');
  });

  it('falls back to WhatsApp when clipboard write fails', async () => {
    Object.defineProperty(globalThis.navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    mockClipboard(() => Promise.reject(new Error('denied')));

    await expect(service.share(CONTENT)).resolves.toBe('whatsapp');
    expect(open).toHaveBeenCalledWith(buildWhatsAppUrl(CONTENT), '_blank', 'noopener');
  });
});
