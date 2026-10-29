import {
  Component,
  afterNextRender,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { IonInputOtp } from '@ionic/angular';

const CODE_LENGTH = 6;
// Lo que dura el tintineo (el de code-input.scss)
const SHAKE_MS = 400;
// Lo que admite cada casilla: una cifra
const DIGIT_PATTERN = '[0-9]';

// Código de 6 cifras enviado por correo (verificar el correo, recuperar la
// contraseña): seis casillas, y pegar el código del correo lo reparte entre
// ellas. Se usa como cualquier campo de un formulario reactivo:
// <app-code-input formControlName="code" labelledBy="id-de-la-etiqueta"
//   (completed)="handleSubmit()" />
// Sin botón de enviar: al completar las seis casillas avisa (completed); si el
// código es incorrecto, quien lo usa llama a shake()
@Component({
  selector: 'app-code-input',
  imports: [ReactiveFormsModule, IonInputOtp],
  templateUrl: './code-input.html',
  styleUrl: './code-input.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CodeInput), multi: true },
  ],
})
export class CodeInput implements ControlValueAccessor {
  // Id de la etiqueta visible que nombra el campo (aria-labelledby)
  readonly labelledBy = input.required<string>();
  // Las seis casillas rellenas (escritas o pegadas): se puede enviar
  readonly completed = output<void>();
  readonly isShaking = signal(false);
  // Código incorrecto: borde rojo hasta que se vuelve a escribir (foco)
  readonly isWrong = signal(false);
  private readonly otpElement = viewChild(IonInputOtp, { read: ElementRef });

  // Las casillas trabajan con su propio control (el de Ionic); este componente
  // lo mantiene igual que el del formulario que lo usa. Sin validadores: el
  // código se envía solo al completarlo y el error se ve con el rojo de 2px
  // (shake); con ellos, Ionic pintaba en rojo el código a medio escribir
  protected readonly code = new FormControl('', { nonNullable: true });
  protected readonly codeLength = CODE_LENGTH;

  private onChange: (code: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Solo cifras en cada casilla (ver code-input.html)
    afterNextRender(() => {
      const element = this.otpElement()?.nativeElement as HTMLIonInputOtpElement | undefined;
      if (element) {
        element.pattern = DIGIT_PATTERN;
      }
    });
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

  // Código incorrecto: las casillas tintinean (y el móvil vibra, si puede) y
  // se quedan en rojo hasta que se pincha en una para escribirlo de nuevo
  shake(): void {
    this.isShaking.set(false);
    // En el siguiente fotograma, para que la animación vuelva a empezar
    requestAnimationFrame(() => this.isShaking.set(true));
    setTimeout(() => this.isShaking.set(false), SHAKE_MS);
    navigator.vibrate?.(SHAKE_MS);
    this.isWrong.set(true);
    // Sin foco (se quedaba en la última casilla): al pinchar, Ionic lo lleva a
    // la primera vacía y el borde vuelve al azul
    (document.activeElement as HTMLElement | null)?.blur();
  }
}
