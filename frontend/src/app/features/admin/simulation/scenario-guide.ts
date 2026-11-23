import { ScenarioConfig } from '../../../core/models/admin-simulation.model';
import { formatNumber } from './simulation-labels';

// Lo que explica cada escenario en el panel (capítulo 11 de la memoria): qué
// representa y qué pregunta contesta. Las cifras no van aquí: salen de la
// configuración de cada escenario (scenarioSettings)

export interface ScenarioGuide {
  summary: string;
  description: string;
  question: string;
}

const GUIDES: Record<string, ScenarioGuide> = {
  S0: {
    summary: 'Sin carpooling: la referencia',
    description:
      'Nadie comparte coche: cada persona va al campus como hoy. Es la situación base con la que se compara cada escenario, con la misma población (las mismas semillas).',
    question: '¿Cuántos coches llegan hoy al campus?',
  },
  S1: {
    summary: 'Carpooling en condiciones normales',
    description:
      'Una parte de quienes van en su coche se apunta: unos conducen y ofrecen sus plazas y otros piden plaza. Quien no encuentra viaje va en su coche, como siempre.',
    question: '¿Cuántos coches evita el carpooling en condiciones normales?',
  },
  S2: {
    summary: 'Lo mismo con más gente (pico de demanda)',
    description:
      'Igual que S1, con más usuarios a la vez: el momento de más demanda. Con más gente es más fácil coincidir en zona y hora, pero el matching tiene más trabajo.',
    question: '¿Funciona mejor con más usuarios y aguanta el tiempo del matching?',
  },
  S3: {
    summary: 'Cada uno con su margen de hora',
    description:
      'Cada persona acepta llegar con un margen distinto, en vez del mismo para todos. Quien es flexible coincide con más conductores.',
    question: '¿Ayuda que la gente sea flexible con la hora?',
  },
  S4: {
    summary: 'Coches de distinto tamaño',
    description:
      'Los coches tienen distinto número de plazas, en vez de 4 todos. Cambia cuántos pasajeros caben en cada viaje compartido.',
    question: '¿Cómo influye el tamaño de los coches en la ocupación?',
  },
  S5: {
    summary: 'Conductores que cancelan',
    description:
      'Una parte de los conductores cancela su viaje. Sus pasajeros pierden la plaza y buscan otro viaje; si no lo encuentran, van en su coche.',
    question: '¿Cuántos pasajeros afectados por una cancelación encuentran otro viaje?',
  },
};

// Sin texto propio (un escenario nuevo), solo se ven sus cifras
export function scenarioGuide(code: string): ScenarioGuide | null {
  return GUIDES[code] ?? null;
}

export interface ScenarioSetting {
  label: string;
  value: string;
}

function percent(share: number): string {
  return `${formatNumber(share * 100, 0)} %`;
}

function numberParameter(config: ScenarioConfig, name: string): number | null {
  const value = Number(config.parameters[name]);
  return config.parameters[name] === undefined || !Number.isFinite(value) ? null : value;
}

// El margen de hora: el mismo para todos o, en S3, al azar en un rango
function windowSetting(config: ScenarioConfig): string {
  const range = config.parameters['timeWindowRangeMin'];
  if (Array.isArray(range) && range.length === 2) {
    return `De ${range[0]} a ${range[1]} min, distinto para cada persona`;
  }
  return `${config.timeWindowMin} min, para todos`;
}

function capacitySetting(config: ScenarioConfig): string {
  const capacities = config.parameters['vehicleCapacities'];
  if (Array.isArray(capacities) && capacities.length > 0) {
    const list = capacities.map(String);
    return `${list.slice(0, -1).join(', ')} o ${list.at(-1)} plazas, al azar`;
  }
  return '4 plazas (el conductor y 3 pasajeros)';
}

// Lo que solo traen algunos escenarios (cancelaciones y otros modos)
function optionalSettings(config: ScenarioConfig): ScenarioSetting[] {
  const settings: ScenarioSetting[] = [];
  const cancellation = numberParameter(config, 'cancellationRate');
  if (cancellation !== null && cancellation > 0) {
    settings.push({
      label: 'Cancelan su viaje',
      value: `${percent(cancellation)} de los conductores`,
    });
  }
  const otherAdoption = numberParameter(config, 'nonCarAdoptionRate');
  if (otherAdoption !== null && otherAdoption > 0) {
    settings.push({
      label: 'Se apuntan desde otros modos',
      value: `${percent(otherAdoption)} de quienes van en bus o de otra forma`,
    });
    const otherDrivers = numberParameter(config, 'nonCarDriverShare') ?? 0;
    settings.push({
      label: 'De ellos, conducen',
      value: `${percent(otherDrivers)} (solo sacan el coche si llevan a alguien)`,
    });
  }
  return settings;
}

// La configuración del escenario contada en claro, en el orden de la memoria
export function scenarioSettings(config: ScenarioConfig): ScenarioSetting[] {
  return [
    { label: 'Usuarios', value: formatNumber(config.users, 0) },
    { label: 'Van en su coche', value: percent(config.modalSplit['own_car'] ?? 0) },
    {
      label: 'Se apuntan al carpooling',
      value:
        config.adoptionRate > 0
          ? `${percent(config.adoptionRate)} de quienes van en coche`
          : 'Nadie (sin carpooling)',
    },
    { label: 'Margen de hora', value: windowSetting(config) },
    { label: 'Coches', value: capacitySetting(config) },
    ...optionalSettings(config),
  ];
}
