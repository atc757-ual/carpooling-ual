import { DestroyRef, WritableSignal, signal } from '@angular/core';
import type { TranslocoService } from '@jsverse/transloco';

export interface Countdown {
  // Segundos que faltan (0 cuando ha terminado). Modificable como cualquier
  // signal: los tests e2e lo ponen a 0 para no esperar
  readonly seconds: WritableSignal<number>;
  // Vuelve a empezar desde el principio
  restart(): void;
}

// Cuenta atrás de segundos en un signal (sin Zone.js, la pantalla se actualiza
// sola), p. ej. hasta poder pedir otro código. Se para al destruir la pantalla
export function createCountdown(
  totalSeconds: number,
  destroyRef: DestroyRef,
  initialSeconds?: number,
): Countdown {
  const seconds = signal(initialSeconds ?? totalSeconds);
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => clearInterval(timer);
  destroyRef.onDestroy(stop);

  const startTicking = (count: number): void => {
    stop();
    seconds.set(count);
    if (count <= 0) {
      return;
    }
    timer = setInterval(() => {
      seconds.update((left) => left - 1);
      if (seconds() <= 0) {
        stop();
      }
    }, 1000);
  };

  if (initialSeconds !== undefined && initialSeconds > 0) {
    startTicking(initialSeconds);
  }

  return {
    seconds,
    restart: () => {
      startTicking(totalSeconds);
    },
  };
}

// Texto del botón de reenviar: «Reenviar código en 01:00», «00:42»… (minutos y
// segundos) o, al terminar la
// cuenta atrás, «Reenviar código» (o sus traducciones si se proporciona el servicio de i18n)
export function getResendLabel(seconds: number, transloco?: TranslocoService | null): string {
  if (transloco) {
    return seconds > 0
      ? transloco.translate('common.countdown.resendIn', { time: formatMinutesSeconds(seconds) })
      : transloco.translate('common.countdown.resend');
  }
  return seconds > 0 ? `Reenviar código en ${formatMinutesSeconds(seconds)}` : 'Reenviar código';
}

// 60 → «01:00», 42 → «00:42»
export function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
