import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { SeatStepper } from './seat-stepper';

@Component({
  imports: [ReactiveFormsModule, SeatStepper],
  template: `<app-seat-stepper [formControl]="seats" label="Plazas" [max]="3" hint="Hasta 3" />`,
})
class Host {
  readonly seats = new FormControl(2, { nonNullable: true });
}

describe('SeatStepper', () => {
  let host: Host;
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const button = (label: string): HTMLButtonElement =>
    root.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

  it('shows the label, the value and the hint', () => {
    expect(root.querySelector('legend')?.textContent?.trim()).toBe('Plazas');
    expect(root.querySelector('output')?.textContent?.trim()).toBe('2');
    expect(root.textContent).toContain('Hasta 3');
  });

  it('adds and removes seats within the limits', () => {
    button('Una plaza más').click();
    button('Una plaza más').click();

    expect(host.seats.value).toBe(3);
    expect(host.seats.touched).toBe(true);

    for (let i = 0; i < 4; i++) {
      button('Una plaza menos').click();
    }
    expect(host.seats.value).toBe(1);
  });

  it('follows the form and can be disabled', async () => {
    host.seats.setValue(3);
    host.seats.disable();
    TestBed.tick();

    expect(root.querySelector('output')?.textContent?.trim()).toBe('3');
    expect(button('Una plaza más').disabled).toBe(true);
    expect(button('Una plaza menos').disabled).toBe(true);
  });
});
