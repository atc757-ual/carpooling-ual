// Tipos de evento que la plataforma registra para el Gemelo Digital (RNF-08).
// Formato "entidad.acción", en pasado: cuentan algo que YA ha ocurrido
export type DomainEventType =
  // Usuarios (tabla de entidades del Gemelo Digital: registro y perfiles)
  | 'user.registered'
  | 'user.email_verified'
  | 'user.profile_activated'
  | 'user.profile_deactivated'
  // Viajes. confirmed: primera solicitud aceptada; reopened: vuelve a
  // publicado porque se han cancelado todas las aceptadas
  | 'trip.published'
  | 'trip.updated'
  | 'trip.confirmed'
  | 'trip.reopened'
  | 'trip.started'
  | 'trip.finished'
  | 'trip.cancelled'
  // Posición del conductor durante el viaje (seguimiento real, RF-12): el
  // "cambio de posición" con el que se sincroniza el Gemelo Digital (RNF-07)
  | 'trip.position_updated'
  // Solicitudes de plaza
  | 'request.created'
  | 'request.accepted'
  | 'request.rejected'
  | 'request.cancelled'
  // Incidencias (RF-23, CU-12)
  | 'incident.reported'
  | 'incident.reviewed';
