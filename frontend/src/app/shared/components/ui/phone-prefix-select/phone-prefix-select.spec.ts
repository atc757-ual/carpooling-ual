import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular';
import { PhonePrefixSelect } from './phone-prefix-select';

// Un formulario cualquiera que usa el campo, como el registro
@Component({
  imports: [ReactiveFormsModule, PhonePrefixSelect],
  template: `<app-phone-prefix-select [formControl]="prefix" />`,
})
class HostForm {
  readonly prefix = new FormControl('+34', { nonNullable: true });
}

describe('PhonePrefixSelect', () => {
  let fixture: ComponentFixture<HostForm>;
  let host: HostForm;
  let select: PhonePrefixSelect;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostForm],
      providers: [provideIonicAngular()],
    });
    fixture = TestBed.createComponent(HostForm);
    host = fixture.componentInstance;
    fixture.detectChanges();
    select = fixture.debugElement.query(By.directive(PhonePrefixSelect))
      .componentInstance as PhonePrefixSelect;
  });

  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.prefix-select__trigger')!;
  }

  it('shows the flag and the code of the form value', () => {
    expect(trigger().textContent).toContain('+34');
    expect(trigger().querySelector('.fi')?.classList).toContain('fi-es');
    expect(trigger().getAttribute('aria-label')).toBe('Prefijo del país: +34');
  });

  it('follows the value the form sets', () => {
    host.prefix.setValue('+44');
    fixture.detectChanges();

    expect(trigger().querySelector('.fi')?.classList).toContain('fi-gb');
  });

  it('passes the chosen prefix to the form, which becomes touched', () => {
    select.handleChoose('+39');

    expect(host.prefix.value).toBe('+39');
    expect(host.prefix.touched).toBe(true);
    expect(select.country()).toBe('it');
  });

  it('cannot be opened when the form disables it', () => {
    host.prefix.disable();
    fixture.detectChanges();

    expect(trigger().disabled).toBe(true);
  });
});
