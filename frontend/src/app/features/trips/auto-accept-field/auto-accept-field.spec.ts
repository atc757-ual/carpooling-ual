import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { TranslocoService } from '@jsverse/transloco';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { AutoAcceptField } from './auto-accept-field';

describe('AutoAcceptField', () => {
  function render(lang: 'es' | 'en' = 'es'): {
    root: HTMLElement;
    control: FormControl<boolean>;
  } {
    TestBed.configureTestingModule({
      imports: [AutoAcceptField],
      providers: [provideIonicAngular(), provideAppTransloco()],
    });
    TestBed.inject(TranslocoService).setActiveLang(lang);
    const fixture = TestBed.createComponent(AutoAcceptField);
    const control = new FormControl(false, { nonNullable: true });
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, control };
  }

  it('offers to accept the requests that fit, off by default', () => {
    const { root, control } = render();

    expect(root.querySelector('ion-toggle')?.textContent).toContain(
      'Aceptar solicitudes automáticamente',
    );
    expect(root.textContent).toContain('Si no cabe, la solicitud te esperará');
    expect(control.value).toBe(false);
  });

  it('is translated to English', () => {
    const { root } = render('en');

    expect(root.querySelector('ion-toggle')?.textContent).toContain(
      'Accept requests automatically',
    );
  });
});
