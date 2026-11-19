import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError, NETWORK_ERROR } from '../../../../core/models/api-error.model';
import {
  LegalDocumentsService,
  LegalDocumentView,
} from '../../../../core/services/users/legal-documents.service';
import { LegalDocumentText } from './legal-document';

const TERMS: LegalDocumentView = {
  type: 'terms',
  version: '1.1',
  content: '<h2>Condiciones</h2><p>Texto de las condiciones.</p>',
  changeType: 'minor',
  summary: 'Se añade el chat directo.',
  publishedAt: '2026-11-10T09:00:00Z',
};

// Un IntersectionObserver que los tests disparan a mano
class ManualObserver {
  static last: ManualObserver | null = null;
  readonly disconnect = vi.fn();
  constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
    ManualObserver.last = this;
  }
  observe(): void {
    // Se dispara con intersect()
  }
  intersect(): void {
    this.callback([{ isIntersecting: true }]);
  }
}

describe('LegalDocumentText', () => {
  const getCurrent = vi.fn();
  let fixture: ComponentFixture<LegalDocumentText>;

  async function render(isEndTracked = false): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [LegalDocumentText],
      providers: [
        provideIonicAngular(),
        provideAppTransloco(),
        { provide: LegalDocumentsService, useValue: { getCurrent } },
      ],
    });
    fixture = TestBed.createComponent(LegalDocumentText);
    fixture.componentRef.setInput('type', 'terms');
    fixture.componentRef.setInput('isEndTracked', isEndTracked);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    getCurrent.mockReset();
    ManualObserver.last = null;
    vi.stubGlobal('IntersectionObserver', ManualObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the current version with what has changed above it', async () => {
    getCurrent.mockResolvedValue(TERMS);
    const root = await render();

    expect(getCurrent).toHaveBeenCalledWith('terms');
    expect(root.querySelector('app-legal-changes')?.textContent).toContain(
      'Qué ha cambiado en la versión 1.1',
    );
    expect(root.querySelector('article.legal')?.textContent).toContain('Texto de las condiciones.');
  });

  it('says so when the text cannot be loaded', async () => {
    getCurrent.mockRejectedValue(new ApiError(NETWORK_ERROR, 0));
    const root = await render();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No hemos podido cargar el texto',
    );
    expect(root.querySelector('article')).toBeNull();
  });

  it('shows a spinner while it loads', async () => {
    getCurrent.mockReturnValue(new Promise(() => undefined));
    const root = await render();

    expect(root.querySelector('ion-spinner')?.getAttribute('aria-label')).toBe('Cargando el texto');
  });

  it('tells when the end has been read, only if it is tracked', async () => {
    getCurrent.mockResolvedValue(TERMS);
    await render(true);
    const reached = vi.fn();
    fixture.componentInstance.reachedEnd.subscribe(reached);

    ManualObserver.last?.intersect();

    expect(reached).toHaveBeenCalledTimes(1);
    expect(ManualObserver.last?.disconnect).toHaveBeenCalled();
  });

  it('does not watch the end when nobody tracks it', async () => {
    getCurrent.mockResolvedValue(TERMS);
    await render();

    expect(ManualObserver.last).toBeNull();
  });
});
