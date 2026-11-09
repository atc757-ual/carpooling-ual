import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../../core/models/api-error.model';
import { IncidentsService } from '../../../../core/services/incidents/incidents.service';
import { PassengerIncidentModal } from './passenger-incident-modal';

describe('PassengerIncidentModal', () => {
  let fixture: ComponentFixture<PassengerIncidentModal>;
  let component: PassengerIncidentModal;

  const reportTripIncident = vi.fn().mockResolvedValue({ id: 'inc-1' });
  const dismiss = vi.fn().mockResolvedValue(true);

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PassengerIncidentModal],
      providers: [
        provideIonicAngular(),
        { provide: ModalController, useValue: { dismiss } },
        { provide: IncidentsService, useValue: { reportTripIncident } },
      ],
    });

    fixture = TestBed.createComponent(PassengerIncidentModal);
    component = fixture.componentInstance;
    component.tripId = 'trip-123';
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('initializes with default category and invalid form when description is empty', () => {
    expect(component.selectedCategory()).toBe('technical');
    expect(component.isFormValid()).toBe(false);
  });

  it('lets the passenger say she felt in danger', () => {
    expect(component.categories.map(({ value }) => value)).toEqual([
      'technical',
      'driver',
      'safety',
      'other',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Me he sentido en peligro');
  });

  it('validates description length correctly', () => {
    component.handleDescriptionInput(
      new CustomEvent('ionInput', { detail: { value: 'Too short' } }),
    );
    expect(component.isFormValid()).toBe(false);

    component.handleDescriptionInput(
      new CustomEvent('ionInput', {
        detail: { value: 'El conductor conduce con el móvil en la mano.' },
      }),
    );
    expect(component.isFormValid()).toBe(true);
  });

  it('calls incidentsService.reportTripIncident and dismisses with confirm on success', async () => {
    component.selectedCategory.set('driver');
    component.description.set('El conductor conduce con el móvil en la mano.');

    await component.handleConfirm();

    expect(reportTripIncident).toHaveBeenCalledWith('trip-123', {
      category: 'driver',
      description: 'El conductor conduce con el móvil en la mano.',
    });
    expect(dismiss).toHaveBeenCalledWith({ reported: true }, 'confirm');
  });

  it('sets errorMessage and does not dismiss when reportTripIncident fails', async () => {
    reportTripIncident.mockRejectedValueOnce(new ApiError('TRIP_NOT_IN_PROGRESS', 409));
    component.description.set('El conductor conduce con el móvil en la mano.');

    await component.handleConfirm();

    expect(component.errorMessage()).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('dismisses modal on cancel', async () => {
    await component.handleCancel();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
