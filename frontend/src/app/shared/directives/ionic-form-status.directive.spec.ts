import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonInput, provideIonicAngular } from '@ionic/angular';
import { IonicFormStatus } from './ionic-form-status.directive';

@Component({
  imports: [ReactiveFormsModule, IonInput, IonicFormStatus],
  template: `<form [formGroup]="form"><ion-input formControlName="email" /></form>`,
})
class Host {
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
}

describe('IonicFormStatus', () => {
  it('copies the state of the control to the Ionic field after each render', async () => {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('ion-input');

    expect(input?.classList).toContain('ion-invalid');
    expect(input?.classList).toContain('ion-untouched');

    const email = fixture.componentInstance.form.controls.email;
    email.setValue('ana@ual.es');
    email.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input?.classList).toContain('ion-valid');
    expect(input?.classList).toContain('ion-touched');
    expect(input?.classList).not.toContain('ion-invalid');
  });
});
