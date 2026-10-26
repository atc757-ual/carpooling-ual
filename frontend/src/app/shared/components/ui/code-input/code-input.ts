import { Component, DestroyRef, forwardRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonInputOtp } from '@ionic/angular';
import { IonicFormStatus } from '../../../directives/ionic-form-status.directive';

const CODE_LENGTH = 6;

// Código de 6 cifras enviado por correo (verificar el correo, recuperar la
// contraseña): seis casillas, y pegar el código del correo lo reparte entre
// ellas. Se usa como cualquier campo de un formulario reactivo:
// <app-code-input formControlName="code" labelledBy="id-de-la-etiqueta" />
@Component({
  selector: 'app-code-input',
  imports: [ReactiveFormsModule, IonInputOtp, IonicFormStatus],
  templateUrl: './code-input.html',
  styleUrl: './code-input.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CodeInput), multi: true },
  ],
})
export class CodeInput implements ControlValueAccessor {
  // Id de la etiqueta visible que nombra el campo (aria-labelledby)
  readonly labelledBy = input.required<string>();

  // Las casillas trabajan con su propio control (el de Ionic); este componente
  // lo mantiene igual que el del formulario que lo usa. Con sus validadores
  // para que las casillas se vean en rojo si el código está incompleto
  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });
  protected readonly codeLength = CODE_LENGTH;

  private onChange: (code: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.code.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((code) => {
      this.onChange(code);
      this.onTouched();
    });
  }

  // Con reset y no setValue: al vaciarlo el formulario (p. ej. tras un código
  // incorrecto), las casillas vuelven a estar sin tocar, no en rojo
  writeValue(code: string | null): void {
    this.code.reset(code ?? '', { emitEvent: false });
  }

  registerOnChange(onChange: (code: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  // La firma la fija Angular (ControlValueAccessor)
  setDisabledState(isDisabled: boolean): void {
    const action = isDisabled ? 'disable' : 'enable';
    this.code[action]({ emitEvent: false });
  }
}
