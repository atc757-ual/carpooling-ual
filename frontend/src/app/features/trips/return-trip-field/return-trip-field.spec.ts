import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { ReturnTripControls, ReturnTripField } from './return-trip-field';

describe('ReturnTripField', () => {
  let fixture: ComponentFixture<ReturnTripField>;
  let controls: ReturnTripControls;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReturnTripField],
      providers: [provideIonicAngular()],
    });
    controls = {
      hasReturn: new FormControl(false, { nonNullable: true }),
      returnTime: new FormControl('14:00', { nonNullable: true }),
    };
    fixture = TestBed.createComponent(ReturnTripField);
    fixture.componentRef.setInput('controls', controls);
    fixture.componentRef.setInput('arrivalTime', '08:00');
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('asks for the return time only when the box is ticked', () => {
    expect(root().querySelector('app-datetime-field')).toBeNull();

    controls.hasReturn.setValue(true);
    fixture.detectChanges();

    expect(root().querySelector('app-datetime-field')).not.toBeNull();
    expect(root().querySelector('[role="alert"]')).toBeNull();
  });

  it('warns when the return trip leaves before arriving at the campus', () => {
    controls.hasReturn.setValue(true);
    controls.returnTime.setValue('07:30');
    fixture.detectChanges();

    expect(fixture.componentInstance.isTooEarly()).toBe(true);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('(08:00)');
  });
});
