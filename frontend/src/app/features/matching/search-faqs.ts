import { Faq } from '../../shared/components/ui/faq-card/faq-card';

// Las dudas de quien busca por primera vez, junto al formulario de Buscar
export const SEARCH_FAQS: readonly Faq[] = [
  {
    question: '¿Por qué hora de llegada o de salida?',
    answer:
      'Al ir al campus lo que importa es llegar a tiempo, así que pones a qué hora quieres llegar. Al volver, lo que cuenta es cuándo sales del campus, así que pones la hora de salida.',
  },
  {
    question: '¿Qué es el margen horario?',
    answer:
      'Cuánto antes o después de tu hora te viene bien. Con llegada a las 08:00 y ± 15 min, verás los viajes que llegan entre las 07:45 y las 08:15.',
  },
  {
    question: '¿Cuántas plazas pido?',
    answer:
      'La tuya y la de quien venga contigo, hasta 4. Quien conduce acepta o rechaza la solicitud entera.',
  },
  {
    question: '¿Cuándo tengo la plaza?',
    answer:
      'Cuando quien conduce acepta tu solicitud. Hasta entonces está pendiente; te avisamos en la campana en cuanto decida.',
  },
  {
    question: '¿Con quién voy a viajar?',
    answer:
      'Solo con gente de la UAL: todas las cuentas usan un correo de la universidad verificado, y quien conduce declara tener el permiso, el seguro y la ITV en regla.',
  },
  {
    question: '¿Y si no hay viajes?',
    answer:
      'Prueba con otra hora o amplía el margen. Cada día se publican viajes nuevos: vuelve a mirar más tarde.',
  },
];
