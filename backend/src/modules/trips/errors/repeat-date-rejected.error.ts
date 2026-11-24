import { BusinessError } from '../../../shared/errors/business-error';

// Al publicar varios días a la vez, uno no cumple una regla (ya hay 4 viajes
// ese día, se cruza con otro viaje…): no se publica ninguno. Guarda el día,
// el error (cause) y su tipo de fallo, así que la capa API lo traduce a su
// mismo status (REPEAT_DATE_REJECTED). El mensaje empieza siempre por
// «Repeat date AAAA-MM-DD (CÓDIGO)»: la app saca de ahí el día
export class RepeatDateRejectedError extends BusinessError {
  constructor(
    readonly date: string,
    readonly cause: BusinessError,
  ) {
    super(
      'REPEAT_DATE_REJECTED',
      cause.kind,
      `Repeat date ${date} (${cause.code}): ${cause.message}`,
    );
  }
}
