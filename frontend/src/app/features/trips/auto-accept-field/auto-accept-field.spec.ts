import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { AutoAcceptField } from './auto-accept-field';

describe('AutoAcceptField', () => {
  it('offers to accept the requests that fit, off by default', () => {
    TestBed.configureTestingModule({
      imports: [AutoAcceptField],
      providers: [provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(AutoAcceptField);
    const control = new FormControl(false, { nonNullable: true });
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('ion-toggle')?.textContent).toContain(
      'Aceptar solicitudes automáticamente',
    );
    expect(root.textContent).toContain('Si no cabe, la solicitud te esperará');
    expect(control.value).toBe(false);
  });
});
