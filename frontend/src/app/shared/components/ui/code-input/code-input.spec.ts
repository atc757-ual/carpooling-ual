import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { CodeInput } from './code-input';

// Un formulario cualquiera que usa el campo, como las pantallas
@Component({
  imports: [ReactiveFormsModule, CodeInput],
  template: `
    <span id="code-label">Código</span>
    <app-code-input
      [formControl]="code"
      labelledBy="code-label"
      (completed)="completions = completions + 1"
    />
  `,
})
class HostForm {
  readonly code = new FormControl('', { nonNullable: true, validators: Validators.required });
  completions = 0;
}

describe('CodeInput', () => {
  let fixture: ComponentFixture<HostForm>;
  let host: HostForm;
  let input: CodeInput;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostForm],
      providers: [provideIonicAngular()],
    });
    fixture = TestBed.createComponent(HostForm);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = fixture.debugElement.query(By.directive(CodeInput)).componentInstance as CodeInput;
  });

  // El control interno de las casillas (el que usa Ionic)
  function boxes(): FormControl<string> {
    return (input as unknown as { code: FormControl<string> }).code;
  }

  it('renders six boxes that offer the code received', () => {
    const otp = fixture.nativeElement.querySelector('ion-input-otp') as HTMLIonInputOtpElement;

    expect(otp.length).toBe(6);
    expect(otp.getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('passes what is typed to the form, which becomes touched', () => {
    boxes().setValue('042137');

    expect(host.code.value).toBe('042137');
    expect(host.code.touched).toBe(true);
  });

  it('shows the value the form sets and clears it untouched', () => {
    host.code.setValue('123456');
    expect(boxes().value).toBe('123456');

    boxes().markAsTouched();
    host.code.reset();

    expect(boxes().value).toBe('');
    expect(boxes().touched).toBe(false);
  });

  it('follows the form when it is disabled and enabled', () => {
    host.code.disable();
    expect(boxes().disabled).toBe(true);

    host.code.enable();
    expect(boxes().enabled).toBe(true);
  });

  it('tells when the six boxes are filled, to send the code without a button', () => {
    const otp = fixture.nativeElement.querySelector('ion-input-otp') as HTMLElement;

    otp.dispatchEvent(new CustomEvent('ionComplete', { detail: { value: '042619' } }));

    expect(host.completions).toBe(1);
  });

  it('shakes, vibrates and stays red until a box gets the focus when the code is wrong', () => {
    vi.useFakeTimers();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((step) => {
      step(0);
      return 0;
    });

    input.shake();

    expect(input.isShaking()).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(400);
    vi.advanceTimersByTime(400);
    expect(input.isShaking()).toBe(false);
    // Sigue en rojo hasta que se pincha para escribir
    expect(input.isWrong()).toBe(true);
    fixture.nativeElement
      .querySelector('ion-input-otp')
      .dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(input.isWrong()).toBe(false);
    vi.useRealTimers();
  });
});
