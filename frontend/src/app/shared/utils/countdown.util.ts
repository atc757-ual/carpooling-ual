import { DestroyRef, WritableSignal, signal } from '@angular/core';

export interface Countdown {
  // Segundos que faltan (0 cuando ha terminado). Modificable como cualquier
  // signal: los tests e2e lo ponen a 0 para no esperar
  readonly seconds: WritableSignal<number>;
  // Vuelve a empezar desde el principio
  restart(): void;
}

// Cuenta atrás de segundos en un signal (sin Zone.js, la pantalla se actualiza
// sola), p. ej. hasta poder pedir otro código. Se para al destruir la pantalla
export function createCountdown(totalSeconds: number, destroyRef: DestroyRef): Countdown {
  const seconds = signal(totalSeconds);
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => clearInterval(timer);
  destroyRef.onDestroy(stop);

  return {
    seconds,
    restart: () => {
      stop();
      seconds.set(totalSeconds);
      timer = setInterval(() => {
        seconds.update((left) => left - 1);
        if (seconds() <= 0) {
          stop();
        }
      }, 1000);
    },
  };
}

// Texto del botón de reenviar: «Reenviar código en 00:42» o, al terminar la
// cuenta atrás, «Reenviar código»
export function getResendLabel(seconds: number): string {
  return seconds > 0
    ? `Reenviar código en 00:${String(seconds).padStart(2, '0')}`
    : 'Reenviar código';
}
