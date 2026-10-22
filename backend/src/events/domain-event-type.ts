// Tipos de evento que la plataforma registra para el Gemelo Digital (RNF-08).
// Formato "entidad.acción", en pasado: cuentan algo que YA ha ocurrido
export type DomainEventType =
  'trip.published' | 'trip.updated' | 'trip.cancelled';
