import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ToastService } from '../../../core/services/ui/toast.service';
import { PassengerIncidentModal } from '../passenger-requests/passenger-incident-modal/passenger-incident-modal';
import { AfterTripReport } from './after-trip-report';

describe('AfterTripReport', () => {
  let fixture: ComponentFixture<AfterTripReport>;
  let create: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;

  async function render(role: string | undefined): Promise<HTMLElement> {
    create = vi.fn().mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
      onWillDismiss: vi.fn().mockResolvedValue({ role }),
    });
    showSuccess = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [AfterTripReport],
      providers: [
        provideIonicAngular(),
        { provide: ModalController, useValue: { create } },
        { provide: ToastService, useValue: { showSuccess } },
      ],
    });
    fixture = TestBed.createComponent(AfterTripReport);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.componentRef.setInput('isDriver', true);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('opens the report form for the trip, without a card of its own', async () => {
    const root = await render(undefined);

    expect(root.querySelector('ion-card')).toBeNull();
    expect(root.textContent).toContain('Repórtalo en los 7 días siguientes');
    (root.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({
      component: PassengerIncidentModal,
      componentProps: { tripId: 't1', isDriver: true, isAfterTrip: true },
    });
    // Cerrado sin enviar: sigue ofreciendo reportar
    expect(fixture.componentInstance.isSent()).toBe(false);
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('thanks the user and hides the button once the report is sent', async () => {
    const root = await render('confirm');

    await fixture.componentInstance.handleReport();
    fixture.detectChanges();

    expect(showSuccess).toHaveBeenCalledWith('Reporte enviado: lo revisará un administrador.');
    expect(root.textContent).toContain('Gracias: lo revisará un administrador.');
    expect(root.querySelector('button')).toBeNull();
  });
});
