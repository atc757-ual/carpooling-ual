import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { LegalDocument, LegalModal } from './legal-modal';

describe('LegalModal', () => {
  let fixture: ComponentFixture<LegalModal>;
  let http: HttpTestingController;
  let dismiss: ReturnType<typeof vi.fn>;

  async function open(document: LegalDocument): Promise<HTMLElement> {
    dismiss = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslocoTestingSupport(),
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LegalModal);
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('loads the current privacy policy from the API and shows it', async () => {
    const root = await open('privacy');

    http.expectOne('/api/legal-documents/privacy').flush({
      type: 'privacy',
      version: '1.1',
      content: '<h2>Responsable</h2><script>alert(1)</script>',
      changeType: 'minor',
      summary: 'Aclaramos quién es el responsable.',
      publishedAt: '2026-11-02T10:00:00.000Z',
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('.legal h2')?.textContent).toBe('Responsable');
    });
    expect(root.querySelector('ion-title')?.textContent).toBe('Política de privacidad');
    expect(root.querySelector('.legal script')).toBeNull();
    // «Qué ha cambiado», encima del texto completo
    const changes = root.querySelector('.legal-changes')?.textContent ?? '';
    expect(changes).toContain('Qué ha cambiado en la versión 1.1');
    expect(changes).toContain('Aclaramos quién es el responsable.');
  });

  it('explains when the text cannot be loaded', async () => {
    const root = await open('terms');

    http.expectOne('/api/legal-documents/terms').error(new ProgressEvent('error'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'No hemos podido cargar el texto',
      );
    });
  });

  it('tells only once the end of the text is on screen', async () => {
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const root = await open('terms');
    const onReachedEnd = vi.fn();
    fixture.componentInstance.onReachedEnd = onReachedEnd;

    http
      .expectOne('/api/legal-documents/terms')
      .flush({ type: 'terms', version: '1.0', content: '<p>Texto</p>', publishedAt: null });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('.legal__end')).not.toBeNull();
    });

    notify([{ isIntersecting: false }]);
    expect(onReachedEnd).not.toHaveBeenCalled();

    notify([{ isIntersecting: true }]);
    expect(onReachedEnd).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // Sin ✕: se cierra con «Entendido», al final del texto
  it('closes with «Entendido» at the end of the text, without the ✕', async () => {
    await open('terms');
    http
      .expectOne('/api/legal-documents/terms')
      .flush({ type: 'terms', version: '1.0', content: '', publishedAt: null });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.modal-close-button')).toBeNull();
    const form = root.querySelector('.modal-body .legal__footer') as HTMLFormElement;
    expect(form.textContent?.trim()).toBe(fixture.componentInstance.understoodLabel);
    form.dispatchEvent(new Event('submit'));

    expect(dismiss).toHaveBeenCalled();
  });
});
