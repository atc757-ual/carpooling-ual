import { Faq } from '../../../shared/components/ui/faq-card/faq-card';

// Ayuda de Publicar: las dudas de quien conduce (pasos 1 y 2) y qué pasa
// después de publicar (paso 3). Solo lo que la plataforma ya hace (lo
// pendiente, en pendientes-memoria.md)
export const PUBLISH_FAQS: readonly Faq[] = [
  {
    question: '¿Qué es el desvío máximo?',
    answer:
      'Los minutos que aceptas añadir a tu ruta para recoger o dejar a un pasajero. Solo te pedirán plaza quienes estén dentro de ese margen.',
  },
  {
    question: '¿Cuántas plazas ofrezco?',
    answer:
      'Las que quieras llevar en este viaje, como mucho las de tu vehículo sin contarte a ti. Puedes ofrecer menos si llevas cosas en el asiento.',
  },
  {
    question: '¿Cuántas solicitudes puedo aceptar?',
    answer:
      'Tantas como plazas ofreces. Cuando se llenan, el viaje deja de salir en las búsquedas.',
  },
  {
    question: '¿Qué ven los pasajeros de mí?',
    answer:
      'Tu nombre, el trayecto, la hora y las plazas libres. Tu teléfono y tu correo no se muestran.',
  },
  {
    question: '¿Qué pasa si cancelo?',
    answer: 'Se cancela desde Tus viajes y depende del momento:',
    points: [
      'Sin pasajeros aceptados: las solicitudes pendientes se cancelan y avisamos a quien las hizo.',
      'Con pasajeros, hasta 30 minutos antes de salir: sin penalización; les avisamos al momento para que busquen otro viaje.',
      'A menos de 30 minutos de salir: también les avisamos, pero tendrás una penalización.',
      'Con el viaje ya empezado: solo comunicando una incidencia; tus pasajeros tienen prioridad para encontrar otro viaje.',
    ],
  },
  {
    question: '¿Por qué la declaración responsable?',
    answer:
      'Para que quien viaja contigo sepa que tienes el permiso de conducir en vigor y que tu vehículo tiene el seguro y la ITV al día. Se acepta una sola vez.',
  },
];

export interface NextStep {
  title: string;
  text: string;
}

export const NEXT_STEPS: readonly NextStep[] = [
  {
    title: 'Recibes solicitudes',
    text: 'Te avisamos cuando alguien de la UAL pida plaza en tu viaje.',
  },
  {
    title: 'Tú decides',
    text: 'Aceptas o rechazas cada solicitud: nadie tiene plaza sin tu visto bueno.',
  },
  {
    title: 'El día del viaje',
    text: 'Sal a tu hora y recoge a tus pasajeros. Si no puedes ir, cancélalo en Tus viajes hasta 30 minutos antes.',
  },
];

// «Gracias por compartir tu coche» (al publicar): por qué ayuda a la UAL
export const COMMUNITY_POINTS: readonly string[] = [
  'Menos coches y menos atascos a la entrada del campus, y más sitio en los parkings.',
  'Ayudas a que la UAL sea un campus más sostenible, con menos CO₂ en cada trayecto.',
  'Y tú también ganas: conoces a gente de la UAL que hace tu camino y amplías tu red de contactos.',
];
