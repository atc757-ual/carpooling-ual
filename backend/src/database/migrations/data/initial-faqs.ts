// Datos de la migración AddFaqs: los temas del centro de ayuda y las
// preguntas que la app llevaba escritas en el frontend (Buscar, Publicar y
// «Ayuda y soporte»), tal cual, con su tema, a quién van y de qué pantalla
// son pregunta rápida. Es una foto de ese momento: no se cambia después (los
// textos se gestionan desde el panel)
export interface InitialFaqTopic {
  key: string;
  nameEs: string;
  nameEn: string;
  icon: string;
}

export interface InitialFaq {
  topic: string;
  audience: 'driver' | 'passenger' | 'both';
  context: 'search' | 'publish' | 'support';
  questionEs: string;
  questionEn: string;
  answerEs: string;
  answerEn: string;
  pointsEs?: string[];
  pointsEn?: string[];
}

// En el orden en que se muestran
export const INITIAL_FAQ_TOPICS: readonly InitialFaqTopic[] = [
  {
    key: 'getting-started',
    nameEs: 'Empezar y cuenta',
    nameEn: 'Getting started and account',
    icon: 'person-circle-outline',
  },
  {
    key: 'search',
    nameEs: 'Buscar y pedir plaza',
    nameEn: 'Searching and requesting a seat',
    icon: 'search-outline',
  },
  {
    key: 'publish',
    nameEs: 'Publicar y conducir',
    nameEn: 'Publishing and driving',
    icon: 'car-outline',
  },
  {
    key: 'trip-day',
    nameEs: 'El día del viaje',
    nameEn: 'The day of the trip',
    icon: 'navigate-outline',
  },
  {
    key: 'cancellations',
    nameEs: 'Cancelaciones y penalizaciones',
    nameEn: 'Cancellations and penalties',
    icon: 'close-circle-outline',
  },
  {
    key: 'safety',
    nameEs: 'Seguridad',
    nameEn: 'Safety',
    icon: 'shield-checkmark-outline',
  },
  {
    key: 'chat-notifications',
    nameEs: 'Chat y avisos',
    nameEn: 'Chat and notifications',
    icon: 'chatbubbles-outline',
  },
  {
    key: 'ratings',
    nameEs: 'Valoraciones',
    nameEn: 'Ratings',
    icon: 'thumbs-up-outline',
  },
  {
    key: 'privacy',
    nameEs: 'Privacidad y datos',
    nameEn: 'Privacy and data',
    icon: 'lock-closed-outline',
  },
  {
    key: 'help',
    nameEs: 'Ayuda',
    nameEn: 'Help',
    icon: 'help-circle-outline',
  },
];

// En el orden de cada pantalla; dentro de su tema quedan en este mismo orden
export const INITIAL_FAQS: readonly InitialFaq[] = [
  // Buscar (features/matching/search-faqs.ts)
  {
    topic: 'search',
    audience: 'passenger',
    context: 'search',
    questionEs: '¿Por qué hora de llegada o de salida?',
    questionEn: 'Why an arrival or a departure time?',
    answerEs:
      'Al ir al campus lo que importa es llegar a tiempo, así que pones a qué hora quieres llegar. Al volver, lo que cuenta es cuándo sales del campus, así que pones la hora de salida.',
    answerEn:
      'On the way to campus what matters is arriving on time, so you enter when you want to arrive. On the way back, what counts is when you leave campus, so you enter the departure time.',
  },
  {
    topic: 'search',
    audience: 'passenger',
    context: 'search',
    questionEs: '¿Qué es el margen horario?',
    questionEn: 'What is the time margin?',
    answerEs:
      'Cuánto antes o después de tu hora te viene bien. Con llegada a las 08:00 y ± 15 min, verás los viajes que llegan entre las 07:45 y las 08:15.',
    answerEn:
      'How much earlier or later than your time suits you. With arrival at 08:00 and ± 15 min, you will see the trips arriving between 07:45 and 08:15.',
  },
  {
    topic: 'search',
    audience: 'passenger',
    context: 'search',
    questionEs: '¿Cuántas plazas pido?',
    questionEn: 'How many seats should I request?',
    answerEs:
      'La tuya y la de quien venga contigo, hasta 4. Quien conduce acepta o rechaza la solicitud entera.',
    answerEn:
      'Yours and one for each person coming with you, up to 4. The driver accepts or rejects the whole request.',
  },
  {
    topic: 'search',
    audience: 'passenger',
    context: 'search',
    questionEs: '¿Cuándo tengo la plaza?',
    questionEn: 'When is the seat mine?',
    answerEs:
      'Cuando quien conduce acepta tu solicitud. Hasta entonces está pendiente; te avisamos en la campana en cuanto decida.',
    answerEn:
      'When the driver accepts your request. Until then it is pending; we notify you on the bell as soon as they decide.',
  },
  {
    topic: 'safety',
    audience: 'passenger',
    context: 'search',
    questionEs: '¿Con quién voy a viajar?',
    questionEn: 'Who will I travel with?',
    answerEs:
      'Solo con gente de la UAL: todas las cuentas usan un correo de la universidad verificado, y quien conduce declara tener el permiso, el seguro y la ITV en regla.',
    answerEn:
      'Only with people from the UAL: every account uses a verified university email, and drivers declare that their licence, insurance and vehicle inspection (ITV) are in order.',
  },
  {
    topic: 'search',
    audience: 'passenger',
    context: 'search',
    questionEs: '¿Y si no hay viajes?',
    questionEn: 'What if there are no trips?',
    answerEs:
      'Prueba con otra hora o amplía el margen. Cada día se publican viajes nuevos: vuelve a mirar más tarde.',
    answerEn:
      'Try another time or widen the margin. New trips are published every day: check again later.',
  },
  // Publicar (features/trips/publish-trip/publish-help.ts)
  {
    topic: 'publish',
    audience: 'driver',
    context: 'publish',
    questionEs: '¿Cuánto tiempo extra me supone recoger?',
    questionEn: 'How much extra time do pickups take?',
    answerEs:
      'Lo calculamos por ti: unos 2 minutos de parada por pasajero más el rodeo hasta su punto (según los metros que te apartas) o, si recoges en paradas, lo que alargan tu ruta. Con la hora de llegada, ese margen ya va en la hora de salida, y solo te pedirán plaza quienes quepan en él.',
    answerEn:
      'We work it out for you: about 2 minutes of stop per passenger plus the detour to their point (depending on how many metres you go out of your way) or, if you pick up at stops, what they add to your route. With an arrival time, that margin is already in your departure time, and only those who fit in it will request a seat.',
  },
  {
    topic: 'publish',
    audience: 'driver',
    context: 'publish',
    questionEs: '¿Cuántas plazas ofrezco?',
    questionEn: 'How many seats should I offer?',
    answerEs:
      'Las que quieras llevar en este viaje, como mucho las de tu vehículo sin contarte a ti. Puedes ofrecer menos si llevas cosas en el asiento.',
    answerEn:
      'As many as you want to take on this trip, at most the seats of your vehicle not counting yours. You can offer fewer if you are carrying things on a seat.',
  },
  {
    topic: 'publish',
    audience: 'driver',
    context: 'publish',
    questionEs: '¿Cuántas solicitudes puedo aceptar?',
    questionEn: 'How many requests can I accept?',
    answerEs:
      'Tantas como plazas ofreces. Cuando se llenan, el viaje deja de salir en las búsquedas.',
    answerEn:
      'As many as the seats you offer. Once they are full, the trip no longer shows up in searches.',
  },
  {
    topic: 'privacy',
    audience: 'driver',
    context: 'publish',
    questionEs: '¿Qué ven los pasajeros de mí?',
    questionEn: 'What do passengers see about me?',
    answerEs:
      'Tu nombre, el trayecto, la hora y las plazas libres. Tu teléfono y tu correo no se muestran.',
    answerEn:
      'Your name, the route, the time and the free seats. Your phone number and your email are not shown.',
  },
  {
    topic: 'cancellations',
    audience: 'driver',
    context: 'publish',
    questionEs: '¿Qué pasa si cancelo?',
    questionEn: 'What happens if I cancel?',
    answerEs: 'Se cancela desde Tus viajes y depende del momento:',
    answerEn: 'You cancel from Your trips, and it depends on when:',
    pointsEs: [
      'Sin pasajeros aceptados: las solicitudes pendientes se cancelan y avisamos a quien las hizo.',
      'Con pasajeros, hasta 20 minutos antes de salir: sin penalización; les avisamos al momento para que busquen otro viaje.',
      'A menos de 20 minutos de salir: también les avisamos, pero tendrás una penalización.',
      'Con el viaje ya empezado: solo comunicando una incidencia; tus pasajeros tienen prioridad para encontrar otro viaje.',
    ],
    pointsEn: [
      'With no accepted passengers: pending requests are cancelled and we notify whoever made them.',
      'With passengers, up to 20 minutes before departure: no penalty; we notify them right away so they can look for another trip.',
      'Less than 20 minutes before departure: we notify them too, but you will get a penalty.',
      'Once the trip has started: only by reporting an incident; your passengers get priority to find another trip.',
    ],
  },
  {
    topic: 'publish',
    audience: 'driver',
    context: 'publish',
    questionEs: '¿Por qué la declaración responsable?',
    questionEn: 'Why the responsible declaration?',
    answerEs:
      'Para que quien viaja contigo sepa que tienes el permiso de conducir en vigor y que tu vehículo tiene el seguro y la ITV al día. Se acepta una sola vez.',
    answerEn:
      'So that whoever travels with you knows that your driving licence is valid and that your vehicle has its insurance and inspection (ITV) up to date. You accept it only once.',
  },
  // Ayuda y soporte (features/profile/support-faqs.ts)
  {
    topic: 'trip-day',
    audience: 'both',
    context: 'support',
    questionEs: '¿Para qué es el código de embarque?',
    questionEn: 'What is the boarding code for?',
    answerEs:
      'Cuando te aceptan la plaza ves un código de 4 cifras en el viaje. Al subir al coche se lo dices a quien conduce, que lo escribe en su pantalla para confirmar que vas a bordo.',
    answerEn:
      'When your seat is accepted you see a 4-digit code in the trip. When you get in the car you tell it to the driver, who types it on their screen to confirm you are on board.',
  },
  {
    topic: 'trip-day',
    audience: 'both',
    context: 'support',
    questionEs: '¿Cuánto me esperan en el punto de recogida?',
    questionEn: 'How long will they wait for me at the pickup point?',
    answerEs:
      'Llega a tu hora de recogida: quien conduce te espera al menos 5 minutos y, pasado ese tiempo, puede marcar que no te has presentado.',
    answerEn:
      'Be there at your pickup time: the driver waits for you at least 5 minutes and, after that, can mark you as a no-show.',
  },
  {
    topic: 'privacy',
    audience: 'both',
    context: 'support',
    questionEs: '¿Quién ve mi ubicación?',
    questionEn: 'Who sees my location?',
    answerEs:
      'Durante el viaje, solo quien conduce comparte su posición, y solo la ven sus pasajeros aceptados. El recorrido se borra en cuanto el viaje termina o se cancela.',
    answerEn:
      'During the trip, only the driver shares their position, and only their accepted passengers see it. The track is deleted as soon as the trip ends or is cancelled.',
  },
  {
    topic: 'cancellations',
    audience: 'both',
    context: 'support',
    questionEs: '¿Puedo cancelar mi plaza?',
    questionEn: 'Can I cancel my seat?',
    answerEs: 'Sí, desde Tus viajes, y depende del momento:',
    answerEn: 'Yes, from Your trips, and it depends on when:',
    pointsEs: [
      'Hasta 10 minutos antes de la salida: sin penalización; avisamos a quien conduce.',
      'A menos de 10 minutos: es una cancelación tardía. Con 3 en 30 días, no podrás pedir plaza durante 7 días.',
      'Con el viaje ya empezado: solo comunicando una incidencia.',
    ],
    pointsEn: [
      'Up to 10 minutes before departure: no penalty; we notify the driver.',
      'Less than 10 minutes before: it is a late cancellation. With 3 in 30 days, you will not be able to request a seat for 7 days.',
      'Once the trip has started: only by reporting an incident.',
    ],
  },
  {
    topic: 'help',
    audience: 'both',
    context: 'support',
    questionEs: '¿Hay que pagar algo?',
    questionEn: 'Do I have to pay anything?',
    answerEs:
      'No. Es una plataforma colaborativa de la comunidad UAL: no cobra nada ni gestiona pagos. Lo que se comparte es el trayecto, y con él se ahorra CO₂ y sitio en los parkings.',
    answerEn:
      'No. It is a collaborative platform of the UAL community: it charges nothing and handles no payments. What is shared is the journey, and with it you save CO₂ and parking space.',
  },
];
