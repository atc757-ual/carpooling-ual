import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
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

  it('loads the privacy policy from public/legal and shows it', async () => {
    const root = await open('privacy');

    http
      .expectOne('legal/politica-de-privacidad.html')
      .flush('<h2>Responsable</h2><script>alert(1)</script>');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('.legal h2')?.textContent).toBe('Responsable');
    });
    expect(root.querySelector('ion-title')?.textContent).toBe('Política de privacidad');
    expect(root.querySelector('.legal script')).toBeNull();
  });

  it('explains when the text cannot be loaded', async () => {
    const root = await open('terms');

    http.expectOne('legal/condiciones-de-uso.html').error(new ProgressEvent('error'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'No hemos podido cargar el texto',
      );
    });
  });

  it('closes itself', async () => {
    await open('terms');
    http.expectOne('legal/condiciones-de-uso.html').flush('');

    await fixture.componentInstance.close();

    expect(dismiss).toHaveBeenCalled();
  });
});
