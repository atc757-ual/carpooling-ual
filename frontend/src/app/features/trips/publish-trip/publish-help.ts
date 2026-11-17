// Ayuda de Publicar: qué pasa después de publicar (paso 3). Las preguntas
// frecuentes vienen de la API (app-quick-faqs)
export interface NextStep {
  title: string;
  text: string;
}

export function getNextSteps(autoAccept = false): readonly NextStep[] {
  return [
    {
      title: 'Recibes solicitudes',
      text: 'Te avisamos cuando alguien de la UAL pida plaza en tu viaje.',
    },
    autoAccept
      ? {
          title: 'Aceptación automática',
          text: 'Quien quepa en tu ruta y plazas se unirá al momento y te avisaremos; si no cabe, decidirás tú.',
        }
      : {
          title: 'Tú decides',
          text: 'Aceptas o rechazas cada solicitud: nadie tiene plaza sin tu visto bueno.',
        },
    {
      title: 'El día del viaje',
      text: 'Sal a tu hora y recoge a tus pasajeros. Si no puedes ir, cancélalo en Tus viajes hasta 20 minutos antes.',
    },
  ];
}

export const NEXT_STEPS: readonly NextStep[] = getNextSteps(false);

// «Gracias por compartir tu coche» (al publicar): por qué ayuda a la UAL
export const COMMUNITY_POINTS: readonly string[] = [
  'Menos coches y menos atascos a la entrada del campus, y más sitio en los parkings.',
  'Ayudas a que la UAL sea un campus más sostenible, con menos CO₂ en cada trayecto.',
  'Y tú también ganas: conoces a gente de la UAL que hace tu camino y amplías tu red de contactos.',
];
