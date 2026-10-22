// Tipos de evento que la plataforma registra para el Gemelo Digital (RNF-08).
// Formato "entidad.acción", en pasado: cuentan algo que YA ha ocurrido
export type DomainEventType =
  // Viajes. confirmed: primera solicitud aceptada; reopened: vuelve a
  // publicado porque se han cancelado todas las aceptadas
  | 'trip.published'
  | 'trip.updated'
  | 'trip.confirmed'
  | 'trip.reopened'
  | 'trip.started'
  | 'trip.finished'
  | 'trip.cancelled'
  // Solicitudes de plaza
  | 'request.created'
  | 'request.accepted'
  | 'request.rejected'
  | 'request.cancelled'
  // Incidencias (RF-23, CU-12)
  | 'incident.reported'
  | 'incident.reviewed';
