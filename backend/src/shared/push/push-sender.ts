// Una notificación push lista para enviar: el texto que ve el usuario y los
// datos para abrir la pantalla al pulsarla (tipo de aviso e ids)
export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

// A qué dispositivos se envía. La web se identifica con su FID (el id de la
// instalación de Firebase, lo que Firebase recomienda); la app Android, con su
// token de FCM, porque su plugin (@capacitor/push-notifications) aún no da FID
export interface PushRecipients {
  tokens: readonly string[];
  fids: readonly string[];
}

// Envío de notificaciones push a unos dispositivos. Devuelve los tokens o FID
// que ya no valen (la app se desinstaló o se quitó el permiso), para borrarlos.
// Clase abstracta para que NestJS la use como token de inyección: quien envía
// no sabe si van por Firebase, se quedan en memoria (tests) o no se envían
export abstract class PushSender {
  abstract send(
    recipients: PushRecipients,
    message: PushMessage,
  ): Promise<string[]>;
}
