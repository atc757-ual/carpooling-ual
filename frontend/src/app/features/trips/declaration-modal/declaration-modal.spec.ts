import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DeclarationModal } from './declaration-modal';

describe('DeclarationModal', () => {
  let modal: DeclarationModal;
  let root: HTMLElement;
  let dismiss: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dismiss = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [DeclarationModal],
      providers: [provideIonicAngular(), { provide: ModalController, useValue: { dismiss } }],
    });
    const fixture = TestBed.createComponent(DeclarationModal);
    modal = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('explains the licence, the insurance and that nobody checks them', () => {
    const text = root.textContent ?? '';

    expect(text).toContain('permiso de conducir en vigor');
    expect(text).toContain('seguro obligatorio en vigor');
    expect(text).toContain('no comprueba tu permiso ni tu seguro');
  });

  it('closes accepting or just closing', async () => {
    await modal.accept();
    await modal.close();

    expect(dismiss.mock.calls).toEqual([[true, 'accept'], []]);
  });
});
