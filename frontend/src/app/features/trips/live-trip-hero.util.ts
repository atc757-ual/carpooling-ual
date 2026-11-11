// La tarjeta «En directo» de las pantallas En curso (pasajero y conductor):
// el título, la etiqueta de los minutos y las tres etapas

// A menos de esto del destino, la etapa «Llegada» pasa a ser la actual (la
// misma distancia que «Terminar viaje» da por buena). Solo en la ida al
// campus: en la vuelta, cada pasajero se baja en un sitio
export const ARRIVING_METERS = 300;

export type JourneyStageState = 'done' | 'current' | 'upcoming';

export interface JourneyStage {
  label: string;
  state: JourneyStageState;
}

// Las tres etapas, hechas hasta la actual (0, 1 o 2)
export function journeyStages(labels: readonly string[], current: number): JourneyStage[] {
  return labels.map((label, index) => {
    let state: JourneyStageState = 'upcoming';
    if (index < current) {
      state = 'done';
    } else if (index === current) {
      state = 'current';
    }
    return { label, state };
  });
}

export function isArriving(destinationMeters: number | null): boolean {
  return destinationMeters !== null && destinationMeters <= ARRIVING_METERS;
}

// «Rumbo al campus», «Rumbo a casa» o, ya cerca, «Llegando al campus»
export function headingTo(isToCampus: boolean, isNear: boolean): string {
  if (isToCampus) {
    return isNear ? 'Llegando al campus' : 'Rumbo al campus';
  }
  return 'Rumbo a casa';
}

// La etiqueta de los minutos: «En destino en 10 min»; con 1 o menos, «Llegando»
export function etaTag(minutes: number, prefix: string): string {
  const rounded = Math.round(minutes);
  return rounded <= 1 ? 'Llegando' : `${prefix} en ${rounded} min`;
}
