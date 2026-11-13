import { Faq } from '../../shared/components/ui/faq-card/faq-card';

// Las dudas más comunes, en «Ayuda y soporte» encima del formulario: si la
// respuesta está aquí, no hace falta escribir. Solo lo que la plataforma ya
// hace (código de embarque, espera de 5 min, posición del conductor y
// cancelaciones: trip-timing.ts y tracking del backend)
export const SUPPORT_FAQS: readonly Faq[] = [
  {
    question: '¿Para qué es el código de embarque?',
    answer:
      'Cuando te aceptan la plaza ves un código de 4 cifras en el viaje. Al subir al coche se lo dices a quien conduce, que lo escribe en su pantalla para confirmar que vas a bordo.',
  },
  {
    question: '¿Cuánto me esperan en el punto de recogida?',
    answer:
      'Llega a tu hora de recogida: quien conduce te espera al menos 5 minutos y, pasado ese tiempo, puede marcar que no te has presentado.',
  },
  {
    question: '¿Quién ve mi ubicación?',
    answer:
      'Durante el viaje, solo quien conduce comparte su posición, y solo la ven sus pasajeros aceptados. El recorrido se borra en cuanto el viaje termina o se cancela.',
  },
  {
    question: '¿Puedo cancelar mi plaza?',
    answer: 'Sí, desde Tus viajes, y depende del momento:',
    points: [
      'Hasta 30 minutos antes de la salida: sin penalización; avisamos a quien conduce.',
      'A menos de 30 minutos: es una cancelación tardía. Con 3 en 30 días, no podrás pedir plaza durante 7 días.',
      'Con el viaje ya empezado: solo comunicando una incidencia.',
    ],
  },
  {
    question: '¿Hay que pagar algo?',
    answer:
      'No. Es una plataforma colaborativa de la comunidad UAL: no cobra nada ni gestiona pagos. Lo que se comparte es el trayecto, y con él se ahorra CO₂ y sitio en los parkings.',
  },
];
