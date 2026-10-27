import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { DatetimeField, DatetimePresentation } from './datetime-field';

@Component({
  imports: [ReactiveFormsModule, DatetimeField],
  template: `
    <app-datetime-field [formControl]="value" [label]="label()" [presentation]="presentation()" />
  `,
})
class Host {
  readonly value = new FormControl('2026-10-27', { nonNullable: true });
  readonly label = signal('Fecha');
  readonly presentation = signal<DatetimePresentation>('date');
}

describe('DatetimeField', () => {
  let host: Host;
  let field: DatetimeField;
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    field = fixture.debugElement.children[0].componentInstance as DatetimeField;
  });

  it('labels the picker button with its own ids', () => {
    const label = root.querySelector('.text-label');
    const button = root.querySelector('ion-datetime-button');

    expect(label?.textContent?.trim()).toBe('Fecha');
    expect(button?.getAttribute('aria-labelledby')).toBe(label?.id);
    const { datetime } = button as HTMLElement & { datetime?: string };
    expect(datetime).toMatch(/^datetime-field-\d+-picker$/);
    expect(root.querySelector('ion-datetime')?.id).toBe(datetime);
  });

  it('passes the value both ways', () => {
    const control = (field as unknown as { control: FormControl<string> }).control;
    expect(control.value).toBe('2026-10-27');

    control.setValue('2026-10-30');
    expect(host.value.value).toBe('2026-10-30');
    expect(host.value.touched).toBe(true);

    host.value.setValue('2026-11-02');
    expect(control.value).toBe('2026-11-02');
  });

  it('follows the label and the disabled state', () => {
    host.label.set('Hora de salida');
    host.presentation.set('time');
    host.value.disable();
    TestBed.tick();

    const control = (field as unknown as { control: FormControl<string> }).control;
    expect(root.querySelector('.text-label')?.textContent?.trim()).toBe('Hora de salida');
    expect(control.disabled).toBe(true);
    host.value.enable();
    expect(control.disabled).toBe(false);
  });
});
