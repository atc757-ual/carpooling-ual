import { ApiError, NETWORK_ERROR, UNKNOWN_ERROR } from '../../core/models/api-error.model';

// Mensajes para el usuario de cada código de error (docs/api/errors.md). Se
// añaden los de cada área cuando se haga su pantalla.
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [NETWORK_ERROR]: 'No hay conexión. Comprueba tu red e inténtalo de nuevo.',
  [UNKNOWN_ERROR]: 'Algo ha salido mal. Inténtalo de nuevo.',
  VALIDATION_FAILED: 'Revisa los datos del formulario.',
  NOT_FOUND: 'No hemos encontrado lo que buscas.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible ahora mismo. Inténtalo más tarde.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  EMAIL_NOT_VERIFIED: 'Tienes que verificar tu correo antes de entrar.',
  INVALID_VERIFICATION_CODE: 'Ese código no es válido. Revisa los 6 dígitos o pide uno nuevo.',
  PASSWORD_UNCHANGED: 'La contraseña nueva tiene que ser distinta de la actual.',
  TOO_MANY_ATTEMPTS: 'Has fallado demasiadas veces. Pide un código nuevo.',
  EMAIL_ALREADY_REGISTERED: 'Ya hay una cuenta con este correo.',
  EMAIL_DOMAIN_NOT_ALLOWED: 'Usa tu correo de la Universidad de Almería.',
  INVALID_ACCESS_TOKEN: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
  ACCESS_TOKEN_EXPIRED: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  INVALID_REFRESH_TOKEN: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  PROFILE_REQUIRED: 'Tu perfil no permite hacer esta acción.',
  PROFILE_DEACTIVATED_BY_ADMIN:
    'La administración ha desactivado este perfil. Escríbele si crees que es un error.',
  AVATAR_NOT_FOUND: 'El avatar elegido no está disponible. Elige otro de la lista.',
  PHONE_REQUIRED: 'Añade y guarda un número de teléfono antes de verificarlo.',
  VEHICLE_ALREADY_REGISTERED: 'Ya tienes un vehículo con esta matrícula.',
  DRIVER_NOT_READY: 'Registra un vehículo y acepta la declaración antes de publicar.',
  PUBLISHING_SUSPENDED:
    'No puedes publicar temporalmente por cancelaciones tardías. Revisa el aviso en Publicar.',
  DEPARTURE_TOO_SOON: 'El viaje debe salir al menos dentro de una hora.',
  SEATS_EXCEED_CAPACITY: 'Ofreces más plazas de las que tiene el vehículo.',
  DEPARTURE_IN_THE_PAST: 'La hora de salida ya ha pasado. Elige una hora posterior.',
  TRIP_FULL: 'Ya no quedan plazas suficientes en este viaje. Busca otro viaje.',
  TRIP_NOT_OPEN: 'Este viaje ya no admite solicitudes.',
  REQUEST_ALREADY_EXISTS: 'Ya tienes una solicitud en este viaje.',
  CANNOT_REQUEST_OWN_TRIP: 'No puedes pedir plaza en tu propio viaje.',
  TRIP_ALREADY_STARTED: 'El viaje ya ha empezado: ya no se puede cancelar desde aquí.',
  TRIP_NOT_STARTABLE_YET: 'Aún no puedes iniciarlo: podrás hacerlo 10 minutos antes de la salida.',
  TRIP_NOT_IN_PROGRESS: 'Este viaje ya no está en curso.',
  ACCOUNT_HAS_ACTIVE_TRIPS:
    'No puedes darte de baja con viajes o reservas pendientes. Cancélalos antes de eliminar tu cuenta.',
  // Panel de administración
  LAST_ADMIN: 'Es el último administrador: nombra antes a otro.',
  CANNOT_CHANGE_OWN_ADMIN: 'No puedes quitarte a ti mismo el perfil de administrador.',
  USER_NOT_SUSPENDED: 'Este usuario ya no está suspendido.',
  USER_NOT_FOUND: 'No encontramos este usuario.',
  PROFILE_NOT_FOUND: 'Este usuario no tiene ese perfil.',
  SIMULATION_ALREADY_RUNNING: 'Ya hay una simulación en marcha. Espera a que termine o cancélala.',
  SIMULATION_NOT_FINISHED: 'Esta simulación aún no tiene resultados.',
  SCENARIO_NOT_FOUND: 'Ese escenario no existe.',
  INVALID_SIMULATION_TRANSITION: 'Esta simulación ya ha terminado.',
  // Catálogos y documentos legales (panel de administración)
  CATALOG_ITEM_EXISTS: 'Ya hay un elemento con ese nombre (aunque esté desactivado).',
  CATALOG_ITEM_NOT_FOUND: 'Ese elemento ya no existe. Recarga la lista.',
  INVALID_AVATAR_IMAGE:
    'La imagen tiene que ser PNG o WebP, cuadrada, de 128 a 512 px y de hasta 100 KB.',
  VEHICLE_COLOR_NOT_OFFERED: 'Ese color ya no se ofrece. Elige otro.',
  TRAVEL_PREFERENCE_NOT_OFFERED: 'Esa opción ya no se ofrece. Elige otra.',
  CAMPUS_PARKING_NOT_FOUND: 'Ese parking no existe o está cerrado.',
  PARKING_OUTSIDE_SERVICE_AREA: 'El punto queda fuera de la zona de servicio.',
  PARKING_IN_USE:
    'Tiene viajes publicados o en curso: no se puede cerrar ni mover hasta que terminen.',
  LEGAL_DOCUMENT_NOT_FOUND: 'No hay ninguna versión publicada de ese documento.',
  LEGAL_DRAFT_NOT_FOUND: 'No hay ningún borrador que publicar.',
  LEGAL_DOCUMENT_OUTDATED: 'Se ha publicado otra versión mientras leías. Revisa la última.',
  LEGAL_SUMMARY_REQUIRED: 'Escribe «Qué ha cambiado» antes de publicar la versión.',
};

export function getErrorMessage(error: ApiError): string {
  if (error.code === 'INTERNAL_ERROR') {
    const reference = error.requestId ? ` (referencia: ${error.requestId})` : '';
    return `Ha ocurrido un error en el servidor${reference}. Inténtalo de nuevo.`;
  }
  return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES[UNKNOWN_ERROR];
}
